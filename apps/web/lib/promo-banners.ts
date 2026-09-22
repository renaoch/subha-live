import { Gift, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { BannerItem } from "@/components/BannerCarousel";

/**
 * Default promo slides for the Home/Party header carousels. Placeholder
 * destinations for now (toast) until the corresponding features/routes
 * exist — swap `onClick` for a real `router.push(...)` once they do.
 *
 * Gradients are pulled from the live CSS theme tokens (see
 * `:root` in app/globals.css) instead of hardcoded hex, so these slides
 * re-theme automatically whenever the palette changes — no edits needed
 * here.
 */
function themeVar(name: string) {
  if (typeof window === "undefined") return `hsl(var(${name}))`;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `hsl(${value})` : `hsl(var(${name}))`;
}

export function getPromoBanners(): BannerItem[] {
  return [
    {
      id: "refer-earn",
      title: "Refer & Earn",
      subtitle: "Invite friends, earn coins when they join",
      Icon: Gift,
      gradient: [themeVar("--accent-hot-2"), themeVar("--accent-gold")],
      onClick: () => toast.info("Refer & Earn is coming soon 🎁"),
    },
    {
      id: "daily-rewards",
      title: "Daily Check-in",
      subtitle: "Log in every day for bonus coins",
      Icon: Sparkles,
      gradient: [themeVar("--accent-violet"), themeVar("--accent-cyan")],
      onClick: () => toast.info("Daily rewards are coming soon ✨"),
    },
    {
      id: "top-up-bonus",
      title: "Top-Up Bonus",
      subtitle: "Extra coins on your next recharge",
      Icon: Wallet,
      gradient: [themeVar("--accent-green"), themeVar("--accent-cyan")],
      onClick: () => toast.info("Top-up bonuses are coming soon 💰"),
    },
  ];
}