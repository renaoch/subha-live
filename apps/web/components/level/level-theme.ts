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

const tiers = [
  {
    min: 1,
    max: 9,
    tierName: "Rookie",
    frameName: "Silver Frame",
    crown: "none",
    frame: "basic",
  },
  {
    min: 10,
    max: 19,
    tierName: "Rising",
    frameName: "Aqua Frame",
    crown: "small",
    frame: "double",
  },
  {
    min: 20,
    max: 29,
    tierName: "Emerald",
    frameName: "Emerald Frame",
    crown: "small",
    frame: "double",
  },
  {
    min: 30,
    max: 39,
    tierName: "Sapphire",
    frameName: "Sapphire Crown",
    crown: "royal",
    frame: "royal",
  },
  {
    min: 40,
    max: 49,
    tierName: "Royal",
    frameName: "Royal Violet",
    crown: "royal",
    frame: "royal",
  },
  {
    min: 50,
    max: 59,
    tierName: "Imperial",
    frameName: "Imperial Wings",
    crown: "winged",
    frame: "celestial",
  },
  {
    min: 60,
    max: 69,
    tierName: "Dragon",
    frameName: "Dragon Frame",
    crown: "winged",
    frame: "dragon",
  },
  {
    min: 70,
    max: 79,
    tierName: "Inferno",
    frameName: "Inferno Crown",
    crown: "royal",
    frame: "dragon",
  },
  {
    min: 80,
    max: 89,
    tierName: "Celestial",
    frameName: "Celestial Halo",
    crown: "celestial",
    frame: "celestial",
  },
  {
    min: 90,
    max: 99,
    tierName: "Golden",
    frameName: "Golden Royal",
    crown: "royal",
    frame: "royal",
  },
  {
    min: 100,
    max: 109,
    tierName: "Platinum",
    frameName: "Platinum Aura",
    crown: "celestial",
    frame: "celestial",
  },
  {
    min: 110,
    max: 119,
    tierName: "Diamond",
    frameName: "Diamond Crown",
    crown: "celestial",
    frame: "celestial",
  },
  {
    min: 120,
    max: 129,
    tierName: "Aurora",
    frameName: "Aurora Frame",
    crown: "celestial",
    frame: "celestial",
  },
  {
    min: 130,
    max: 139,
    tierName: "Obsidian",
    frameName: "Obsidian Royal",
    crown: "royal",
    frame: "royal",
  },
  {
    min: 140,
    max: 149,
    tierName: "Cosmic",
    frameName: "Cosmic Crown",
    crown: "celestial",
    frame: "celestial",
  },
  {
    min: 150,
    max: 999,
    tierName: "Mythic",
    frameName: "Mythic Sovereign",
    crown: "celestial",
    frame: "mythic",
  },
] as const;

function getTier(level: number) {
  return (
    tiers.find(
      (tier) =>
        level >= tier.min &&
        level <= tier.max,
    ) ?? tiers[0]
  );
}

/** One cohesive palette per 10-level tier (no per-level random hues). */
const PALETTES = [
  { primary: "#D98F4E", secondary: "#F2B27A", accent: "#FFD9B3" }, // 1-10   bronze
  { primary: "#9FB0C4", secondary: "#C9D6E4", accent: "#EEF3F8" }, // 11-20  silver
  { primary: "#F2B134", secondary: "#FFD066", accent: "#FFEDB8" }, // 21-30  gold
  { primary: "#3DD6A0", secondary: "#7CF0C8", accent: "#C6FBE8" }, // 31-40  emerald
  { primary: "#4C9BFF", secondary: "#86BEFF", accent: "#CFE5FF" }, // 41-50  sapphire
  { primary: "#9B6CFF", secondary: "#BD9CFF", accent: "#E3D6FF" }, // 51-60  amethyst
  { primary: "#FF5C93", secondary: "#FF8FB5", accent: "#FFCCDD" }, // 61-70  rose
  { primary: "#FF7A45", secondary: "#FFA277", accent: "#FFD3BC" }, // 71-80  ember
  { primary: "#35D6E8", secondary: "#7AF0FF", accent: "#C4F9FF" }, // 81-90  aurora
  { primary: "#FFC857", secondary: "#FF7AA8", accent: "#FFF1C9" }, // 91+    mythic
] as const;

export function getLevelTheme(level: number): LevelTheme {
  const safeLevel = Math.max(1, level);
  const tier = getTier(safeLevel);
  const p = PALETTES[Math.min(PALETTES.length - 1, Math.floor((safeLevel - 1) / 10))];

  return {
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
    glow: `${p.primary}8C`,
    background: `radial-gradient(120% 80% at 50% 0%, ${p.primary}33, transparent 60%), #14111C`,

    tierName: tier.tierName,
    frameName: tier.frameName,
    crown: tier.crown,
    frame: tier.frame,

    intensity: safeLevel >= 100 ? 1 : Math.min(1, 0.35 + safeLevel / 200),
  };
}