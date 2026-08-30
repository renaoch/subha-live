"use client";

import { Settings } from "lucide-react";

export default function AdminOthersPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-dashed border-[#2A2238] px-6 py-16 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/5">
          <Settings className="h-5 w-5 text-[#9088A0]" />
        </div>
        <p className="text-sm font-bold text-white/60">More admin tools coming soon</p>
        <p className="mt-1 text-xs text-white/30">
          Platform settings, moderation, and other tools will live here.
        </p>
      </div>
    </div>
  );
}
