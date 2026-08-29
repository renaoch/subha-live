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

/**
 * Live room chat overlay: a translucent, auto-scrolling message stream plus a
 * compact input, anchored above the bottom action bar so it never covers the
 * video. Matches the room's glass aesthetic.
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
        "pointer-events-none absolute inset-x-0 z-30 flex flex-col justify-end px-4",
        isHost ? "bottom-[96px]" : "bottom-[52px]",
      )}
    >
      {/* Message stream */}
      <div
        ref={listRef}
        className="pointer-events-auto mb-2 max-h-[200px] space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {messages.length === 0 ? (
          <p className="rounded-2xl bg-black/30 px-3 py-2 text-[11px] font-medium text-white/45 backdrop-blur-sm">
            Say hi to the room 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = !!selfUserId && m.userId === selfUserId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-2.5 py-1.5 backdrop-blur-sm",
                    mine ? "rounded-br-md bg-[#FF3B5C]/85" : "rounded-bl-md bg-black/40",
                  )}
                >
                  {!mine && (
                    <span className="mr-1.5 text-[10px] font-bold text-[#FFB4C4]">{m.username}</span>
                  )}
                  <span className="text-[12px] leading-snug text-white">{m.message}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={submit}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-xl"
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
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF3B5C] text-white transition hover:brightness-110 disabled:opacity-40"
        >
          <SendHorizonal className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
