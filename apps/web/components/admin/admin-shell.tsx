"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Target,
  Building2,
  Settings,
  ChevronDown,
  ChevronRight,
  Radio,
  Search,
} from "lucide-react";

import { roomsApi, type RoomRecord } from "@/lib/api/rooms";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/admin", label: "Rooms", icon: LayoutGrid },
      { href: "/admin/manage-tasks", label: "Manage tasks", icon: Target },
    ],
  },
  {
    label: "BD",
    items: [
      { href: "/admin/bd-applications", label: "BD applications", icon: Building2 },
    ],
  },
  {
    label: "Others",
    items: [{ href: "/admin/others", label: "Settings", icon: Settings }],
  },
];

const SECTION_TITLES: Record<string, { title: string; crumb: string }> = {
  "/admin": { title: "Rooms overview", crumb: "Rooms" },
  "/admin/manage-tasks": { title: "Manage tasks", crumb: "Manage tasks" },
  "/admin/bd-applications": {
    title: "BD applications",
    crumb: "BD applications",
  },
  "/admin/others": { title: "Settings", crumb: "Others" },
};

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    roomsApi
      .list()
      .then((list) => {
        if (!cancelled) setRooms(list);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const liveRooms = useMemo(
    () => rooms.filter((r) => r.status === "live"),
    [rooms],
  );

  const section = useMemo(() => {
    const match =
      Object.keys(SECTION_TITLES)
        .sort((a, b) => b.length - a.length)
        .find((href) => isActive(pathname, href)) ?? "/admin";
    return SECTION_TITLES[match];
  }, [pathname]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  return (
    <div className="flex min-h-dvh bg-[#17131F] text-[#F3ECE0]">
      {/* Sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#2A2238] bg-[#1A1622] px-3 py-5 md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CBA35C]">
            <Radio className="h-4.5 w-4.5 text-black" />
          </div>
          <span className="text-[17px] font-black tracking-tight text-[#F3ECE0]">
            subha<span className="text-[#CBA35C]">.</span>
            <span className="ml-1.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9088A0]">
              admin
            </span>
          </span>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#5E5570]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                        active
                          ? "bg-[#CBA35C]/12 text-[#F3ECE0] ring-1 ring-inset ring-[#CBA35C]/30"
                          : "text-[#9088A0] hover:bg-white/5 hover:text-[#D9D2E0]"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${active ? "text-[#CBA35C]" : ""}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-[#D9D2E0]">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#2A2238] px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A2238] text-[11px] font-black">
            AD
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-[#F3ECE0]">
              Admin
            </p>
            <p className="truncate text-[10px] text-[#5E5570]">
              Platform control
            </p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[#2A2238] bg-[#17131F]/95 px-4 py-3.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#5E5570]">
              <span>Admin</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[#9088A0]">{section.crumb}</span>
            </div>
            <h1 className="mt-0.5 text-[18px] font-bold text-[#F3ECE0]">
              {section.title}
            </h1>
          </div>

          {/* Room selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setRoomPickerOpen((v) => !v)}
              className="flex h-10 w-full items-center gap-2 rounded-full border border-[#2A2238] bg-[#1D1829] px-3.5 text-[12px] font-semibold text-[#D9D2E0] transition hover:border-[#CBA35C]/40 sm:w-64"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-[#5E5570]" />
              <span className="flex-1 truncate text-left">
                {selectedRoom ? selectedRoom.title : "Select a room…"}
              </span>
              {liveRooms.length > 0 && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {liveRooms.length} live
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5E5570]" />
            </button>

            {roomPickerOpen && (
              <div className="absolute right-0 z-20 mt-2 max-h-80 w-80 overflow-y-auto rounded-2xl border border-[#2A2238] bg-[#1D1829] p-1.5 shadow-2xl">
                {rooms.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[12px] text-[#5E5570]">
                    No rooms yet
                  </p>
                ) : (
                  rooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        setSelectedRoomId(room.id);
                        setRoomPickerOpen(false);
                        router.push(`/home/room/${room.id}`);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          room.status === "live"
                            ? "bg-emerald-400"
                            : "bg-[#5E5570]"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[#F3ECE0]">
                          {room.title}
                        </span>
                        <span className="block truncate text-[11px] text-[#9088A0]">
                          {room.host?.name ?? room.host?.handle ?? room.host_id}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#5E5570]">
                        {room.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
