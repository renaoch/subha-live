import Link from "next/link";

import { HeadsetIcon } from "@/components/icons";

export function ProfileSupport() {
  return (
    <Link
      href="/support"
      className="flex items-center gap-3 rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-4 py-3.5 transition-colors hover:border-[#3A3050]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2A2238]">
        <HeadsetIcon className="h-4.5 w-4.5 text-[#D98FA0]" />
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#F3ECE0]">
          Need help? We&apos;re here.
        </p>

        <p className="truncate text-xs text-[#9088A0]">
          Reach support any time — usually replies in minutes.
        </p>
      </div>
    </Link>
  );
}