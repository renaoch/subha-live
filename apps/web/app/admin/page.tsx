"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Radio, Users, Clock3, ExternalLink } from "lucide-react";

import { roomsApi, type RoomRecord } from "@/lib/api/rooms";

const STATUS_STYLES: Record<string, string> = {
  live: "bg-emerald-400/15 text-emerald-300",
  created: "bg-amber-400/15 text-amber-300",
  ending: "bg-orange-400/15 text-orange-300",
  ended: "bg-white/10 text-white/40",
};

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#CBA35C]/15">
        <Icon className="h-4 w-4 text-[#CBA35C]" />
      </div>
      <p className="text-[11px] text-[#9088A0]">{label}</p>
      <p className="mt-0.5 text-[22px] font-bold text-[#F3ECE0]">{value}</p>
    </div>
  );
}

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    roomsApi
      .list()
      .then((list) => {
        if (!cancelled) setRooms(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const liveRooms = useMemo(() => rooms.filter((r) => r.status === "live"), [rooms]);
  const totalViewers = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.viewerCount ?? 0), 0),
    [rooms],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Radio} label="Total rooms" value={rooms.length} />
        <StatCard icon={Radio} label="Live now" value={liveRooms.length} />
        <StatCard icon={Users} label="Viewers across rooms" value={totalViewers} />
        <StatCard
          icon={Clock3}
          label="Waiting / created"
          value={rooms.filter((r) => r.status === "created").length}
        />
      </div>

      <div className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60">
        <div className="flex items-center justify-between border-b border-[#2A2238] px-4 py-3.5">
          <h2 className="text-[13px] font-semibold text-[#F3ECE0]">
            All rooms
          </h2>
          <span className="text-[11px] text-[#5E5570]">
            Pick a room to jump into it
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-10 text-[13px] text-[#9088A0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading rooms…
          </div>
        ) : rooms.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-bold text-white/40">No rooms yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2A2238]">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/home/room/${room.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.03]"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    room.status === "live" ? "bg-emerald-400" : "bg-[#5E5570]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-[#F3ECE0]">
                    {room.title}
                  </p>
                  <p className="truncate text-[11px] text-[#9088A0]">
                    Hosted by {room.host?.name ?? room.host?.handle ?? room.host_id}
                  </p>
                </div>
                {typeof room.viewerCount === "number" && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-[#9088A0]">
                    <Users className="h-3.5 w-3.5" />
                    {room.viewerCount}
                  </span>
                )}
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    STATUS_STYLES[room.status] ?? "bg-white/10 text-white/50"
                  }`}
                >
                  {room.status}
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#5E5570]" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
