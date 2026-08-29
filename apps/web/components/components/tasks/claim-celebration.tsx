// File: components/tasks/claim-celebration.tsx
"use client";

import { useEffect } from "react";
import { PartyPopper } from "lucide-react";
import { RewardPills } from "./reward-pills";

interface ClaimCelebrationProps {
  coins: number;
  diamonds: number;
  exp: number;
  onDismiss: () => void;
}

export function ClaimCelebration({ coins, diamonds, exp, onDismiss }: ClaimCelebrationProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2600);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="tk-celebrate flex items-center gap-3 rounded-2xl border border-[#F5B93F]/40 bg-[#1B1424] px-5 py-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5B93F]/15 text-[#F5B93F]">
          <PartyPopper className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-black text-white">Reward claimed!</p>
          <div className="mt-1">
            <RewardPills coins={coins} diamonds={diamonds} exp={exp} />
          </div>
        </div>
      </div>
    </div>
  );
}