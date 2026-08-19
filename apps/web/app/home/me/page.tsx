"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Pencil, Search, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { usersApi } from "@/lib/api/users";
import { authApi } from "@/lib/api/auth";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";

export default function MePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", bio: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersApi
      .me()
      .then((user) => {
        setProfile(user);
        setDraft({ name: user.name ?? "", bio: user.bio ?? "" });
      })
      .catch(() => toast.error("Couldn't load your profile"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({
        name: draft.name || undefined,
        bio: draft.bio || undefined,
      });
      setProfile(updated);
      setEditing(false);
      toast.success("Profile updated");
    } catch {
      toast.error("Couldn't save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await authApi.signOut();
    router.replace("/auth");
  }

  if (loading) {
    return (
      <main className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm text-ink-muted">Loading profile…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[560px] px-4 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-ink">Me</h1>
        <div className="flex items-center gap-3 text-ink-muted">
          <Search className="h-5 w-5" />
          <Settings className="h-5 w-5" />
        </div>
      </header>

      <section className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-surface-raised p-4">
        <Avatar name={profile?.name ?? "You"} size="lg" online />

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-ink">
            {profile?.name ?? "Unnamed"}
          </p>
          <p className="truncate text-sm text-ink-muted">
            {profile?.handle ? `@${profile.handle}` : "No handle set"}
          </p>
          {profile?.country && (
            <p className="mt-0.5 text-xs text-ink-muted">
              {profile.country_flag} {profile.country}
            </p>
          )}
        </div>

        <button
          onClick={() => setEditing((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </section>

      {editing && (
        <section className="mt-4 space-y-3 rounded-2xl border border-border bg-surface-raised p-4">
          <div>
            <label className="text-xs font-medium text-ink-muted">Name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-ink-muted">Bio</label>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-gradient-to-r from-accent to-accent-hot py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </section>
      )}

      {profile?.bio && !editing && (
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          {profile.bio}
        </p>
      )}

      <button
        onClick={handleLogout}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-ink-muted transition-colors hover:border-accent-hot/40 hover:text-accent-hot"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </main>
  );
}