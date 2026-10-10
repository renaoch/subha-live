// Edge-safe helpers for the admin gate (Web Crypto only — no Node APIs).
//
// The gate is two independent layers in front of /admin:
//   1. A secret ENTRY path (env ADMIN_ENTRY_PATH). Visiting /<entry> while
//      signed in as an admin sets a short-lived, HttpOnly, HMAC-signed cookie.
//      Without that cookie /admin/* answers 404, so the console is not even
//      discoverable by guessing /admin.
//   2. A server-side admin check on every /admin request: the Supabase session
//      is verified and the API confirms profiles.is_admin. Non-admins get 404.
// The real authority is still the API: every admin write re-checks is_admin.

export const GATE_COOKIE = "adm_gate";
export const GATE_TTL_SECONDS = 60 * 60 * 8; // 8h

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Length-independent comparison so a wrong cookie leaks nothing via timing. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Cookie value bound to one user and an expiry: `<exp>.<hmac(userId|exp)>`. */
export async function signGate(secret: string, userId: string, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + GATE_TTL_SECONDS;
  return `${exp}.${await hmac(secret, `${userId}|${exp}`)}`;
}

export async function verifyGate(
  secret: string,
  userId: string,
  cookie: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!cookie) return false;
  const [expRaw, sig] = cookie.split(".");
  const exp = Number(expRaw);
  if (!sig || !Number.isInteger(exp) || exp * 1000 <= now) return false;
  return safeEqual(sig, await hmac(secret, `${userId}|${exp}`));
}