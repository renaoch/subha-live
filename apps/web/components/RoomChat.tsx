"use client";

import { useEffect, useRef, useState } from "react";
import { Gamepad2, Gift, Mic, MicOff, Smile, Swords, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomChatMessage } from "@/lib/api/chat";
import { GiftImage } from "@/components/GiftImage";
import { LevelGem } from "@/components/room/hud/LevelGem";

export type MicMode = "on" | "off" | "request" | "pending";

interface RoomChatProps {
  messages: RoomChatMessage[];
  selfUserId?: string | null;
  connected?: boolean;
  isHost?: boolean;
  /** Keeps the bar raised (host pre-live pill). */
  raised?: boolean;
  onSend: (text: string) => boolean;
  /** Viewer-only gift button. */
  onOpenGift?: () => void;
  /** Host-only: PK battle. */
  onOpenPk?: () => void;
  onOpenGames?: () => void;
  /** Guest-seat / multi-guest panel. `guestBadge` shows pending requests (host). */
  onOpenGuests?: () => void;
  guestBadge?: number;
  /** Mic button behaviour: toggle mute on stage, or request/cancel a seat as a viewer. */
  micMode?: MicMode;
  onMicPress?: () => void;
  onOpenProfile?: (userId: string) => void;
}

const EMOJIS = [
  "😀", "😂", "🥰", "😍", "😘", "😎", "🤩", "😊",
  "😉", "🥳", "😇", "🤗", "😋", "😜", "🤭", "😏",
  "😢", "😭", "😡", "😱", "🤯", "🙄", "😴", "🤔",
  "👍", "👏", "🙌", "🙏", "💪", "👋", "✌️", "🤞",
  "❤️", "💖", "💜", "🔥", "✨", "🎉", "🌹", "💯",
];

