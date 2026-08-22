"use client";

import { useState } from "react";
import { Gift, Sparkles, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface TabProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  count: number;
  onClick: () => void;
}

function Tab({ active, label, icon, count, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-1 items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5
        text-sm font-bold transition-all duration-300
        ${active
          ? "bg-white/10 text-white shadow-[0_0_30px_rgba(168,108,255,0.15)]"
          : "text-white/30 hover:bg-white/5 hover:text-white/60"
        }
      `}
    >
      {icon}
      <span>{label}</span>
      <span
        className={`
          rounded-full px-2.5 py-0.5 text-[9px] font-black
          ${active
            ? "bg-violet-400/20 text-violet-300"
            : "bg-white/5 text-white/30"
          }
        `}
      >
        {count}
      </span>
      {active && (
        <div className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-400 to-amber-300" />
      )}
    </button>
  );
}

interface LevelTabsProps {
  incomingCount: number;
  outgoingCount: number;
  activeTab: "incoming" | "outgoing";
  onTabChange: (tab: "incoming" | "outgoing") => void;
  children: React.ReactNode;
}

export function LevelTabs({
  incomingCount,
  outgoingCount,
  activeTab,
  onTabChange,
  children,
}: LevelTabsProps) {
  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="relative rounded-2xl border border-white/5 bg-white/[0.03] p-1">
        <Tab
          active={activeTab === "incoming"}
          label="Incoming"
          icon={<ArrowDownLeft className="h-4 w-4" />}
          count={incomingCount}
          onClick={() => onTabChange("incoming")}
        />
        <Tab
          active={activeTab === "outgoing"}
          label="Outgoing"
          icon={<ArrowUpRight className="h-4 w-4" />}
          count={outgoingCount}
          onClick={() => onTabChange("outgoing")}
        />
      </div>

      {/* Content */}
      <div className="transition-all duration-300">
        {children}
      </div>
    </div>
  );
}