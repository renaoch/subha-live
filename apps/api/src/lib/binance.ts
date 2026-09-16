import crypto from "crypto";
import { AppError } from "../errors/app-error";

// ─── Binance signed REST client ──────────────────────────────────
//
// SECURITY MODEL
// - The API key/secret live ONLY in process.env (BINANCE_API_KEY /
//   BINANCE_API_SECRET), set via your deploy platform's secrets manager
//   or a local .env that is gitignored. They are never sent to, read
//   by, or reachable from the frontend — this file only runs on the
//   server.
// - Every private call is HMAC-SHA256 signed server-side. The secret
//   itself never leaves this process — it's used as a signing key, not
//   transmitted.
// - This is a single PLATFORM account (your Binance account), not a
//   per-user credential. End users never see or provide API keys;
//   they just trigger actions ("buy coins with USDT") through your
//   own authenticated app, and the backend executes them against the
//   platform's Binance account. Never collect individual users'
//   exchange API keys — that's a different (much riskier) trust model.
// - Fails loudly and immediately if credentials are missing, instead
//   of silently sending unsigned/broken requests.

const BINANCE_BASE_URL = process.env.BINANCE_BASE_URL || "https://api.binance.com";
const RECV_WINDOW = 5000;

function getCredentials() {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new AppError(503, "Binance integration is not configured", {
      code: "BINANCE_NOT_CONFIGURED",
    });
  }
  return { apiKey, apiSecret };
}

function sign(query: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) usp.append(k, String(v));
  }
  return usp.toString();
}

type BinanceMethod = "GET" | "POST" | "DELETE";

/**
 * Calls a PUBLIC Binance endpoint (no key/signature needed) — e.g. price
 * lookups. Safe to expose results directly to end users.
 */
export async function binancePublicRequest<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const qs = toQueryString(params);
  const url = `${BINANCE_BASE_URL}${path}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError(res.status === 429 ? 429 : 502, "Binance request failed", {
      code: "BINANCE_PUBLIC_ERROR",
      details: body.slice(0, 500),
    });
  }
  return res.json() as Promise<T>;
}

/**
 * Calls a SIGNED (private, account-level) Binance endpoint using the
 * platform's own API key/secret from environment variables. Only ever
 * call this from server-side code, gated by your own auth + authorization
 * checks — never let a raw path/params pair come from client input.
 */
export async function binanceSignedRequest<T>(
  method: BinanceMethod,
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const { apiKey, apiSecret } = getCredentials();

  const timestamp = Date.now();
  const query = toQueryString({ ...params, timestamp, recvWindow: RECV_WINDOW });
  const signature = sign(query, apiSecret);
  const fullQuery = `${query}&signature=${signature}`;

  const url = `${BINANCE_BASE_URL}${path}${method === "GET" || method === "DELETE" ? `?${fullQuery}` : ""}`;

  const res = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": apiKey,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? fullQuery : undefined,
  });

  const raw = await res.text();
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { raw };
  }

  if (!res.ok) {
    // Binance error bodies look like { code: -2010, msg: "..." }. Surface
    // the message but never log/echo the request signature or secret.
    const msg =
      typeof parsed === "object" && parsed && "msg" in (parsed as any)
        ? String((parsed as any).msg)
        : "Binance request failed";
    throw new AppError(res.status === 429 || res.status === 418 ? 429 : 502, msg, {
      code: "BINANCE_SIGNED_ERROR",
      details: parsed,
    });
  }

  return parsed as T;
}

export function isBinanceConfigured() {
  return Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
}