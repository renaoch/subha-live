"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe2, Loader2, Search, Star, StopCircle, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { roomTasksApi, type HostSearchResult, type StarTargetTemplate } from "@/lib/api/room-tasks";

const inputClass =
  "w-full rounded-xl border border-[#2A2238] bg-[#17131F] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none";
const labelClass = "mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]";

function digits(v: string) {
  return v.replace(/[^0-9]/g, "");
}

/**
 * Admin → Star targets. The ONLY place a Star Target can be created or ended.
 *
 * A target applies to EVERY live automatically (each live tracks its own
 * progress), or — optionally — to one host's lives only. Hosts and viewers
 * just see progress; the API enforces admin-only on every write.
 */
export default function AdminStarTargetsPage() {
  const [targets, setTargets] = useState<StarTargetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);

  const [scope, setScope] = useState<"all" | "host">("all");
  const [host, setHost] = useState<HostSearchResult | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HostSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [title, setTitle] = useState("Star Target");
  const [target, setTarget] = useState("");
  const [reward, setReward] = useState("");

  const load = useCallback(async () => {
    try {
      setTargets(await roomTasksApi.adminTemplates());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load star targets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  // Debounced host search.
  useEffect(() => {
    if (scope !== "host" || host || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      roomTasksApi
        .adminSearchHosts(query.trim())
        .then((r) => !cancelled && setResults(r))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, scope, host]);

  const targetNum = Number(target);
  const rewardNum = Number(reward) || 0;
  const valid =
    title.trim().length > 0 && Number.isInteger(targetNum) && targetNum > 0 && (scope === "all" || !!host);

  const replacing = targets.find(
    (t) => t.isActive && (scope === "all" ? t.scope === "all" : t.scope === "host" && t.hostId === host?.id),
  );

  async function start() {
    if (!valid) return;
    setSaving(true);
    try {
      await roomTasksApi.adminCreateTemplate({
        title: title.trim(),
        targetValue: targetNum,
        rewardCoins: rewardNum,
        hostId: scope === "host" ? host!.id : null,
      });
      toast.success(scope === "all" ? "Star Target is now live in every room" : `Star Target set for ${host!.name}`);
      setTarget("");
      setReward("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set star target");
    } finally {
      setSaving(false);
    }
  }

  async function end(t: StarTargetTemplate) {
    setEndingId(t.id);
    try {
      await roomTasksApi.adminEndTemplate(t.id);
      toast.success("Star Target ended");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to end star target");
    } finally {
      setEndingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CBA35C]/15">
            <Star className="h-4.5 w-4.5 fill-[#CBA35C] text-[#CBA35C]" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[#F3ECE0]">Set a Star Target</h2>
            <p className="text-[11px] text-[#9088A0]">
              A coin goal viewers watch fill up as gifts land. It applies to every live automatically — each live fills its
              own bar. Only admins can set it.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Applies to</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "all", label: "Every live", icon: Globe2 },
                  { id: "host", label: "One host", icon: UserRound },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setScope(id);
                    if (id === "all") {
                      setHost(null);
                      setQuery("");
                    }
                  }}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold transition ${
                    scope === id
                      ? "border-[#CBA35C] bg-[#CBA35C]/15 text-[#CBA35C]"
                      : "border-[#2A2238] bg-[#17131F] text-[#9088A0] hover:text-[#F3ECE0]"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          {scope === "host" && (
            <div>
              <label className={labelClass}>Host</label>
              {host ? (
                <div className="flex items-center gap-3 rounded-xl border border-[#CBA35C]/40 bg-[#CBA35C]/10 px-3 py-2.5">
                  {host.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote avatar
                    <img src={host.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold text-white">
                      {host.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#F3ECE0]">{host.name}</p>
                    <p className="truncate text-[11px] text-[#9088A0]">
                      @{host.handle}
                      {host.publicId ? ` · ID ${host.publicId}` : ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => setHost(null)} aria-label="Change host" className="text-[#9088A0] hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5E5570]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, @handle or ID"
                    className={`${inputClass} pl-10`}
                  />
                  {(searching || results.length > 0 || query.trim().length >= 2) && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[#2A2238] bg-[#17131F] shadow-xl">
                      {searching && (
                        <p className="flex items-center gap-2 px-3.5 py-3 text-[12px] text-[#9088A0]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                        </p>
                      )}
                      {!searching && results.length === 0 && (
                        <p className="px-3.5 py-3 text-[12px] text-[#9088A0]">No matching users</p>
                      )}
                      {results.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setHost(r);
                            setResults([]);
                          }}
                          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-[#F3ECE0]">{r.name}</span>
                            <span className="block truncate text-[11px] text-[#9088A0]">
                              @{r.handle}
                              {r.publicId ? ` · ID ${r.publicId}` : ""}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Target (coins per live)</label>
              <input
                value={target}
                onChange={(e) => setTarget(digits(e.target.value))}
                inputMode="numeric"
                placeholder="20000"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Reward per viewer (coins)</label>
              <input
                value={reward}
                onChange={(e) => setReward(digits(e.target.value))}
                inputMode="numeric"
                placeholder="0 = no reward"
                className={inputClass}
              />
            </div>
          </div>

          {replacing && (
            <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-[12px] text-amber-300">
              {scope === "all" ? "An every-live target" : `${host?.name ?? "This host"} already has a target`} is active
              ({replacing.title}). Starting a new one replaces it and resets the bar in lives where it&apos;s running.
            </p>
          )}
          {scope === "all" && (
            <p className="text-[11.5px] text-[#9088A0]">
              A target set for one host always wins over the every-live target in that host&apos;s rooms.
            </p>
          )}

          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => void start()}
            className="flex h-11 w-full items-center justify-center rounded-full bg-[#CBA35C] text-[13px] font-bold text-black transition hover:bg-[#CBA35C]/90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : replacing ? "Replace target" : "Start target"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60">
        <div className="flex items-center justify-between border-b border-[#2A2238] px-4 py-3.5">
          <h2 className="text-[13px] font-semibold text-[#F3ECE0]">Star targets</h2>
          <span className="text-[11px] text-[#5E5570]">Updates every 10s</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-10 text-[13px] text-[#9088A0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : targets.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm font-bold text-white/40">No star targets yet</p>
        ) : (
          <div className="divide-y divide-[#2A2238]">
            {targets.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-[#F3ECE0]">
                    {t.title} · {t.targetValue.toLocaleString()} coins
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#9088A0]">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        t.scope === "all" ? "bg-sky-400/15 text-sky-300" : "bg-fuchsia-400/15 text-fuchsia-300"
                      }`}
                    >
                      {t.scope === "all" ? "Every live" : (t.hostName ?? "One host")}
                    </span>
                    <span>reward {t.rewardCoins > 0 ? `+${t.rewardCoins}` : "none"}</span>
                    <span>
                      {t.runningRooms} running · {t.completedRooms} completed
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      t.isActive ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/40"
                    }`}
                  >
                    {t.isActive ? "Active" : "Ended"}
                  </span>
                  {t.isActive && (
                    <button
                      type="button"
                      disabled={endingId === t.id}
                      onClick={() => void end(t)}
                      className="flex items-center gap-1 rounded-full border border-red-400/30 px-2.5 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                    >
                      {endingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3" />}
                      End
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}