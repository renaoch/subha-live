// File: components/agency/agency-hero.tsx
"use client";

import { Building2, Sparkles } from "lucide-react";
import type { Agency } from "@/lib/api/agency";
import { formatCompact } from "@/lib/format";
import { StatTile } from "./stat-tile";

interface AgencyHeroProps {
  myAgency: Agency | null;
  onManage: () => void;
  onExplore: () => void;
  onApply: () => void;
}

export function AgencyHero({ myAgency, onManage, onExplore, onApply }: AgencyHeroProps) {
  if (myAgency) {
    return (
      <section className="relative mt-8 overflow-hidden rounded-[32px] border border-[#D9A94A]/20 bg-gradient-to-br from-[#2A1D0C] via-[#18131D] to-[#100D15] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.3)]">
        <div className="pointer-events-none absolute right-[-100px] top-[-100px] h-72 w-72 rounded-full bg-[#F59E0B]/10 blur-[90px]" />

        <div className="relative">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] border border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F5C36B] shadow-[0_0_35px_rgba(245,158,11,0.15)]">
                <Building2 className="h-8 w-8" />
              </div>

              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#F59E0B]/60">
                  Your Agency
                </p>
                <h2 className="mt-1 truncate text-2xl font-black">{myAgency.name}</h2>
                <p className="mt-1 text-xs text-white/30">
                  Code ·{" "}
                  <span className="font-bold text-white/50">{myAgency.code}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onManage}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.07]"
            >
              Manage Agency
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <StatTile label="Hosts" value={String(myAgency.totalHosts)} />
            <StatTile
              label="Revenue"
              value={`\u20b9${formatCompact(myAgency.monthlyRevenue)}`}
            />
            <StatTile label="Commission" value={`${myAgency.commissionRate}%`} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mt-8 overflow-hidden rounded-[32px] border border-[#A855F7]/15 bg-gradient-to-br from-[#1D1429] via-[#15111B] to-[#0E0B12] p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#A855F7]/10 blur-[90px]" />

      <div className="relative max-w-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#A855F7]/10 text-[#D8B4FE]">
          <Sparkles className="h-5 w-5" />
        </div>

        <h2 className="mt-5 text-2xl font-black">You&apos;re independent.</h2>

        <p className="mt-2 text-sm leading-6 text-white/35">
          Join an existing agency and connect with creators, or apply to create your own agency.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onExplore}
            className="rounded-2xl bg-[#A855F7] px-5 py-3 text-xs font-black text-white shadow-[0_10px_30px_rgba(168,85,247,0.2)] transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Explore Agencies
          </button>

          <button
            type="button"
            onClick={onApply}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-xs font-bold text-white/60 transition hover:bg-white/[0.06]"
          >
            Apply for Agency
          </button>
        </div>
      </div>
    </section>
  );
}