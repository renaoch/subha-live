"use client";

import { useEffect, useState } from "react";
import { Crown, Gift, Sparkles, ArrowUpRight, ArrowDownLeft } from "lucide-react";

import {
  levelsApi,
  type LevelProgress,
  type LevelReward,
  type LevelHistoryItem,
} from "@/lib/api/levels";

import { LevelHero } from "./level-hero";
import { LevelRewards } from "./level-rewards";
import { LevelHistory } from "./level-history";
import { LevelLoading } from "./level-loading";
import { LevelError } from "./level-error";
import { GiftList, type GiftData } from "./gift-list"; // ✅ Import GiftData

type TabType = "level" | "charisma";

export function LevelPage() {
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [rewards, setRewards] = useState<LevelReward[]>([]);
  const [history, setHistory] = useState<LevelHistoryItem[]>([]);
  const [incomingGifts, setIncomingGifts] = useState<GiftData[]>([]); // ✅ Use GiftData[]
  const [outgoingGifts, setOutgoingGifts] = useState<GiftData[]>([]); // ✅ Use GiftData[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("level");
  const [charismaSubTab, setCharismaSubTab] = useState<"incoming" | "outgoing">("incoming");

  useEffect(() => {
    let cancelled = false;

    async function loadLevel() {
      try {
        setLoading(true);
        setError(null);

        const [overview, rewardsResult, historyResult] = await Promise.all([
          levelsApi.me(),
          levelsApi.rewards(),
          levelsApi.history(),
        ]);

        if (cancelled) return;

        setProgress(overview.progress);
        setRewards(rewardsResult);
        setHistory(historyResult);

        // Mock data - replace with real API calls
        setIncomingGifts([
          {
            id: "1",
            senderName: "Leo",
            senderAvatar: null,
            senderLevel: 42,
            giftName: "Super Heart",
            giftIcon: "heart",
            value: 500,
            timestamp: new Date().toISOString(),
          },
          {
            id: "2",
            senderName: "Mia",
            senderAvatar: null,
            senderLevel: 78,
            giftName: "Royal Crown",
            giftIcon: "crown",
            value: 1500,
            timestamp: new Date(Date.now() - 86400000).toISOString(),
          },
        ]);

        setOutgoingGifts([
          {
            id: "3",
            senderName: "Aria Studios",
            senderAvatar: null,
            senderLevel: 56,
            giftName: "Sparkles",
            giftIcon: "sparkles",
            value: 300,
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
        ]);
      } catch (err) {
        console.error("LEVEL API ERROR:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load level data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLevel();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LevelLoading />;
  if (error || !progress) return <LevelError message={error ?? "Unable to load level."} />;

  const totalCharisma = incomingGifts.reduce((sum, g) => sum + g.value, 0);
  const totalGifted = outgoingGifts.reduce((sum, g) => sum + g.value, 0);

  return (
    <main className="min-h-dvh bg-[#120E19] text-[#F8F1E6] antialiased">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-12 pt-5">
        {/* Page heading */}
        <header className="px-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#D9A94A]/70">Profile</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">My Level</h1>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-sm text-white/50">✦</div>
          </div>
          <p className="mt-2 text-sm text-white/35">Track your progression and charisma.</p>
        </header>

        {/* ─── MAIN TABS ─── */}
        <div className="relative rounded-2xl border border-white/5 bg-white/[0.03] p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setActiveTab("level")}
              className={`
                relative flex items-center justify-center gap-2.5 rounded-xl px-4 py-3.5
                text-sm font-bold transition-all duration-300
                ${activeTab === "level"
                  ? "bg-gradient-to-r from-violet-500/20 to-amber-500/10 text-white shadow-[0_0_30px_rgba(168,108,255,0.15)]"
                  : "text-white/30 hover:bg-white/5 hover:text-white/60"
                }
              `}
            >
              <Crown className="h-4 w-4" />
              <span>Level</span>
              <span className={`
                rounded-full px-2 py-0.5 text-[9px] font-black
                ${activeTab === "level"
                  ? "bg-violet-400/20 text-violet-300"
                  : "bg-white/5 text-white/30"
                }
              `}>
                {progress.currentLevel}
              </span>
              {activeTab === "level" && (
                <div className="absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-400 to-amber-300" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("charisma")}
              className={`
                relative flex items-center justify-center gap-2.5 rounded-xl px-4 py-3.5
                text-sm font-bold transition-all duration-300
                ${activeTab === "charisma"
                  ? "bg-gradient-to-r from-violet-500/20 to-amber-500/10 text-white shadow-[0_0_30px_rgba(168,108,255,0.15)]"
                  : "text-white/30 hover:bg-white/5 hover:text-white/60"
                }
              `}
            >
              <Gift className="h-4 w-4" />
              <span>Charisma</span>
              <span className={`
                rounded-full px-2 py-0.5 text-[9px] font-black
                ${activeTab === "charisma"
                  ? "bg-emerald-400/20 text-emerald-300"
                  : "bg-white/5 text-white/30"
                }
              `}>
                {totalCharisma.toLocaleString()}
              </span>
              {activeTab === "charisma" && (
                <div className="absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-amber-300" />
              )}
            </button>
          </div>
        </div>

        {/* ─── CONTENT ─── */}
        {activeTab === "level" ? (
          <div className="space-y-5">
            <LevelHero progress={progress} />
            <LevelRewards rewards={rewards} currentLevel={progress.currentLevel} />
            <LevelHistory history={history} />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Charisma Overview Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-400/10 bg-gradient-to-br from-emerald-400/5 to-transparent p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/60">Received</p>
                <p className="mt-1 text-2xl font-black text-emerald-300">{totalCharisma.toLocaleString()}</p>
                <p className="mt-0.5 text-[10px] text-white/20">{incomingGifts.length} gifts</p>
              </div>
              <div className="rounded-2xl border border-amber-400/10 bg-gradient-to-br from-amber-400/5 to-transparent p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/60">Given</p>
                <p className="mt-1 text-2xl font-black text-amber-300">{totalGifted.toLocaleString()}</p>
                <p className="mt-0.5 text-[10px] text-white/20">{outgoingGifts.length} gifts</p>
              </div>
            </div>

            {/* Charisma Sub-tabs */}
            <div className="relative rounded-xl border border-white/5 bg-white/[0.02] p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setCharismaSubTab("incoming")}
                  className={`
                    flex items-center justify-center gap-2 rounded-lg px-3 py-2.5
                    text-xs font-bold transition-all duration-300
                    ${charismaSubTab === "incoming"
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "text-white/30 hover:bg-white/5 hover:text-white/60"
                    }
                  `}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  Received
                  <span className="rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
                    {incomingGifts.length}
                  </span>
                </button>
                <button
                  onClick={() => setCharismaSubTab("outgoing")}
                  className={`
                    flex items-center justify-center gap-2 rounded-lg px-3 py-2.5
                    text-xs font-bold transition-all duration-300
                    ${charismaSubTab === "outgoing"
                      ? "bg-amber-400/10 text-amber-300"
                      : "text-white/30 hover:bg-white/5 hover:text-white/60"
                    }
                  `}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Given
                  <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black text-amber-300">
                    {outgoingGifts.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Charisma Gift List */}
            <GiftList
              gifts={charismaSubTab === "incoming" ? incomingGifts : outgoingGifts}
              isIncoming={charismaSubTab === "incoming"}
            />
          </div>
        )}
      </div>
    </main>
  );
}