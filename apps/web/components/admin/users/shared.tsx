import { BadgeCheck, Crown, ShieldCheck } from "lucide-react";
import type { BanInfo } from "@/lib/api/admin-users";

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export const num = (n: number) => n.toLocaleString();

/** Compact status pill: Active / Banned (temporary, until …) / Banned (permanent). */
export function StatusBadge({ ban }: { ban: BanInfo | null }) {
  if (!ban) {
    return <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">Active</span>;
  }
  return ban.permanent ? (
    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300">Banned · permanent</span>
  ) : (
    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
      Banned · until {fmtDay(ban.until)}
    </span>
  );
}

export function UserBadges({ isAdmin, isVerified, svip, vipLevel }: { isAdmin: boolean; isVerified: boolean; svip: boolean; vipLevel: number }) {
  return (
    <>
      {isAdmin && (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
          <ShieldCheck className="h-3 w-3" /> Admin
        </span>
      )}
      {isVerified && <BadgeCheck className="h-4 w-4 text-[#ffc83d]" aria-label="Verified" />}
      {(svip || vipLevel > 0) && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#b8860b]/25 px-1.5 py-0.5 text-[10px] font-bold text-[#ffd76a]">
          <Crown className="h-3 w-3" /> {svip ? "SVIP" : `VIP ${vipLevel}`}
        </span>
      )}
    </>
  );
}
