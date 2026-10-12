import { LevelBadge } from "@/components/level/LevelBadge";

/** Level tag shown before a chat name. Styled per tier (see lib/level-tiers.ts). */
export function LevelGem({ level, className }: { level: number; className?: string }) {
  return <LevelBadge level={level} className={className} />;
}