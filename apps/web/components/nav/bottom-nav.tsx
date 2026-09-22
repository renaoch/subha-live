"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, PartyPopper, Plus, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/home", label: "Home", icon: Home },
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
      <div className="glass-panel mx-auto flex max-w-md items-center justify-between rounded-[28px] px-4 py-2.5 shadow-2xl shadow-black/50">
        {TABS.slice(0, 2).map((tab) => (
          <NavItem key={tab.href} {...tab} active={pathname === tab.href} />
        ))}

        <motion.button
          onClick={() => router.push("/home?create=1")}
          aria-label="Go live"
          whileTap={{ scale: 0.88 }}
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-glow"
        >
          <span className="absolute -inset-1.5 -z-10 rounded-full bg-white/25 blur-md" />
          <Plus className="h-5.5 w-5.5" strokeWidth={2.4} />
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
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative flex w-11 flex-col items-center gap-1 py-1"
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
            active ? "text-white" : "text-ink-faint",
          )}
          strokeWidth={active ? 2.3 : 1.9}
        />
      </span>
      {active && (
        <motion.span
          layoutId="nav-active-dot"
          className="h-1 w-1 rounded-full bg-accent-gold"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </Link>
  );
}