"use client";

import { motion } from "framer-motion";
import {
  BadgeCheck,
  Crown,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HostVerification } from "@/lib/api/trading";

interface HostCardProps {
  host: HostVerification;
  onClear: () => void;
}

export function HostCard({ host, onClear }: HostCardProps) {
  const initials = (host.name || host.handle || "?").trim().slice(0, 1).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="relative overflow-hidden rounded-3xl border border-[#2A2238] bg-gradient-to-b from-[#241C33] to-[#1A1424] p-5"
    >
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear host"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-4">
        {host.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={host.avatar}
            alt={host.name}
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-[#CBA35C]/40"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2A2238] text-xl font-black text-[#CBA35C] ring-2 ring-[#CBA35C]/40">
            {initials}
          </div>
        )}

        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-white">{host.name}</h3>
          <p className="mt-0.5 text-sm text-white/45">ID: {host.publicId ?? host.handle}</p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {host.isHost && <Tag icon={Crown} label="HOST" />}
            {host.isVerified && <Tag icon={BadgeCheck} label="VERIFIED" />}
            {host.isAgencyMember && <Tag icon={Users} label="AGENCY MEMBER" />}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold",
          host.eligible
            ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20"
            : "bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/20",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            host.eligible ? "bg-emerald-400" : "bg-rose-400",
          )}
        />
        {host.eligible
          ? "Eligible for Agency Payment"
          : "This host is not eligible for Agency payments"}
      </div>
    </motion.div>
  );
}

function Tag({ icon: Icon, label }: { icon: typeof Crown; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#2A2238] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#D9D2E0]">
      <Icon className="h-3 w-3 text-[#CBA35C]" />
      {label}
    </span>
  );
}
