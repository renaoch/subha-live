import Link from "next/link";

import { HeadsetIcon } from "@/components/icons";

export function ProfileSupport() {
  return (
    <Link
      href="/support"
      className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl px-4 py-3.5 transition-colors active:scale-[0.99]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
        <HeadsetIcon className="h-4.5 w-4.5 text-[#D98FA0]" />
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#F3ECE0]">
          Need help? We&apos;re here.
        </p>

        <p className="truncate text-xs text-[#B7AECB]">
          Reach support any time — usually replies in minutes.
        </p>
      </div>
    </Link>
  );
}