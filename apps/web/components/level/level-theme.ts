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

export function getLevelTheme(
  level: number,
): LevelTheme {
  const safeLevel = Math.max(
    1,
    level,
  );

  const tier = getTier(safeLevel);

  /*
   * Every level gets its own hue.
   *
   * This means Lv141 and Lv149 are both
   * Cosmic, but they do NOT look identical.
   */
  const hue =
    (safeLevel * 23) % 360;

  const saturation =
    safeLevel >= 100
      ? 85
      : 75;

  const lightness =
    safeLevel >= 120
      ? 65
      : 60;

  const primary = `hsl(${hue} ${saturation}% ${lightness}%)`;

  const secondary = `hsl(${(hue + 35) % 360} 90% 70%)`;

  const accent = `hsl(${(hue + 70) % 360} 95% 78%)`;

  const glow = `hsla(${hue}, 95%, 65%, 0.55)`;

  const background = `linear-gradient(
    135deg,
    hsl(${hue} 45% 15%),
    hsl(${(hue + 35) % 360} 35% 11%),
    #120E19
  )`;

  return {
    primary,
    secondary,
    accent,
    glow,
    background,

    tierName: tier.tierName,
    frameName: tier.frameName,

    crown: tier.crown,
    frame: tier.frame,

    intensity:
      safeLevel >= 150
        ? 1
        : Math.min(
            1,
            0.35 +
              safeLevel / 200,
          ),
  };
}