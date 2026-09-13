"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Radio, PartyPopper, Video, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/home", label: "Live", icon: Radio },
  { href: "/home/party", label: "Party", icon: PartyPopper },
  { href: "/home/chats", label: "Chats", icon: MessageCircle },
  { href: "/home/me", label: "Me", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="glass-panel mx-auto flex max-w-md items-center justify-between rounded-[26px] px-3 py-2 shadow-2xl shadow-black/50">
        {TABS.slice(0, 2).map((tab) => (
          <NavItem key={tab.href} {...tab} active={pathname === tab.href} />
        ))}

        <motion.button
          onClick={() => router.push("/home?create=1")}
          aria-label="Go live"
          whileTap={{ scale: 0.88 }}
          className="relative -mt-8 flex h-14 w-14 items-center justify-center rounded-2xl text-white"
        >
          <span className="grad-brand animate-gradient-shift absolute inset-0 rounded-2xl" />
          <span className="absolute inset-0 rounded-2xl animate-glow-pulse" />
          <span className="absolute -inset-1 -z-10 rounded-[20px] bg-accent-hot/40 blur-lg" />
          <Video className="relative h-6 w-6 drop-shadow-sm" strokeWidth={2.2} />
        </motion.button>

        {TABS.slice(2).map((tab) => (
          <NavItem
            key={tab.href}
            {...tab}
            active={pathname.startsWith(tab.href)}
          />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Radio;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="relative flex w-14 flex-col items-center gap-1 py-1.5 text-[11px]"
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        {active && (
          <motion.span
            layoutId="nav-active-glow"
            className="absolute inset-[-6px] rounded-full bg-accent-hot/20 blur-md"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Icon
          className={cn(
            "relative h-5.5 w-5.5 transition-colors",
            active ? "text-accent-hot" : "text-ink-faint",
          )}
          strokeWidth={active ? 2.3 : 1.9}
        />
      </span>
      <span
        className={cn(
          "transition-colors",
          active ? "font-bold text-ink" : "text-ink-faint",
        )}
      >
        {label}
      </span>
      {active && (
        <motion.span
          layoutId="nav-active-dot"
          className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-accent-hot"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </Link>
  );
}
