"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SendHorizonal, Gift, Menu, Swords, SlidersHorizontal, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomChatMessage } from "@/lib/api/chat";
import { GameIcon } from "@/components/icons";

interface RoomChatProps {
  messages: RoomChatMessage[];
  selfUserId?: string | null;
  connected?: boolean;
  /** Hosts have their own controls (HostControls) above the bottom bar, so the
      chat input sits a little higher to avoid overlapping them. */
  isHost?: boolean;
  /** True while the host's "Start Live" pill is still showing above the bar —
      keeps the chat bar raised so it doesn't overlap. Once it goes away
      (stream goes live), the bar animates down to the bottom. */
  raised?: boolean;
  onSend: (text: string) => boolean;
  /** Opens the gift sheet. Omit to hide the gift button (e.g. for hosts). */
  onOpenGift?: () => void;
  /** Opens the "more" sheet (camera, mic, filters, share, like, menu). */
  onOpenMore?: () => void;
  /** Opens the PK battle sheet. */
  onOpenPk?: () => void;
  /** Opens games. */
  onOpenGames?: () => void;
  /** Host-only filter toggle, shown in the main action row. */
  onToggleFilter?: () => void;
  filterOpen?: boolean;
  /** False when the server restricts sending to the host's friends. */
  canChat?: boolean;
}

// YouTube-live-style username colors: bright, legible against video, no two
// adjacent hues too close together.
const NAME_COLORS = [
  "#FF6B81", // rose
  "#6FCF97", // mint
  "#5CC8FF", // sky
  "#FFC24B", // amber
  "#C48BFF", // violet
  "#FF9662", // coral
  "#4FE0C6", // teal
];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function avatarGradient(seed: string) {
  const c = colorFor(seed);
  return `linear-gradient(135deg, ${c}, rgba(0,0,0,0.55))`;
}

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

type RoundButtonProps = {
  label: string;
  onClick?: () => void;
  active?: boolean;
  tone?: "neutral" | "rose" | "gold" | "violet";
  children: React.ReactNode;
};

