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

    for (
      let attempt = 1;
      attempt <= this.config.maxAttempts;
      attempt++
    ) {
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

        console.log(
          "[cloudflare-http] RETRYING",
          {
            path,
            attempt: attempt + 1,
            delayMs: delay,
          },
        );

        await sleep(delay);
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