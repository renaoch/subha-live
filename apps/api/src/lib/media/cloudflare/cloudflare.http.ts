import {
  CloudflareRealtimeError,
  isRetryableCloudflareStatus,
} from "./cloudflare.errors";

interface CloudflareHttpClientConfig {
  apiBase: string;
  appId: string;
  appSecret: string;
  timeoutMs: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /**
   * Hard ceiling on the TOTAL time this.request() is allowed to spend
   * across every attempt + every backoff sleep combined.
   *
   * Without this, `maxAttempts` * (a single 425's real-world ~11-12s
   * response time) + backoff sleeps adds up to 80-90+ seconds for one
   * call (observed in production). Whatever sits in front of this API
   * (App Service's own proxy, a CDN, a load balancer) has its own,
   * shorter idle/response timeout, and kills the connection before this
   * ever finishes - the client then sees a bare 502 with no CORS
   * headers on it, which browsers misreport as a CORS failure. That is
   * a symptom of THIS request running too long, not a CORS
   * misconfiguration.
   *
   * Keep this comfortably under any realistic upstream gateway timeout
   * so we always control the failure: return a clean, retryable error
   * to the client ourselves instead of letting the platform kill the
   * connection first.
   */
  overallDeadlineMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponential = Math.min(
    maxDelayMs,
    baseDelayMs * 2 ** (attempt - 1),
  );

  const jitter = Math.floor(
    Math.random() *
      Math.max(
        1,
        Math.floor(exponential * 0.25),
      ),
  );

  return exponential + jitter;
}

export class CloudflareRealtimeHttpClient {
  constructor(
    private readonly config: CloudflareHttpClientConfig,
  ) {}

  async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    let lastError: unknown;
    const startedAt = Date.now();

    for (
      let attempt = 1;
      attempt <= this.config.maxAttempts;
      attempt++
    ) {
      // Overall-deadline check, BEFORE spending time on another attempt.
      // A single Cloudflare 425 has been observed taking ~11-12s to
      // arrive; without this check, `maxAttempts` of those plus backoff
      // sleeps can blow past a minute, which is longer than most
      // upstream gateways will wait — they kill the connection first
      // and the client gets an opaque 502/CORS failure instead of a
      // clean error from us.
      const elapsed = Date.now() - startedAt;
      if (elapsed >= this.config.overallDeadlineMs) {
        console.error(
          "[cloudflare-http] OVERALL DEADLINE EXCEEDED",
          {
            path,
            attempt,
            elapsedMs: elapsed,
            overallDeadlineMs:
              this.config.overallDeadlineMs,
          },
        );

        throw (
          lastError ??
          new CloudflareRealtimeError(
            "Cloudflare Realtime request exceeded overall deadline",
            { statusCode: 504, retryable: false },
          )
        );
      }

      try {
        return await this.execute<T>(
          path,
          init,
          attempt,
        );
      } catch (error) {
        lastError = error;

        const retryable =
          this.isRetryableError(error);

        console.error(
          "[cloudflare-http] REQUEST ERROR",
          {
            path,
            attempt,
            maxAttempts:
              this.config.maxAttempts,
            retryable,
            error:
              error instanceof Error
                ? error.message
                : error,
          },
        );

        if (
          !retryable ||
          attempt >= this.config.maxAttempts
        ) {
          throw error;
        }

        const delay = getRetryDelay(
          attempt,
          this.config.baseDelayMs,
          this.config.maxDelayMs,
        );

        const remaining =
          this.config.overallDeadlineMs -
          (Date.now() - startedAt);

        if (remaining <= 0) {
          console.error(
            "[cloudflare-http] OVERALL DEADLINE EXCEEDED (before retry sleep)",
            { path, attempt },
          );
          throw error;
        }

        console.log(
          "[cloudflare-http] RETRYING",
          {
            path,
            attempt: attempt + 1,
            delayMs: Math.min(delay, remaining),
          },
        );

        await sleep(Math.min(delay, remaining));
      }
    }

    throw lastError;
  }

  private async execute<T>(
    path: string,
    init: RequestInit,
    attempt: number,
  ): Promise<T> {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => {
        controller.abort();
      },
      this.config.timeoutMs,
    );

    try {
      const url =
        `${this.config.apiBase}/apps/${this.config.appId}${path}`;

      const headers = new Headers(
        init.headers,
      );

      headers.set(
        "Content-Type",
        "application/json",
      );

      headers.set(
        "Authorization",
        `Bearer ${this.config.appSecret}`,
      );

      console.log(
        "[cloudflare-http] REQUEST",
        {
          url,
          method: init.method ?? "GET",
          timeoutMs:
            this.config.timeoutMs,
          attempt,
        },
      );

      const startedAt = Date.now();

      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const elapsedMs =
        Date.now() - startedAt;

      console.log(
        "[cloudflare-http] RESPONSE",
        {
          url,
          status: response.status,
          ok: response.ok,
          elapsedMs,
          attempt,
        },
      );

      const text =
        await response.text();

      let body: unknown;

      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }

      if (!response.ok) {
        console.error(
          "[cloudflare-http] HTTP ERROR",
          {
            url,
            status: response.status,
            body,
            attempt,
          },
        );

        throw new CloudflareRealtimeError(
          this.extractErrorMessage(
            body,
            response.status,
          ),
          {
            statusCode:
              response.status,
            retryable:
              isRetryableCloudflareStatus(
                response.status,
              ),
            responseBody: body,
          },
        );
      }

      if (!text) {
        return undefined as T;
      }

      return body as T;
    } catch (error) {
      if (
        error instanceof
        CloudflareRealtimeError
      ) {
        throw error;
      }

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        console.error(
          "[cloudflare-http] TIMEOUT",
          {
            path,
            timeoutMs:
              this.config.timeoutMs,
            attempt,
          },
        );

        throw new CloudflareRealtimeError(
          "Cloudflare Realtime request timed out",
          {
            statusCode: 408,
            retryable: true,
          },
        );
      }

      if (error instanceof Error) {
        console.error(
          "[cloudflare-http] NETWORK ERROR",
          {
            path,
            message: error.message,
            name: error.name,
            attempt,
          },
        );

        throw new CloudflareRealtimeError(
          `Cloudflare Realtime network error: ${error.message}`,
          {
            statusCode: 503,
            retryable: true,
          },
        );
      }

      console.error(
        "[cloudflare-http] UNKNOWN ERROR",
        {
          path,
          error,
          attempt,
        },
      );

      throw new CloudflareRealtimeError(
        "Unknown Cloudflare Realtime error",
        {
          statusCode: 503,
          retryable: true,
          responseBody: error,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryableError(
    error: unknown,
  ): boolean {
    if (
      error instanceof
      CloudflareRealtimeError
    ) {
      return error.retryable;
    }

    return false;
  }

  private extractErrorMessage(
    body: unknown,
    statusCode: number,
  ): string {
    if (
      typeof body === "object" &&
      body !== null
    ) {
      const data =
        body as Record<
          string,
          unknown
        >;

      if (
        typeof data.message ===
        "string"
      ) {
        return data.message;
      }

      if (
        typeof data.error ===
        "string"
      ) {
        return data.error;
      }
    }

    if (typeof body === "string") {
      return body;
    }

    return `Cloudflare Realtime API returned HTTP ${statusCode}`;
  }
}