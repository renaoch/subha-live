import { cn } from "@/lib/utils";

// Flat, solid chips. Colour is chosen by what the tag means, not by who sent it.
function toneFor(tag: string): string {
  const t = tag.toLowerCase();
  if (t.includes("svip")) return "bg-[#b8860b]/35 text-[#ffd76a]";
  if (t.includes("vip")) return "bg-[#d2691e]/35 text-[#ffb27a]";
  if (t.includes("admin")) return "bg-[#d63a3a]/35 text-[#ff9a9a]";
  if (t.includes("agency") || t.includes("owner") || t.includes("agent")) return "bg-[#2f6fdb]/35 text-[#9cc4ff]";
  if (t.includes("host")) return "bg-[#d6336c]/35 text-[#ff9ec0]";
  return "bg-white/15 text-white/80";
}

/** Badge labels after a name, e.g. ["SVIP", "Agency Owner"]. Renders nothing when empty. */
export function UserTags({ tags, className }: { tags?: string[]; className?: string }) {
  const list = (tags ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 3);
  if (list.length === 0) return null;
  return (
    <>
      {list.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-1.5 py-[2px] text-[10.5px] font-semibold leading-none",
            toneFor(tag),
            className,
          )}
        >
          {tag}
        </span>
      ))}
    </>
  );
}
