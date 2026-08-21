// File: components/agency/agency-card.tsx
"use client";

import { Percent, TrendingUp, Users } from "lucide-react";
import type { Agency } from "@/lib/api/agency";
import { formatCompact } from "@/lib/format";
import { StatTile } from "./stat-tile";

interface AgencyCardProps {
  agency: Agency;
  joining: boolean;
  hasAgency: boolean;
  onJoin: () => void;
}

export function AgencyCard({ agency, joining, hasAgency, onJoin }: AgencyCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#15111B] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#A855F7]/20 hover:bg-[#18131F]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#A855F7]/[0.07] blur-3xl transition group-hover:bg-[#A855F7]/10" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#A855F7]/20 bg-gradient-to-br from-[#A855F7]/20 to-[#F59E0B]/10 text-lg font-black text-[#D8B4FE]">
              {agency.name.trim().charAt(0).toUpperCase() || "?"}
            </div>

            <div className="min-w-0">
              <h3 className="truncate font-black text-white">{agency.name}</h3>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/25">
                #{agency.code}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-full border border-emerald-400/10 bg-emerald-400/[0.06] px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300/70">
            Active
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <StatTile
            size="sm"
            icon={<Users className="h-2.5 w-2.5" />}
            label="Hosts"
            value={String(agency.totalHosts)}
          />
          <StatTile
            size="sm"
            icon={<TrendingUp className="h-2.5 w-2.5" />}
            label="Revenue"
            value={`\u20b9${formatCompact(agency.monthlyRevenue)}`}
          />
          <StatTile
            size="sm"
            icon={<Percent className="h-2.5 w-2.5" />}
            label="Commission"
            value={`${agency.commissionRate}%`}
          />
        </div>

        <button
          type="button"
          disabled={joining || hasAgency}
          onClick={onJoin}
          className={[
            "mt-4 w-full rounded-2xl py-3 text-xs font-black transition",
            hasAgency
              ? "cursor-not-allowed bg-white/[0.04] text-white/20"
              : joining
                ? "cursor-wait bg-white/70 text-black"
                : "bg-white text-black hover:bg-[#F8F1E6]",
          ].join(" ")}
        >
          {joining ? "Requesting..." : hasAgency ? "Already in an agency" : "Request to Join"}
        </button>
      </div>
    </article>
  );
}