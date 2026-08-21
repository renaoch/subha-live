// File: components/agency/discover-panel.tsx
"use client";

import { Search, SearchX } from "lucide-react";
import type { Agency } from "@/lib/api/agency";
import { AgencyCard } from "./agency-card";

interface DiscoverPanelProps {
  agencies: Agency[];
  search: string;
  onSearchChange: (value: string) => void;
  joiningId: string | null;
  hasAgency: boolean;
  onJoin: (agency: Agency) => void;
}

export function DiscoverPanel({
  agencies,
  search,
  onSearchChange,
  joiningId,
  hasAgency,
  onJoin,
}: DiscoverPanelProps) {
  return (
    <section id="agency-list" className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">
            Creator networks
          </p>
          <h2 className="mt-1 text-xl font-black">Discover Agencies</h2>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search agencies..."
            className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#A855F7]/40"
          />
        </div>
      </div>

      {agencies.length === 0 ? (
        <div className="mt-6 rounded-[28px] border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-white/20">
            <SearchX className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-white/50">No agencies found</h3>
          <p className="mt-1 text-xs text-white/20">Try another search.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {agencies.map((agency) => (
            <AgencyCard
              key={agency.id}
              agency={agency}
              joining={joiningId === agency.id}
              hasAgency={hasAgency}
              onJoin={() => onJoin(agency)}
            />
          ))}
        </div>
      )}
    </section>
  );
}