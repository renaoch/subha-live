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
      className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-[#F5C96A]/40 bg-gradient-to-r from-[#F5C96A]/25 via-[#FF8A5B]/10 to-[#8B5CF6]/20 px-4 py-3.5 shadow-[0_10px_34px_rgba(245,201,106,0.18)] backdrop-blur-xl transition active:scale-[0.99]"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#F5C96A]/30 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFE29A] to-[#E0A030] shadow-[0_0_18px_rgba(245,201,106,0.55)]"><ShieldIcon className="h-5 w-5 text-[#3A2406]" /></span>

        <div>
          <p className="text-sm font-bold text-[#FFE29A]">
            {isVip ? "VIP active" : "Unlock VIP"}
          </p>

          <p className="text-xs text-[#D9CFE6]">
            Exclusive frames, badges &amp; privileges
          </p>
        </div>
      </div>

      <span className="relative shrink-0 rounded-full bg-gradient-to-r from-[#FFE29A] to-[#F5B93F] px-3.5 py-1.5 text-xs font-bold text-[#3A2406] shadow-[0_4px_14px_rgba(245,185,63,0.4)]">
        View
      </span>
    </Link>
  );
}