import { Gem } from "lucide-react";
import { cn } from "@/lib/utils";

/** Purple gem + level pill shown before a chat name. */
export function LevelGem({ level, className }: { level: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-[3px] rounded-full px-1.5 py-[2px] align-middle text-[11px] font-bold leading-none text-white",
        className,
      )}
      style={{
        background: "linear-gradient(135deg,#9b3cf0 0%,#6a1fd0 100%)",
        boxShadow: "inset 0 0 0 1px rgba(214,170,255,0.45), 0 0 8px rgba(155,60,240,0.45)",
      }}
    >
      <Gem className="h-[11px] w-[11px] text-[#e9d2ff]" strokeWidth={2.4} />
      {level}
    </span>
  );
}
