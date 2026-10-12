import { getLevelTier } from "@/lib/level-tiers";

export interface LevelTheme {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  background: string;

  tierName: string;
  frameName: string;

  crown: "none" | "small" | "royal" | "winged" | "celestial";
  frame: "basic" | "double" | "royal" | "dragon" | "celestial" | "mythic";

  intensity: number;
}

export function getLevelTheme(level: number): LevelTheme {
  const safeLevel = Math.max(1, level);
  const t = getLevelTier(safeLevel);

  return {
    primary: t.primary,
    secondary: t.secondary,
    accent: t.accent,
    glow: t.glow,
    background: `radial-gradient(120% 80% at 50% 0%, ${t.primary}38, transparent 60%), #120E0A`,

    tierName: t.name,
    frameName: t.frameName,
    crown: t.crown,
    frame: t.frame,

    intensity: safeLevel >= 100 ? 1 : Math.min(1, 0.35 + safeLevel / 200),
  };
}