"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, MessageCircle, MoreHorizontal, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { mutualFriends, usersApi, type FollowListEntry } from "@/lib/api/users";
import type { PublicProfile } from "@/lib/types";

const fallback: PublicProfile = {
  id: "demo-host", public_id: "demo-host", name: "Subha", handle: "subha_live", avatar: null,
  bio: "Sharing good energy, live conversations, and little moments from the day.", country: "Nepal", country_flag: "NP",
  gender: null, level: 6, vip_level: 0, svip: false, is_verified: true, followers: 12400, following: 128, role: "user", created_at: new Date().toISOString(),
};

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile>(fallback);
  const [followers, setFollowers] = useState<FollowListEntry[]>([]);
  const [following, setFollowing] = useState<FollowListEntry[]>([]);
  const [tab, setTab] = useState<"about" | "followers" | "following" | "friends">("about");
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([usersApi.getById(id), usersApi.getFollowers(id), usersApi.getFollowing(id), usersApi.getFollowStatus(id)])
      .then(([user, followerList, followingList, status]) => {
        if (!active) return;
        setProfile(user); setFollowers(followerList); setFollowing(followingList); setIsFollowing(Boolean(status.following));
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  const friends = useMemo(() => mutualFriends(followers, following), [followers, following]);
  const toggleFollow = async () => {
    const next = !isFollowing;
    setIsFollowing(next);
    try { next ? await usersApi.follow(id) : await usersApi.unfollow(id); }
    catch { setIsFollowing(!next); }
  };
  const visibleUsers = tab === "followers" ? followers : tab === "following" ? following : friends;

  return (
    <main className="min-h-dvh bg-[#080808] text-white">
      <div className="mx-auto min-h-dvh max-w-2xl border-x border-white/[0.06] bg-[#0c0c0c]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#0c0c0c]/90 px-5 backdrop-blur-xl">
          <button onClick={() => router.back()} aria-label="Go back" className="rounded-full p-2 text-white/65 hover:bg-white/[0.07] hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
          <span className="text-sm font-semibold tracking-wide">Profile</span>
          <button aria-label="More options" className="rounded-full p-2 text-white/65 hover:bg-white/[0.07] hover:text-white"><MoreHorizontal className="h-5 w-5" /></button>
        </header>

        <section className="border-b border-white/[0.07] px-6 pb-7 pt-8">
          <div className="flex items-start gap-4">
            <Avatar name={profile.name ?? "User"} src={profile.avatar ?? undefined} size="lg" online className="h-[76px] w-[76px] border-2 border-white/15" />
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-2"><h1 className="truncate text-xl font-semibold">{profile.name ?? "User"}</h1>{profile.is_verified && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-black"><Check className="h-3 w-3" strokeWidth={3} /></span>}</div>
              <p className="mt-1 text-sm text-white/45">@{profile.handle ?? profile.public_id}</p>
              <p className="mt-3 text-sm leading-6 text-white/70">{profile.bio}</p>
            </div>
          </div>
          <div className="mt-5 flex gap-2"><button onClick={toggleFollow} className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${isFollowing ? "border border-white/15 bg-white/[0.06] text-white" : "bg-white text-black"}`}><UserPlus className="h-4 w-4" />{isFollowing ? "Following" : "Follow"}</button><button className="flex h-10 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04]" aria-label="Message"><MessageCircle className="h-4 w-4" /></button></div>
          <div className="mt-6 grid grid-cols-3 divide-x divide-white/[0.08] text-center"><Stat value={profile.followers} label="Followers" onClick={() => setTab("followers")} /><Stat value={profile.following} label="Following" onClick={() => setTab("following")} /><Stat value={friends.length  || 0} label="Friends" onClick={() => setTab("friends")} /></div>
        </section>

        <nav className="flex border-b border-white/[0.07] px-4" aria-label="Profile sections">{(["about", "followers", "following", "friends"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`flex-1 border-b-2 px-2 py-4 text-xs font-semibold capitalize transition ${tab === item ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"}`}>{item}</button>)}</nav>
        {tab === "about" ? <About profile={profile} /> : <section className="space-y-1 p-4">{loading ? <p className="py-10 text-center text-sm text-white/40">Loading connections...</p> : visibleUsers.length ? visibleUsers.map((user) => <Connection key={user.id} user={user} />) : <div className="py-14 text-center"><Users className="mx-auto h-7 w-7 text-white/25" /><p className="mt-3 text-sm text-white/45">No {tab} to show yet</p></div>}</section>}
      </div>
    </main>
  );
}

function Stat({ value, label, onClick }: { value: number; label: string; onClick: () => void }) { return <button onClick={onClick} className="group"><strong className="block text-lg font-semibold group-hover:text-white/70">{Intl.NumberFormat("en", { notation: "compact" }).format(value)}</strong><span className="text-xs text-white/40">{label}</span></button>; }
function About({ profile }: { profile: PublicProfile }) { return <section className="space-y-3 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">About</p><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-xs text-white/70">Level {profile.level}</span><span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-xs text-white/70">{profile.country_flag ?? ""} {profile.country ?? "Worldwide"}</span><span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-xs text-white/70">{profile.role === "user" ? "Creator" : profile.role}</span></div><p className="text-sm leading-6 text-white/55">A welcoming creator who enjoys meeting new people and building a thoughtful live community.</p></section>; }
function Connection({ user }: { user: FollowListEntry }) { return <div className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-white/[0.04]"><Avatar name={user.name ?? "User"} src={user.avatar ?? undefined} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name ?? "User"}</p><p className="truncate text-xs text-white/40">@{user.handle ?? user.public_id}</p></div>{user.is_verified && <Check className="h-4 w-4 text-white/60" />}</div>; }