function RoundButton({ label, onClick, active, tone = "neutral", children }: RoundButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90",
        tone === "neutral" && "bg-white/[0.08] text-white/85 hover:bg-white/15 hover:text-white",
        tone === "rose" && "bg-[#FF3B5C] text-white shadow-[0_2px_12px_rgba(255,59,92,0.45)] hover:brightness-110",
        tone === "gold" && "bg-[#F5B93F]/15 text-[#F5B93F] ring-1 ring-inset ring-[#F5B93F]/30 hover:bg-[#F5B93F]/25",
        tone === "violet" && "bg-[#A86CFF]/15 text-[#C9A3FF] ring-1 ring-inset ring-[#A86CFF]/30 hover:bg-[#A86CFF]/25",
        active && "ring-2 ring-white/80",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Live room chat overlay, styled like a live-stream chat feed (YouTube /
 * TikTok live): a flat, borderless scroll of "avatar — colored name —
 * message" rows sitting directly over the video with a bottom scrim for
 * legibility. No message bubbles, no per-row background — the video stays
 * the star. New rows slide up from the bottom as they arrive.
 *
 * The bottom action row is a single frosted pill: burger menu (more) + chat
 * input + PK + Games + Gift/Filters.
 */
export function RoomChat({
  messages,
  selfUserId,
  connected,
  isHost,
  raised,
  onSend,
  onOpenGift,
  onOpenMore,
  onOpenPk,
  onOpenGames,
  onToggleFilter,
  filterOpen,
  canChat = true,
}: RoomChatProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message (unless the user scrolled up to read).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (onSend(text)) setDraft("");
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-30 flex flex-col justify-end transition-[bottom] duration-500 ease-out",
        raised ? "bottom-[96px]" : "bottom-[10px]",
      )}
    >
      {/* Bottom scrim so text stays legible over any video content */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[230px] bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

      {/* Message stream: flat rows, no bubbles, YouTube-live style */}
      <div
        ref={listRef}
        className="pointer-events-auto relative z-10 mb-2 flex max-h-[210px] flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 pt-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: "linear-gradient(to bottom, transparent, black 28px)" }}
      >
        {messages.length === 0 ? (
          <p className="text-[12px] font-medium text-white/50 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
            Say hi to the room 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = !!selfUserId && m.userId === selfUserId;
            const nameColor = mine ? "#FF3B5C" : colorFor(m.username);
            const avatarEl = m.avatar ? (
              <img
                src={m.avatar}
                alt={m.username}
                className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/25"
              />
            ) : (
              <div
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-white/25"
                style={{ background: avatarGradient(m.username) }}
              >
                {initials(m.username)}
              </div>
            );
            return (
              <div
                key={m.id}
                className={cn(
                  "chat-row flex items-start gap-2 transition-opacity duration-300",
                  m.pending && "opacity-50",
                )}
              >
                {mine ? (
                  avatarEl
                ) : (
                  <Link href={`/user/${m.userId}`} className="shrink-0 active:opacity-70">
                    {avatarEl}
                  </Link>
                )}
                <p className="min-w-0 flex-1 text-[12.5px] leading-snug [text-shadow:0_1px_3px_rgba(0,0,0,0.75)]">
                  {mine ? (
                    <span className="mr-1.5 font-bold" style={{ color: nameColor }}>
                      You
                    </span>
                  ) : (
                    <Link
                      href={`/user/${m.userId}`}
                      className="mr-1.5 font-bold hover:underline"
                      style={{ color: nameColor }}
                    >
                      {m.username}
                    </Link>
                  )}
                  <span className="break-words text-white/95">{m.message}</span>
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Unified frosted action row: burger + input + PK + Games + Gift/Filters */}
      <div className="pointer-events-auto relative z-10 mx-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        {onOpenMore && (
          <RoundButton label="More actions" onClick={onOpenMore}>
            <Menu className="h-5 w-5" strokeWidth={2.1} />
          </RoundButton>
        )}

        <form
          onSubmit={submit}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-full transition-shadow duration-200 focus-within:shadow-[0_0_0_3px_rgba(255,59,92,0.18)]"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={!connected ? "Connecting…" : canChat ? "Say something…" : "Only friends can chat"}
            disabled={!connected || !canChat}
            maxLength={500}
            className="min-w-0 flex-1 bg-transparent px-2 text-[13px] text-white placeholder:text-white/40 focus:outline-none disabled:opacity-60"
          />
          {canChat ? (
            <button
              type="submit"
              disabled={!connected || !draft.trim()}
              aria-label="Send message"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF3B5C] text-white transition-all duration-150 hover:brightness-110 active:scale-90 disabled:opacity-40"
            >
              <SendHorizonal className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-white/35">
              <Lock className="h-4 w-4" strokeWidth={2} />
            </span>
          )}
        </form>

        {onOpenPk && (
          <RoundButton label="PK Battle" onClick={onOpenPk} tone="gold">
            <Swords className="h-[18px] w-[18px]" strokeWidth={2} />
          </RoundButton>
        )}

        {onOpenGames && (
          <RoundButton label="Games" onClick={onOpenGames} tone="violet">
            <GameIcon className="h-[18px] w-[18px]" />
          </RoundButton>
        )}

        {onOpenGift && (
          <RoundButton label="Send a gift" onClick={onOpenGift} tone="rose">
            <Gift className="h-[18px] w-[18px]" strokeWidth={2} />
          </RoundButton>
        )}

        {onToggleFilter && (
          <RoundButton label="Filters" onClick={onToggleFilter} tone="neutral" active={filterOpen}>
            <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
          </RoundButton>
        )}
      </div>

      <style jsx>{`
        .chat-row {
          animation: chat-row-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes chat-row-in {
          0% {
            opacity: 0;
            transform: translateY(14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
