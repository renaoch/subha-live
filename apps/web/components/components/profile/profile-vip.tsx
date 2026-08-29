import Link from "next/link";

import { ShieldIcon } from "@/components/icons";

interface ProfileVipProps {
  isVip: boolean;
}

export function ProfileVip({
  isVip,
}: ProfileVipProps) {
  return (
    <Link
      href="/vip"
      className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-[#CBA35C]/30 bg-gradient-to-r from-[#241D1A] to-[#1D1829] px-4 py-3.5 transition-colors hover:border-[#CBA35C]/50"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#CBA35C]/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-3">
        <ShieldIcon className="h-6 w-6 text-[#CBA35C]" />

        <div>
          <p className="text-sm font-semibold text-[#CBA35C]">
            {isVip ? "VIP active" : "Unlock VIP"}
          </p>

          <p className="text-xs text-[#9088A0]">
            Exclusive frames, badges &amp; privileges
          </p>
        </div>
      </div>

      <span className="relative shrink-0 rounded-full border border-[#CBA35C]/40 px-3 py-1.5 text-xs font-medium text-[#CBA35C] transition-colors group-hover:bg-[#CBA35C]/10">
        View
      </span>
    </Link>
  );
}