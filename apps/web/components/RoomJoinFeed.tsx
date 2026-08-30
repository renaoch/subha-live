"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface RoomJoinEvent {
  id: string;
  username: string;
  avatarUrl?: string | null;
  /** Small level/rank indicator shown as glowing dots, e.g. 3 for level 3. */
  level?: number;
  /** Optional subtitle, e.g. "joined the live" or a badge label. */
  subtitle?: string;
}

interface RoomJoinFeedProps {
  events: RoomJoinEvent[];
  /** How long an entry stays fully visible before it starts fading, in ms. */
  lifetimeMs?: number;
  className?: string;
}

const AVATAR_COLORS = [
  "linear-gradient(135deg,#FF8AA8,#FF3B5C)",
  "linear-gradient(135deg,#9C8CFF,#5B4EE0)",
  "linear-gradient(135deg,#4FE0C6,#149E8C)",
  "linear-gradient(135deg,#FFC24B,#FF8A00)",
  "linear-gradient(135deg,#FF7AC6,#C63BAA)",
  "linear-gradient(135deg,#6FCCFF,#2E8FE0)",
];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Overlay feed shown in the top-left of the live room: "X joined" style
 * entries that slide in with a soft bounce, glow briefly to draw the eye,
 * then age out (dimming, then fading upward) so the list never clutters
 * the video. Newest entries always sit at the bottom of the stack.
 */
export function RoomJoinFeed({ events, lifetimeMs = 5000, className }: RoomJoinFeedProps) {
  const [visible, setVisible] = useState<RoomJoinEvent[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const latest = events[events.length - 1];
    if (!latest) return;
    setVisible((prev) => {
      if (prev.some((e) => e.id === latest.id)) return prev;
      const next = [...prev, latest].slice(-6);
      return next;
    });
    const t = window.setTimeout(() => {
      setVisible((prev) => prev.filter((e) => e.id !== latest.id));
      timers.current.delete(latest.id);
    }, lifetimeMs);
    timers.current.set(latest.id, t);
    return () => {
      // cleanup handled on unmount below
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(() => {
    const ts = timers.current;
    return () => {
      ts.forEach((t) => window.clearTimeout(t));
      ts.clear();
    };
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-3 top-16 z-30 flex w-[210px] flex-col gap-1.5",
        className,
      )}
    >
      {visible.map((e, i) => {
        const age = visible.length - 1 - i;
        return (
          <div
            key={e.id}
            className="join-row flex items-center gap-2 rounded-full py-1 pl-1 pr-3"
            style={{
              animationDelay: "0ms",
              opacity: age === 0 ? 1 : Math.max(0.28, 1 - age * 0.22),
            }}
          >
            <div className="join-avatar relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
              {e.avatarUrl ? (
                <img src={e.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: colorFor(e.username) }}
                >
                  {e.username.slice(0, 1).toUpperCase()}
                </div>
              )}
              {age === 0 && <span className="join-ring absolute inset-0 rounded-full" />}
            </div>

            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[12.5px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                {e.username}
              </span>
              {e.subtitle ? (
                <span className="truncate text-[10.5px] font-medium text-white/60">{e.subtitle}</span>
              ) : e.level ? (
                <span className="mt-0.5 flex items-center gap-[3px]">
                  {Array.from({ length: Math.min(e.level, 5) }).map((_, dotIdx) => (
                    <span
                      key={dotIdx}
                      className="join-dot h-[5px] w-[5px] rounded-full bg-[#FFD24B]"
                      style={{ animationDelay: `${140 + dotIdx * 70}ms` }}
                    />
                  ))}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .join-row {
          background: linear-gradient(90deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.08));
          backdrop-filter: blur(6px);
          animation: join-slide-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both,
            join-settle 0.6s ease-out 0.5s both;
          transition: opacity 0.6s ease;
        }
        @keyframes join-slide-in {
          0% {
            transform: translateX(-26px) scale(0.9);
            opacity: 0;
          }
          55% {
            transform: translateX(3px) scale(1.03);
            opacity: 1;
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes join-settle {
          0% {
            box-shadow: 0 0 0 1px rgba(255, 59, 92, 0.55), 0 0 18px rgba(255, 59, 92, 0.35);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 59, 92, 0);
          }
        }
        .join-avatar {
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15);
        }
        .join-ring {
          animation: join-ring-pulse 1.1s cubic-bezier(0.2, 0.6, 0.4, 1) 1;
          box-shadow: 0 0 0 2px rgba(255, 178, 196, 0.9);
        }
        @keyframes join-ring-pulse {
          0% {
            transform: scale(0.85);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.7);
            opacity: 0;
          }
        }
        .join-dot {
          animation: join-dot-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          box-shadow: 0 0 6px rgba(255, 210, 75, 0.7);
        }
        @keyframes join-dot-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}