const NAME_COLORS = ["#ff9eb5", "#8be3b0", "#8fd6ff", "#ffd27a", "#d3a8ff", "#ffb48f", "#7fe8d4"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function Avatar36({ src, name }: { src: string | null; name: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote user avatar
    <img src={src} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/20" />
  ) : (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ring-1 ring-white/20"
      style={{ background: `linear-gradient(135deg, ${colorFor(name)}, rgba(0,0,0,0.6))` }}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

function BarButton({
  label,
  onClick,
  className,
  style,
  children,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={style}
      className={cn(
        "relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function RoomChat({
  messages,
  selfUserId,
  connected,
  isHost,
  raised,
  onSend,
  onOpenGift,
  onOpenPk,
  onOpenGames,
  onOpenGuests,
  guestBadge = 0,
  micMode,
  onMicPress,
  onOpenProfile,
}: RoomChatProps) {
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (onSend(text)) {
      setDraft("");
      setEmojiOpen(false);
    }
  }

  function addEmoji(emoji: string) {
    setDraft((d) => (d + emoji).slice(0, 500));
    inputRef.current?.focus();
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-30 flex flex-col justify-end pb-[calc(env(safe-area-inset-bottom,0px)+12px)] transition-[bottom] duration-500 ease-out",
        raised ? "bottom-[96px]" : "bottom-0",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46svh] bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      {/* Message stream */}
      <div
        ref={listRef}
        className="pointer-events-auto relative z-10 mb-3 flex max-h-[34svh] flex-col items-start gap-2.5 overflow-y-auto overscroll-contain pl-3 pr-[88px] pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: "linear-gradient(to bottom, transparent, black 36px)" }}
      >
        {messages.length === 0 ? (
          <p className="rounded-full bg-black/40 px-3 py-1.5 text-[13px] font-medium text-white/60 backdrop-blur-md">
            Say hi to the room 👋
          </p>
        ) : (
          messages.map((m) => {
            const kind = m.kind ?? "message";
            const mine = !!selfUserId && m.userId === selfUserId;

            if (kind === "join") {
              return (
                <div
                  key={m.id}
                  className="chat-row flex items-center gap-2.5 rounded-full bg-black/55 py-1.5 pl-1.5 pr-4 backdrop-blur-md"
                >
                  <button type="button" onClick={() => onOpenProfile?.(m.userId)} className="shrink-0">
                    <Avatar36 src={m.avatar} name={m.username} />
                  </button>
                  <span className="text-[15px] font-semibold text-white">
                    {m.username} <span className="ml-1 font-medium text-white/90">Joined 👋</span>
                  </span>
                </div>
              );
            }

            if (kind === "gift") {
              const gift = m.gift;
              return (
                <div key={m.id} className="chat-row relative">
                  <div
                    className="relative flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3"
                    style={{
                      background: "linear-gradient(90deg, rgba(255,40,110,0.42), rgba(120,10,60,0.55) 75%, rgba(20,6,16,0.6))",
                      boxShadow:
                        "inset 0 0 0 1.5px rgba(255,90,150,0.85), 0 0 16px rgba(255,50,120,0.45)",
                    }}
                  >
                    <button type="button" onClick={() => onOpenProfile?.(m.userId)} className="shrink-0">
                      <Avatar36 src={m.avatar} name={m.username} />
                    </button>
                    <span className="flex items-center gap-1.5 text-[15px] font-semibold text-white">
                      {m.username}
                      {m.level ? <LevelGem level={m.level} /> : null}
                      <span className="font-semibold text-[#ffd27a]">
                        Sent {gift?.name ?? "a gift"}
                      </span>
                      {gift && (
                        <GiftImage
                          gift={{ code: gift.code, icon: gift.icon ?? undefined }}
                          fallbackIcon={Gift}
                          className="flex h-6 w-6 shrink-0 items-center justify-center"
                          imgClassName="h-6 w-6 object-contain"
                        />
                      )}
                      {gift && gift.quantity > 1 && (
                        <span key={gift.quantity} className="animate-pop-in font-bold text-white">
                          x{gift.quantity}
                        </span>
                      )}
                    </span>
                    {gift && (
                      <GiftImage
                        gift={{ code: gift.code, icon: gift.icon ?? undefined }}
                        fallbackIcon={Gift}
                        className="pointer-events-none absolute -right-[62px] -top-6 flex h-[84px] w-[84px] items-center justify-center"
                        imgClassName="h-[84px] w-[84px] object-contain drop-shadow-[0_6px_14px_rgba(255,40,100,0.55)]"
                      />
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={cn(
                  "chat-row flex items-center gap-2.5 rounded-[26px] bg-black/55 py-1.5 pl-1.5 pr-4 backdrop-blur-md transition-opacity",
                  m.pending && "opacity-50",
                )}
              >
                <button
                  type="button"
                  disabled={mine}
                  onClick={() => onOpenProfile?.(m.userId)}
                  className="shrink-0 self-start disabled:cursor-default"
                >
                  <Avatar36 src={m.avatar} name={m.username} />
                </button>
                <div className="min-w-0 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-medium leading-tight text-white/65">
                      {mine ? "You" : m.username}
                    </span>
                    {m.level ? <LevelGem level={m.level} /> : null}
                  </div>
                  <p className="break-words text-[15px] font-medium leading-snug text-white">{m.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Emoji tray */}
      {emojiOpen && (
        <div className="pointer-events-auto relative z-10 mx-3 mb-2 grid grid-cols-8 gap-1 rounded-3xl border border-white/10 bg-black/70 p-2 backdrop-blur-2xl">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => addEmoji(e)}
              className="flex h-9 items-center justify-center rounded-xl text-[22px] transition active:scale-90 active:bg-white/10"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div className="pointer-events-auto relative z-10 flex items-center gap-2 px-3">
        <form
          onSubmit={submit}
          className="flex h-[46px] min-w-0 flex-1 items-center rounded-full border border-white/25 bg-black/50 pl-4 pr-1.5 backdrop-blur-xl focus-within:border-white/50"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={!connected ? "Connecting…" : "Say something..."}
            disabled={!connected}
            maxLength={500}
            enterKeyHint="send"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/55 focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            aria-label="Emoji"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition active:scale-90",
              emojiOpen && "bg-white/15",
            )}
          >
            <Smile className="h-[26px] w-[26px]" strokeWidth={1.8} />
          </button>
        </form>

        {isHost && onOpenPk && (
          <BarButton label="PK Battle" onClick={onOpenPk} className="border-[#f5b93f]/40 bg-[#2a1d05]/60 text-[#f5b93f]">
            <Swords className="h-5 w-5" strokeWidth={2} />
          </BarButton>
        )}

        {onOpenGuests && (
          <BarButton label="Guest seats" onClick={onOpenGuests} className="border-white/20 bg-black/45 text-white">
            <UsersRound className="h-[22px] w-[22px]" strokeWidth={1.8} />
            {guestBadge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff2d6a] px-1 text-[10px] font-bold text-white ring-2 ring-black">
                {guestBadge}
              </span>
            )}
          </BarButton>
        )}

        {onOpenGift && (
          <BarButton
            label="Send a gift"
            onClick={onOpenGift}
            className="border-[#ff3d78]/70 bg-[#3a0c1d]/70 text-[#ff8fb3]"
            style={{ boxShadow: "0 0 16px rgba(255,50,110,0.35)" }}
          >
            <Gift className="h-[24px] w-[24px]" strokeWidth={1.8} />
          </BarButton>
        )}

        {onOpenGames && (
          <BarButton
            label="Games"
            onClick={onOpenGames}
            className="border-[#6f7bff]/60 bg-[#10153a]/70 text-[#7fc4ff]"
            style={{ boxShadow: "0 0 16px rgba(90,110,255,0.3)" }}
          >
            <Gamepad2 className="h-[26px] w-[26px]" strokeWidth={1.8} />
          </BarButton>
        )}

        {onMicPress && micMode && (
          <BarButton
            label={
              micMode === "on"
                ? "Mute microphone"
                : micMode === "off"
                  ? "Unmute microphone"
                  : micMode === "pending"
                    ? "Cancel mic request"
                    : "Request to speak"
            }
            onClick={onMicPress}
            className={cn(
              micMode === "off"
                ? "border-[#ff2d6a] bg-[#ff2d6a] text-white"
                : "border-[#ff8fb3]/50 bg-black/55 text-[#ff9ec0]",
              micMode === "pending" && "animate-pulse",
            )}
          >
            {micMode === "off" ? (
              <MicOff className="h-[22px] w-[22px]" strokeWidth={1.9} />
            ) : (
              <Mic className="h-[22px] w-[22px]" strokeWidth={1.9} />
            )}
          </BarButton>
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
