/**
 * Single source of truth for level styling.
 *
 * Theme: "Jewel King" — every tier is a different royal gemstone set in gold.
 * A tier covers 10 levels, so the visual changes at 10, 20, 30 … 90, and
 * level 100 is its own one-of-a-kind "Crown Jewel" tier.
 *
 *   1–9 Pearl · 10–19 Topaz · 20–29 Emerald · 30–39 Aquamarine · 40–49 Sapphire
 *   50–59 Amethyst · 60–69 Ruby · 70–79 Opal · 80–89 Diamond
 *   90–99 Black Diamond · 100 Crown Jewel
 *
 * Every component that shows a level (chat tag, profile, contributors, level
 * page, rewards path) reads from here, so a level always looks the same
 * everywhere.
 */

export type LevelFx = "none" | "shine" | "pulse" | "spark" | "prism" | "flame" | "crown";

export interface LevelTier {
  /** 0..10 */
  index: number;
  /** First and last level of the tier. */
  min: number;
  max: number;
  /** Gemstone name, also used as the level title. */
  name: string;
  /** Rank wording shown on the level page. */
  frameName: string;
  /** Main gem colour (also the accent colour used by progress bars etc.). */
  primary: string;
  secondary: string;
  accent: string;
  /** Rgba glow used for box-shadows. */
  glow: string;
  /** Dark → bright gem body gradient used on tags. */
  gemFrom: string;
  gemTo: string;
  /** Text colour on top of the gem. */
  fg: string;
  /** Visual effect level of the tag. */
  fx: LevelFx;
  crown: "none" | "small" | "royal" | "winged" | "celestial";
  frame: "basic" | "double" | "royal" | "dragon" | "celestial" | "mythic";
}

export const MAX_LEVEL = 100;
export const CROWN_JEWEL_LEVEL = 100;

export const LEVEL_TIERS: readonly LevelTier[] = [
  {
    index: 0, min: 1, max: 9, name: "Pearl", frameName: "Pearl & Gold",
    primary: "#E9D8B4", secondary: "#F6EBD2", accent: "#FFF8E6", glow: "rgba(233,216,180,0.45)",
    gemFrom: "#CDB68C", gemTo: "#F7EEDA", fg: "#4A3410", fx: "none", crown: "none", frame: "basic",
  },
  {
    index: 1, min: 10, max: 19, name: "Topaz", frameName: "Imperial Topaz",
    primary: "#FFB52E", secondary: "#FFD06B", accent: "#FFE9B0", glow: "rgba(255,181,46,0.5)",
    gemFrom: "#B86A00", gemTo: "#FFC83D", fg: "#3A1E00", fx: "shine", crown: "small", frame: "double",
  },
  {
    index: 2, min: 20, max: 29, name: "Emerald", frameName: "Emerald Regal",
    primary: "#2FD98C", secondary: "#6EF0B4", accent: "#C2FBE0", glow: "rgba(47,217,140,0.5)",
    gemFrom: "#07553A", gemTo: "#22C985", fg: "#EAFFF5", fx: "shine", crown: "small", frame: "double",
  },
  {
    index: 3, min: 30, max: 39, name: "Aquamarine", frameName: "Aquamarine Crown",
    primary: "#3FE3D4", secondary: "#86F2E8", accent: "#CCFCF7", glow: "rgba(63,227,212,0.5)",
    gemFrom: "#0A6F80", gemTo: "#3FE3D4", fg: "#03262B", fx: "shine", crown: "royal", frame: "royal",
  },
  {
    index: 4, min: 40, max: 49, name: "Sapphire", frameName: "Royal Sapphire",
    primary: "#4C86FF", secondary: "#86AFFF", accent: "#CFE0FF", glow: "rgba(76,134,255,0.55)",
    gemFrom: "#102A78", gemTo: "#3F7BFF", fg: "#FFFFFF", fx: "pulse", crown: "royal", frame: "royal",
  },
  {
    index: 5, min: 50, max: 59, name: "Amethyst", frameName: "Amethyst Majesty",
    primary: "#B26CFF", secondary: "#CFA0FF", accent: "#EBD8FF", glow: "rgba(178,108,255,0.55)",
    gemFrom: "#41157F", gemTo: "#A55BF5", fg: "#FFFFFF", fx: "pulse", crown: "winged", frame: "celestial",
  },
  {
    index: 6, min: 60, max: 69, name: "Ruby", frameName: "Blood Ruby",
    primary: "#FF3E62", secondary: "#FF7A93", accent: "#FFC2CD", glow: "rgba(255,62,98,0.58)",
    gemFrom: "#6E0820", gemTo: "#F03253", fg: "#FFFFFF", fx: "spark", crown: "winged", frame: "dragon",
  },
  {
    index: 7, min: 70, max: 79, name: "Opal", frameName: "Fire Opal",
    primary: "#FF9FD6", secondary: "#9BE8FF", accent: "#FFEBA8", glow: "rgba(255,159,214,0.6)",
    gemFrom: "#FF8FCB", gemTo: "#8FE6FF", fg: "#3A1450", fx: "prism", crown: "royal", frame: "dragon",
  },
  {
    index: 8, min: 80, max: 89, name: "Diamond", frameName: "Flawless Diamond",
    primary: "#9BD8FF", secondary: "#D4F0FF", accent: "#FFFFFF", glow: "rgba(155,216,255,0.65)",
    gemFrom: "#6FA9DC", gemTo: "#F2FAFF", fg: "#0A2C4D", fx: "spark", crown: "celestial", frame: "celestial",
  },
  {
    index: 9, min: 90, max: 99, name: "Black Diamond", frameName: "Black Diamond Sovereign",
    primary: "#FFC93C", secondary: "#FFE08A", accent: "#FFF3C4", glow: "rgba(255,201,60,0.7)",
    gemFrom: "#050507", gemTo: "#2A2530", fg: "#FFD86B", fx: "flame", crown: "royal", frame: "mythic",
  },
  {
    index: 10, min: 100, max: 100, name: "Crown Jewel", frameName: "The Crown Jewel",
    primary: "#FFD24A", secondary: "#FF7AD1", accent: "#FFFFFF", glow: "rgba(255,210,74,0.85)",
    gemFrom: "#3B0A6B", gemTo: "#FFB400", fg: "#FFFFFF", fx: "crown", crown: "celestial", frame: "mythic",
  },
] as const;

/** 1–9 → 0, 10–19 → 1 … 90–99 → 9, 100+ → 10. */
export function getLevelTierIndex(level: number): number {
  const l = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  if (l >= CROWN_JEWEL_LEVEL) return 10;
  return Math.floor(l / 10);
}

export function getLevelTier(level: number): LevelTier {
  return LEVEL_TIERS[getLevelTierIndex(level)];
}