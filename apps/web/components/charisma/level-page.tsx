export interface CharismaTheme {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  background: string;

  tierName: string;

  intensity: number;
}

const tiers = [
  { min: 1, max: 9, tierName: "Newcomer" },
  { min: 10, max: 19, tierName: "Charming" },
  { min: 20, max: 29, tierName: "Magnetic" },
  { min: 30, max: 39, tierName: "Radiant" },
  { min: 40, max: 49, tierName: "Enchanting" },
  { min: 50, max: 59, tierName: "Captivating" },
  { min: 60, max: 69, tierName: "Mesmerizing" },
  { min: 70, max: 79, tierName: "Bewitching" },
  { min: 80, max: 89, tierName: "Luminous" },
  { min: 90, max: 99, tierName: "Resplendent" },
  { min: 100, max: 109, tierName: "Ethereal" },
  { min: 110, max: 119, tierName: "Transcendent" },
  { min: 120, max: 129, tierName: "Celestial" },
  { min: 130, max: 139, tierName: "Divine" },
  { min: 140, max: 149, tierName: "Immortal" },
  { min: 150, max: 999, tierName: "Eternal Icon" },
] as const;

function getTier(level: number) {
  return (
    tiers.find(
      (tier) => level >= tier.min && level <= tier.max,
    ) ?? tiers[0]
  );
}

export function getCharismaTheme(
  level: number,
): CharismaTheme {
  const safeLevel = Math.max(1, level);

  const tier = getTier(safeLevel);

  /*
   * Warm rose -> gold spectrum, intentionally distinct from the
   * level system's violet/amber so the two tabs read as related
   * but separate currencies at a glance.
   */
  const hue = (340 + safeLevel * 11) % 360;

  const saturation = safeLevel >= 100 ? 88 : 78;

  const lightness = safeLevel >= 120 ? 66 : 60;

  const primary = `hsl(${hue} ${saturation}% ${lightness}%)`;

  const secondary = `hsl(${(hue + 28) % 360} 92% 72%)`;

  const accent = `hsl(${(hue + 55) % 360} 95% 80%)`;

  const glow = `hsla(${hue}, 95%, 65%, 0.5)`;

  const background = `linear-gradient(
    135deg,
    hsl(${hue} 45% 16%),
    hsl(${(hue + 28) % 360} 35% 12%),
    #120E19
  )`;

  return {
    primary,
    secondary,
    accent,
    glow,
    background,

    tierName: tier.tierName,

    intensity:
      safeLevel >= 150
        ? 1
        : Math.min(1, 0.35 + safeLevel / 200),
  };
}