// File: components/agency/tab-button.tsx
"use client";

import type { ReactNode } from "react";

interface TabButtonProps {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}

export function TabButton({ active, children, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition",
        active ? "bg-white/[0.07] text-white" : "text-white/30 hover:text-white/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}