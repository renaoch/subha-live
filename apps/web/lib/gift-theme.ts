// lib/gift-theme.ts
//
// One place that decides how each KIND of gift looks when it lands: its
// motion, glow colour and sparkle emojis. Used by the chat row (GiftRow) and
// the full-screen send animation, so a Rocket always launches, a Rose always
// blooms, a Teddy always bounces — and anything we don't know about still gets
// a sensible look from its price.

export type GiftMotion = "float" | "launch" | "bloom" | "bounce" | "sway" | "spin" | "royal" | "drive";

export interface GiftTheme {
  motion: GiftMotion;
  /** "r, g, b" — plugs into rgba(var(--glow), a). */
  glow: string;
  /** Five emojis shed around the art. */
  sparks: [string, string, string, string, string];
}

interface Rule {
  match: RegExp;
  theme: GiftTheme;
}

// Order matters: first match wins. Matched against "code icon name".
const RULES: Rule[] = [
  { match: /rocket|jet|plane|ufo/, theme: { motion: "launch", glow: "255, 120, 40", sparks: ["🔥", "✨", "💨", "⭐", "🚀"] } },
  { match: /rose|flower|bouquet|tulip|lotus/, theme: { motion: "bloom", glow: "255, 40, 90", sparks: ["🌹", "🌸", "✨", "💖", "🌹"] } },
  { match: /teddy|bear|panda|plush/, theme: { motion: "bounce", glow: "255, 170, 60", sparks: ["🧸", "💕", "✨", "🎀", "💖"] } },
  { match: /heart|love|kiss/, theme: { motion: "bounce", glow: "255, 60, 140", sparks: ["💖", "💗", "💕", "💘", "💖"] } },
  { match: /perfume|scent|cologne/, theme: { motion: "sway", glow: "190, 100, 255", sparks: ["✨", "💜", "💨", "🫧", "✨"] } },
  { match: /crown|king|queen|throne/, theme: { motion: "royal", glow: "255, 200, 50", sparks: ["👑", "✨", "⭐", "💎", "✨"] } },
  { match: /car|sports|bike|truck/, theme: { motion: "drive", glow: "70, 170, 255", sparks: ["💨", "⚡", "✨", "🏁", "💨"] } },
  { match: /yacht|ship|boat/, theme: { motion: "sway", glow: "50, 200, 255", sparks: ["🌊", "💦", "✨", "⚓", "🌊"] } },
  { match: /diamond|gem|ring|jewel/, theme: { motion: "spin", glow: "110, 220, 255", sparks: ["💎", "✨", "💠", "⭐", "✨"] } },
  { match: /star|moon|sun/, theme: { motion: "spin", glow: "255, 210, 60", sparks: ["⭐", "🌟", "✨", "💫", "⭐"] } },
];

const BY_PRICE: Array<{ upTo: number; theme: GiftTheme }> = [
  { upTo: 100, theme: { motion: "float", glow: "255, 60, 130", sparks: ["✨", "💖", "⭐", "✨", "💫"] } },
  { upTo: 1000, theme: { motion: "bounce", glow: "255, 130, 60", sparks: ["✨", "🎉", "⭐", "💫", "✨"] } },
  { upTo: 5000, theme: { motion: "spin", glow: "255, 200, 60", sparks: ["⭐", "🌟", "✨", "💫", "⭐"] } },
  { upTo: Infinity, theme: { motion: "royal", glow: "180, 90, 255", sparks: ["👑", "💎", "✨", "🌟", "💜"] } },
];

export function getGiftTheme(gift: { code?: string | null; icon?: string | null; name?: string | null }, coinPrice?: number): GiftTheme {
  const hay = `${gift.code ?? ""} ${gift.icon ?? ""} ${gift.name ?? ""}`.toLowerCase();
  const hit = RULES.find((r) => r.match.test(hay));
  if (hit) return hit.theme;
  const price = coinPrice ?? 0;
  return (BY_PRICE.find((p) => price <= p.upTo) ?? BY_PRICE[0]).theme;
}

/** How loud a send is: scales glow, sparks and ring effects. */
export type GiftIntensity = "base" | "hot" | "mega";

export function getGiftIntensity(quantity: number, coinPrice?: number): GiftIntensity {
  const total = (coinPrice ?? 0) * Math.max(1, quantity);
  if (quantity >= 50 || total >= 20_000) return "mega";
  if (quantity >= 10 || total >= 2_000) return "hot";
  return "base";
}