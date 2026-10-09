"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { challengesApi, type Challenge } from "@/lib/api/challenges";
import { COUNTRIES } from "@/lib/data/countries";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const field =
  "h-11 w-full rounded-xl border border-[#2A2238] bg-[#14101d] px-3.5 text-sm text-white placeholder:text-white/30 focus:border-[#a65bff] focus:outline-none";

export default function AdminChallengesPage() {
  const [list, setList] = useState<Challenge[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("Regional Star");
  const [subtitle, setSubtitle] = useState("Challenge");
  const [country, setCountry] = useState("");
  const [rewardText, setRewardText] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 3 * 86400_000)));

  const load = useCallback(async () => {
    try {
      setList(await challengesApi.adminList());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load challenges");
      setList([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setSaving(true);
    try {
      await challengesApi.adminCreate({
        title,
        subtitle,
        country: country || null,
        rewardText: rewardText || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      toast.success("Challenge created");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create challenge");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(c: Challenge) {
    try {
      await challengesApi.adminUpdate(c.id, { isActive: !c.isActive });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  const now = Date.now();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-[#2A2238] bg-[#100c18] p-5">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-white">
          <Trophy className="h-4 w-4 text-[#ffc83d]" /> New regional challenge
        </h2>
        <p className="mb-4 text-xs text-white/40">
          Hosts are ranked by diamonds earned inside the window. A region-specific challenge shows only in rooms whose host
          is in that country; leave region empty to run it everywhere.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={40} />
          <input className={field} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle" maxLength={40} />
          <select className={field} value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All regions</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <input className={field} value={rewardText} onChange={(e) => setRewardText(e.target.value)} placeholder="Reward description (optional)" maxLength={120} />
          <label className="text-xs text-white/50">
            Starts
            <input type="datetime-local" className={`${field} mt-1`} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className="text-xs text-white/50">
            Ends
            <input type="datetime-local" className={`${field} mt-1`} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={saving || !title.trim()}
          className="mt-4 flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#ff4d8d] to-[#a65bff] px-6 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create challenge"}
        </button>
      </section>

      <section className="space-y-2">
        {list === null && <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/50" />}
        {list?.length === 0 && <p className="text-center text-sm text-white/40">No challenges yet.</p>}
        {list?.map((c) => {
          const running = c.isActive && new Date(c.startsAt).getTime() <= now && new Date(c.endsAt).getTime() > now;
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#2A2238] bg-[#100c18] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {c.title} {c.subtitle} <span className="text-white/40">· {c.country ?? "All regions"}</span>
                </p>
                <p className="text-xs text-white/40">
                  {new Date(c.startsAt).toLocaleString()} → {new Date(c.endsAt).toLocaleString()}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${running ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"}`}>
                {running ? "Running" : c.isActive ? "Scheduled/ended" : "Disabled"}
              </span>
              <button type="button" onClick={() => toggle(c)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80">
                {c.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
