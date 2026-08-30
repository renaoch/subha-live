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

// A small, fixed palette of avatar colors so each username gets a stable,
// pleasant color without needing a design token per user.
const AVATAR_COLORS = [
  "linear-gradient(135deg,#FF8A65,#FF3B5C)",
  "linear-gradient(135deg,#7C7CFF,#4E4EE0)",
  "linear-gradient(135deg,#34D0BA,#149E8C)",
  "linear-gradient(135deg,#FFC24B,#FF8A00)",
  "linear-gradient(135deg,#FF7AC6,#C63BAA)",
  "linear-gradient(135deg,#5CC8FF,#2E8FE0)",
];

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

/**
 * Live room chat overlay: a translucent, auto-scrolling message stream plus a
 * compact input, anchored above the bottom action bar so it never covers the
 * video. Matches the room's glass aesthetic, styled like a real chat thread
 * with avatars, tailed bubbles, and a soft entrance animation per message.
 */
export function RoomChat({ messages, selfUserId, connected, isHost, onSend }: RoomChatProps) {
  const [draft, setDraft] = useState("");
  const [justSent, setJustSent] = useState(false);
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
    if (onSend(text)) {
      setDraft("");
      setJustSent(true);
      window.setTimeout(() => setJustSent(false), 220);
    }
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-30 flex flex-col justify-end px-4",
        isHost ? "bottom-[96px]" : "bottom-[52px]",
      )}
    >
      {/* Message stream */}
      <div
        ref={listRef}
        className="pointer-events-auto mb-2 flex max-h-[220px] flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: "linear-gradient(to bottom, transparent, black 24px)" }}
      >
        {messages.length === 0 ? (
          <p className="w-fit animate-pop-in rounded-2xl bg-black/30 px-3 py-2 text-[11px] font-medium text-white/45 backdrop-blur-sm">
            Say hi to the room 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = !!selfUserId && m.userId === selfUserId;
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-end gap-1.5",
                  mine ? "animate-chat-in-right justify-end" : "animate-chat-in-left justify-start",
                )}
              >
                {!mine && (
                  <div
                    className="mb-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm ring-1 ring-white/20"
                    style={{ background: avatarColor(m.username) }}
                  >
                    {initials(m.username)}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-transform",
                    mine
                      ? "rounded-br-md bg-gradient-to-br from-[#FF5A75] to-[#E8264A] text-white"
                      : "rounded-bl-md bg-black/45 text-white ring-1 ring-white/[0.06]",
                  )}
                >
                  {!mine && (
                    <span className="mr-1.5 text-[10px] font-bold text-[#FFB4C4]">{m.username}</span>
                  )}
                  <span className="text-[12px] leading-snug">{m.message}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={submit}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-xl transition-shadow duration-200 focus-within:border-white/20 focus-within:shadow-[0_0_0_3px_rgba(255,59,92,0.18)]"
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
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF3B5C] text-white transition-all duration-150 hover:brightness-110 active:scale-90 disabled:opacity-40",
            justSent && "animate-pop-in",
          )}
        >
          <SendHorizonal className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}