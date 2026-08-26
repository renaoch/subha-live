"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
    <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-2xl border border-border/80 bg-background/95 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
        {TABS.slice(0, 2).map((tab) => (
          <NavItem key={tab.href} {...tab} active={pathname === tab.href} />
        ))}

        <button
          onClick={() => router.push("/home/party?create=1")}
          aria-label="Go live"
          className="relative -mt-7 flex h-12 w-12 items-center justify-center rounded-xl border border-foreground/20 bg-foreground text-background shadow-lg shadow-black/30 transition-transform active:scale-95"
        >
          <Video className="h-6 w-6" />
        </button>

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
      className="flex w-14 flex-col items-center gap-1 py-1 text-[11px]"
    >
      <Icon
        className={cn(
          "h-6 w-6 transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        strokeWidth={active ? 2.4 : 1.9}
      />
      <span className={cn(active ? "font-medium text-ink" : "text-ink-muted")}>
        {label}
      </span>
    </Link>
  );
}
