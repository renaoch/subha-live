"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomChatMessage } from "@/lib/api/chat";

interface RoomChatProps {
  messages: RoomChatMessage[];
  selfUserId?: string | null;
  connected?: boolean;
  /** Hosts have their own controls (HostControls) above the bottom bar, so the
      chat input sits a little higher to avoid overlapping them. */
  isHost?: boolean;
  onSend: (text: string) => boolean;
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

/**
 * Live room chat overlay, styled like a live-stream chat feed (YouTube /
 * TikTok live): a flat, borderless scroll of "avatar — colored name —
 * message" rows sitting directly over the video with a bottom scrim for
 * legibility. No message bubbles, no per-row background — the video stays
 * the star. New rows slide up from the bottom as they arrive.
 */
export function RoomChat({ messages, selfUserId, connected, isHost, onSend }: RoomChatProps) {
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
        "pointer-events-none absolute inset-x-0 z-30 flex flex-col justify-end",
        isHost ? "bottom-[96px]" : "bottom-[52px]",
      )}
    >
      {/* Bottom scrim so text stays legible over any video content */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[230px] bg-gradient-to-t from-black/55 via-black/20 to-transparent" />

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
            return (
              <div key={m.id} className="chat-row flex items-start gap-2">
                {m.avatar ? (
                  <img
                    src={m.avatar}
                    alt=""
                    className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/25"
                  />
                ) : (
                  <div
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-white/25"
                    style={{ background: avatarGradient(m.username) }}
                  >
                    {initials(m.username)}
                  </div>
                )}
                <p className="min-w-0 flex-1 text-[12.5px] leading-snug [text-shadow:0_1px_3px_rgba(0,0,0,0.75)]">
                  <span className="mr-1.5 font-bold" style={{ color: nameColor }}>
                    {mine ? "You" : m.username}
                  </span>
                  <span className="break-words text-white/95">{m.message}</span>
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={submit}
        className="pointer-events-auto relative z-10 mx-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-xl transition-shadow duration-200 focus-within:border-white/20 focus-within:shadow-[0_0_0_3px_rgba(255,59,92,0.18)]"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Say something…" : "Connecting…"}
          disabled={!connected}
          maxLength={500}
          className="min-w-0 flex-1 bg-transparent px-1 text-[13px] text-white placeholder:text-white/40 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          aria-label="Send message"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF3B5C] text-white transition-all duration-150 hover:brightness-110 active:scale-90 disabled:opacity-40"
        >
          <SendHorizonal className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </form>

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