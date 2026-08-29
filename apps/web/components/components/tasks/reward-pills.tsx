// File: components/tasks/reward-pills.tsx

import type { ReactNode } from "react";
import { Coins, Gem, Zap } from "lucide-react";

interface RewardPillsProps {
  coins: number;
  diamonds: number;
  exp: number;
  muted?: boolean;
}

export function RewardPills({ coins, diamonds, exp, muted }: RewardPillsProps) {
  const items: { icon: ReactNode; value: number; color: string }[] = [
    coins > 0 && { icon: <Coins className="h-3 w-3" />, value: coins, color: "#F5B93F" },
    diamonds > 0 && { icon: <Gem className="h-3 w-3" />, value: diamonds, color: "#57C2FF" },
    exp > 0 && { icon: <Zap className="h-3 w-3" />, value: exp, color: "#A86CFF" },
  ].filter(Boolean) as { icon: ReactNode; value: number; color: string }[];

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black"
          style={{
            color: muted ? "rgba(255,255,255,0.3)" : item.color,
            borderColor: muted ? "rgba(255,255,255,0.08)" : `${item.color}40`,
            background: muted ? "rgba(255,255,255,0.02)" : `${item.color}14`,
          }}
        >
          {item.icon}+{item.value.toLocaleString()}
        </span>
      ))}
    </div>
  );
}