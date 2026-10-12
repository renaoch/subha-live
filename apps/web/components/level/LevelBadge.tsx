import { Crown, Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLevelTier } from "@/lib/level-tiers";

/**
 * The one level tag used everywhere (chat, join/gift rows, profile popup,
 * contributors…). Look is driven by the level's tier — see lib/level-tiers.ts.
 */
export function LevelBadge({
  level,
  className,
  prefix,
}: {
  level: number;
  className?: string;
  /** Optional text before the number, e.g. "Lv." */
  prefix?: string;
}) {
  const tier = getLevelTier(level);
  const isCrown = tier.fx === "crown";
  const Icon = isCrown ? Crown : Gem;
  const sparkles = tier.fx === "spark" || tier.fx === "flame" || isCrown;

  return (
    <span
      className={cn(
        "lvl-badge px-1.5 py-[2px] text-[11px]",
        `lvl-fx-${tier.fx}`,
        isCrown && "text-[12px]",
        className,
      )}
      style={
        {
          "--lv-from": tier.gemFrom,
          "--lv-to": tier.gemTo,
          "--lv-fg": tier.fg,
          "--lv-glow": tier.glow,
        } as React.CSSProperties
      }
      title={`${tier.name} · Level ${level}`}
      data-tier={tier.name}
    >
      <Icon className="h-[11px] w-[11px]" strokeWidth={2.4} />
      <span>
        {prefix}
        {level}
      </span>
      {sparkles ? (
        <>
          <i className="lvl-spark s1" />
          <i className="lvl-spark s2" />
          {isCrown ? <i className="lvl-spark s3" /> : null}
        </>
      ) : null}
    </span>
  );
}