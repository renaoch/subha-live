"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Loader2, Lock, MessageCircle, SendHorizonal, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { usersApi } from "@/lib/api/users";
import { messagesApi, type Friendship } from "@/lib/api/messages";
import { useDmThread } from "@/hooks/useDmThread";
import type { PublicProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

// Same level-tier palette as the /home/me profile hero (profile-hero.tsx),
// kept here as a small standalone copy so the in-room popup can match its
// look without the hero's full animated-ring CSS. Keep these two in sync if
// the tier colors ever change.
const TIER_PALETTE = [
  { primary: "#D98F4E", accent: "#FFCF9E" }, // Bronze
  { primary: "#AEB9C7", accent: "#EAF0F6" }, // Silver
  { primary: "#F5B93F", accent: "#FFE29E" }, // Gold
  { primary: "#5FD9C4", accent: "#B4F5E7" }, // Platinum
  { primary: "#57C2FF", accent: "#B3E6FF" }, // Diamond
  { primary: "#A86CFF", accent: "#DCC2FF" }, // Master
  { primary: "#FF6CA8", accent: "#FFC0DA" }, // Grandmaster
  { primary: "#FF8A5C", accent: "#FFCBAE" }, // Elite
  { primary: "#FFD24C", accent: "#FFF0B8" }, // Legend
  { primary: "#F5B93F", accent: "#F8F1E6" }, // Mythic
] as const;
const TIER_SIZE = 10;

function tierForLevel(level: number) {
  const index = Math.min(TIER_PALETTE.length - 1, Math.floor((Math.max(1, level) - 1) / TIER_SIZE));
  return TIER_PALETTE[index];
}

interface UserProfilePopupProps {
  userId: string;
  currentUserId?: string | null;
  onClose: () => void;
}

/**
 * Tap any user's avatar/name inside a live room (host header, top
 * contributors, viewer list) and this opens in place of navigating away
 * from the room. From here, tapping "Chat" swaps to an inline DM thread
 * without leaving the room either.
 */
export function UserProfilePopup({ userId, currentUserId, onClose }: UserProfilePopupProps) {
  const [view, setView] = useState<"profile" | "chat">("profile");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const isSelf = !!currentUserId && currentUserId === userId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      usersApi.getById(userId).catch(() => null),
      isSelf ? Promise.resolve(null) : usersApi.getFollowStatus(userId).catch(() => null),
    ]).then(([p, status]) => {
      if (cancelled) return;
      setProfile(p);
      setFollowing(status ? status.following ?? false : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, isSelf]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function toggleFollow() {
    if (following === null || followBusy) return;
    setFollowBusy(true);
    try {
      if (following) {
        await usersApi.unfollow(userId);
        setFollowing(false);
      } else {
        await usersApi.follow(userId);
        setFollowing(true);
      }
    } catch {
      // Leave state as-is; the button just stays clickable to retry.
    } finally {
      setFollowBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      {/* Bottom sheet: the live stream stays visible behind/above this, the
          sheet itself rises from the bottom to 70% of the viewport height. */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[70dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-white/10 bg-[#150f26] shadow-[0_-24px_80px_rgba(0,0,0,0.65)] animate-in slide-in-from-bottom duration-300 ease-out"
      >
        <div className="absolute left-1/2 top-2.5 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20" />

        {view === "profile" ? (
          <ProfileView
            loading={loading}
            profile={profile}
            isSelf={isSelf}
            following={following}
            followBusy={followBusy}
            onToggleFollow={toggleFollow}
            onClose={onClose}
            onOpenChat={() => setView("chat")}
          />
        ) : (
          <ChatView
            userId={userId}
            name={profile?.name || profile?.handle || "User"}
            avatar={profile?.avatar ?? null}
            onBack={() => setView("profile")}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function TieredAvatar({ src, name, level }: { src: string | null; name: string; level: number }) {
  const theme = tierForLevel(level);
  return (
    <div className="relative h-20 w-20 shrink-0">
      <div
        className="absolute inset-0 rounded-full p-[2px]"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
      >
        <div className="h-full w-full rounded-full bg-[#150f26]" />
      </div>
      <div
        className="absolute inset-[3px] overflow-hidden rounded-full"
        style={{ boxShadow: `0 0 16px ${theme.primary}55` }}
      >
        <Avatar name={name} src={src ?? undefined} size="lg" className="h-full w-full" />
      </div>
    </div>
  );
}

function ProfileView({
  loading,
  profile,
  isSelf,
  following,
  followBusy,
  onToggleFollow,
  onClose,
  onOpenChat,
}: {
  loading: boolean;
  profile: PublicProfile | null;
  isSelf: boolean;
  following: boolean | null;
  followBusy: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  onOpenChat: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/70 transition hover:bg-white/15 hover:text-white active:scale-90"
      >
        <X className="h-4 w-4" />
      </button>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        </div>
      ) : !profile ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-white/60">
          Couldn&apos;t load this profile.
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pb-6 pt-10">
          <TieredAvatar src={profile.avatar} name={profile.name || "User"} level={profile.level} />

          <div className="mt-3 flex items-center gap-1.5">
            <p className="max-w-[220px] truncate text-[17px] font-extrabold text-white">
              {profile.name || "User"}
            </p>
            {profile.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[#CBA35C] text-[#150f26]" />}
          </div>
          {profile.handle && <p className="mt-0.5 text-[13px] text-white/50">@{profile.handle}</p>}

          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[#FFD24B]">
              Lv.{profile.level}
            </span>
            {profile.country_flag && (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
                {profile.country_flag} {profile.country}
              </span>
            )}
          </div>

          {profile.bio && (
            <p className="mt-4 line-clamp-3 text-center text-[12.5px] leading-relaxed text-white/60">
              {profile.bio}
            </p>
          )}

          {/* Same layout/labels as the Followers/Following/Friends row on
              /home/me — just without a Visitors column, since that count
              is private to the profile owner. */}
          <dl className="mt-5 flex w-full items-stretch justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3">
            {[
              { label: "Followers", value: profile.followers },
              { label: "Following", value: profile.following },
              { label: "Friends", value: profile.friend_count },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1",
                  i !== 2 && "border-r border-white/10",
                )}
              >
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  {stat.label}
                </dt>
                <dd className="text-sm font-bold tabular-nums text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex w-full items-center gap-2.5 px-2">
            {!isSelf && (
              <button
                type="button"
                onClick={onToggleFollow}
                disabled={following === null || followBusy}
                className={cn(
                  "flex-1 rounded-full py-2.5 text-[13px] font-bold transition active:scale-95 disabled:opacity-50",
                  following
                    ? "border border-white/15 bg-white/[0.06] text-white/80"
                    : "bg-gradient-to-b from-[#FFE08A] to-[#F2A81D] text-[#3a2500]",
                )}
              >
                {followBusy ? "…" : following ? "Following" : "Follow"}
              </button>
            )}
            {!isSelf && (
              <button
                type="button"
                onClick={onOpenChat}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] py-2.5 text-[13px] font-bold text-white transition active:scale-95"
              >
                <MessageCircle className="h-4 w-4" />
                Chat
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ChatView({
  userId,
  name,
  avatar,
  onBack,
  onClose,
}: {
  userId: string;
  name: string;
  avatar: string | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const { messages, loading, myId, send } = useDmThread(userId);

  useEffect(() => {
    let cancelled = false;
    messagesApi
      .friendship(userId)
      .then((f) => {
        if (!cancelled) setFriendship(f);
      })
      .catch(() => {
        if (!cancelled)
          setFriendship({ areFriends: false, isBlocked: false, freeMessagesRemaining: 3 });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const canSend =
    !!friendship && (friendship.areFriends || (friendship.freeMessagesRemaining ?? 0) > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || !canSend) return;
    setSending(true);
    setDraft("");
    try {
      await send(text);
      setFriendship((prev) =>
        prev && !prev.areFriends && prev.freeMessagesRemaining !== null
          ? { ...prev, freeMessagesRemaining: Math.max(0, prev.freeMessagesRemaining - 1) }
          : prev,
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to profile"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar name={name} src={avatar ?? undefined} size="sm" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{name}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading || !friendship ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-white/50" />
        </div>
      ) : friendship.isBlocked ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/60">
            <Lock className="h-5 w-5" />
          </div>
          <p className="text-[13px] font-medium text-white/60">You can&apos;t message this user.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="pt-8 text-center text-[13px] text-white/50">Say hi to {name} 👋</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.senderId === myId ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
                      m.senderId === myId
                        ? "rounded-br-md bg-white text-[#150f26]"
                        : "rounded-bl-md bg-white/10 text-white",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
          </div>

          {!friendship.areFriends && (
            <p className="px-4 pb-1 text-center text-[11px] text-white/45">
              {(friendship.freeMessagesRemaining ?? 0) > 0
                ? `${friendship.freeMessagesRemaining} free message${friendship.freeMessagesRemaining === 1 ? "" : "s"} left before you follow each other`
                : "Free messages used up — follow each other to keep chatting"}
            </p>
          )}

          <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={canSend ? "Write a message" : "Follow each other to keep chatting"}
              aria-label="Message"
              maxLength={2000}
              disabled={!canSend}
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[13px] text-white outline-none placeholder:text-white/40 disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!draft.trim() || sending || !canSend}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#150f26] transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </button>
          </form>
        </>
      )}
    </div>
  );
}