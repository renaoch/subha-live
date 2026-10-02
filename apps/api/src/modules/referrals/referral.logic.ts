// Referral pure logic — code generation validation + reward constant. The
// code alphabet avoids ambiguous characters (no 0/O/1/I). Generation itself
// needs crypto, so it lives in the service; this file holds the deterministic
// pieces for testing.

export const REFERRAL_REWARD_COINS = 100;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** Generate a referral code from a byte source (injected for tests). */
export function codeFromBytes(bytes: Uint8Array): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[bytes[i % bytes.length] % CODE_ALPHABET.length];
  }
  return code;
}

/** Validate an incoming referral code shape before any DB lookup. */
export function isValidCodeShape(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  for (const ch of code) {
    if (!CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}
