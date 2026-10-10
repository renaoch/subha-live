import { Cpu } from "lucide-react";
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


/**
 * The Engineer badge — platform staff only. It is deliberately unlike every
 * other tag: black glass, a live holographic border that never stops moving,
 * a light sheen sweeping across, a pulsing aura and a twinkling star. Nothing
 * you can buy or earn looks like it, so when people see it they know.
 *
 * Purely visual: whether someone gets it is decided on the server from
 * profiles.is_admin (see getChatProfile), never from anything the client sends.
 */
function EngineerTag({ className }: { className?: string }) {
  return (
    <span className="eng-tag relative inline-flex shrink-0 select-none rounded-full p-[1.5px]" title="Engineer · platform staff" aria-label="Engineer, platform staff">
      <span className={cn("eng-inner relative inline-flex items-center gap-[3px] overflow-hidden rounded-full px-2 py-[3px] text-[10.5px] leading-none", className)}>
        <Cpu className="eng-icon h-[1.05em] w-[1.05em] shrink-0" strokeWidth={2.4} />
        <span className="eng-text font-black uppercase tracking-[0.12em]">Engineer</span>
        <span className="eng-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/3" aria-hidden />
      </span>
      <span className="eng-star pointer-events-none absolute -right-[3px] -top-[4px] text-[7px] leading-none" aria-hidden>
        ✦
      </span>

      <style jsx global>{`
        .eng-tag {
          background: linear-gradient(110deg, #7c3aed, #22d3ee, #f0abfc, #facc15, #7c3aed);
          background-size: 300% 100%;
          animation: eng-border 4s linear infinite, eng-aura 2.4s ease-in-out infinite;
        }
        .eng-inner {
          background: radial-gradient(130% 160% at 15% 0%, #2b1260 0%, #0b0618 62%, #05030d 100%);
        }
        .eng-icon {
          color: #c4b5fd;
          filter: drop-shadow(0 0 3px rgba(167, 139, 250, 0.9));
        }
        .eng-text {
          background: linear-gradient(100deg, #ffffff 0%, #e9d5ff 28%, #67e8f9 50%, #e9d5ff 72%, #ffffff 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: eng-text 3.2s linear infinite;
        }
        .eng-sheen {
          background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.55), transparent);
          transform: skewX(-20deg);
          animation: eng-sheen 3.6s ease-in-out 0.6s infinite;
        }
        .eng-star {
          color: #fff;
          text-shadow: 0 0 4px #67e8f9, 0 0 8px #a78bfa;
          animation: eng-twinkle 2.2s ease-in-out infinite;
        }
        @keyframes eng-border { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
        @keyframes eng-aura {
          0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.65), 0 0 12px rgba(34, 211, 238, 0.28); }
          50%      { box-shadow: 0 0 9px rgba(167, 139, 250, 0.95), 0 0 22px rgba(34, 211, 238, 0.55), 0 0 34px rgba(240, 171, 252, 0.3); }
        }
        @keyframes eng-text { 0% { background-position: 0% 50%; } 100% { background-position: 250% 50%; } }
        @keyframes eng-sheen { 0% { left: -50%; opacity: 0; } 15% { opacity: 1; } 55%, 100% { left: 130%; opacity: 0; } }
        @keyframes eng-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.6) rotate(0deg); }
          50%      { opacity: 1;    transform: scale(1.25) rotate(45deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .eng-tag, .eng-text, .eng-sheen, .eng-star { animation: none; }
        }
      `}</style>
    </span>
  );
}

/** Badge labels after a name, e.g. ["SVIP", "Agency Owner"]. Renders nothing when empty. */
export function UserTags({ tags, className }: { tags?: string[]; className?: string }) {
  const list = (tags ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 3);
  if (list.length === 0) return null;
  return (
    <>
      {list.map((tag) =>
        tag.trim().toLowerCase() === "engineer" ? (
          <EngineerTag key={tag} className={className} />
        ) : (
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
        ),
      )}
    </>
  );
}