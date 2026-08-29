"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SocialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  variant?: "solid" | "outline";
}

export const SocialButton = React.forwardRef<HTMLButtonElement, SocialButtonProps>(
  ({ icon, label, loading, variant = "outline", className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={cn(
          "relative flex w-full items-center justify-center gap-3 rounded-xl px-5 py-3.5",
          "text-sm font-medium transition-all duration-200 focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          "disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.98]",
          variant === "outline" &&
            "border border-border bg-surface-raised text-ink hover:border-accent/40 hover:bg-surface-raised/80",
          variant === "solid" &&
            "bg-gradient-to-r from-accent to-accent-hot text-white shadow-panel hover:brightness-110",
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
        )}
        <span>{loading ? "Connecting…" : label}</span>
      </button>
    );
  },
);

SocialButton.displayName = "SocialButton";
