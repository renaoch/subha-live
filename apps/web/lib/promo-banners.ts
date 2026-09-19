import { Gift, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { BannerItem } from "@/components/BannerCarousel";

/**
 * Default promo slides for the Home/Party header carousels. Placeholder
 * destinations for now (toast) until the corresponding features/routes
 * exist — swap `onClick` for a real `router.push(...)` once they do.
 */
export function getPromoBanners(): BannerItem[] {
  return [
    {
      id: "refer-earn",
      title: "Refer & Earn",
      subtitle: "Invite friends, earn coins when they join",
      Icon: Gift,
      gradient: ["#FF6B4A", "#F5B93F"],
      onClick: () => toast.info("Refer & Earn is coming soon 🎁"),
    },
    {
      id: "daily-rewards",
      title: "Daily Check-in",
      subtitle: "Log in every day for bonus coins",
      Icon: Sparkles,
      gradient: ["#A86CFF", "#5FA8FF"],
      onClick: () => toast.info("Daily rewards are coming soon ✨"),
    },
    {
      id: "top-up-bonus",
      title: "Top-Up Bonus",
      subtitle: "Extra coins on your next recharge",
      Icon: Wallet,
      gradient: ["#5FD9C4", "#57C2FF"],
      onClick: () => toast.info("Top-up bonuses are coming soon 💰"),
    },
  ];
}