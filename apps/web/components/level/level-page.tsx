"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Gift, ArrowUpRight, ArrowDownLeft } from "lucide-react";

import {
  levelsApi,
  type LevelProgress,
  type LevelReward,
  type LevelHistoryItem,
} from "@/lib/api/levels";

import {
  charismaApi,
  type CharismaProgress,
  type CharismaGiftItem,
} from "@/lib/api/charisma";

import { LevelHero } from "./level-hero";
import { LevelRewards } from "./level-rewards";
import { LevelHistory } from "./level-history";
import { LevelLoading } from "./level-loading";
import { LevelError } from "./level-error";
import { CharismaHero } from "../charisma/charisma-hero";
import { CharismaRewards } from "../charisma/charisma-rewards";
import { GiftList, type GiftData } from "./gift-list";

type TabType = "level" | "charisma";
type GiftDirection = "incoming" | "outgoing";

function toGiftData(
  item: CharismaGiftItem,
  direction: GiftDirection,
): GiftData {
  const isIncoming = direction === "incoming";

  return {
    id: item.id,
    senderName: isIncoming ? item.senderName : item.recipientName,
    senderAvatar: isIncoming ? item.senderAvatar : item.recipientAvatar,
    senderLevel: isIncoming ? item.senderLevel : item.recipientLevel,
    giftName: item.giftName,
    giftIcon: item.giftIcon,
    value: item.value,
    timestamp: item.createdAt,
  };
}

export function LevelPage() {
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [rewards, setRewards] = useState<LevelReward[]>([]);
  const [history, setHistory] = useState<LevelHistoryItem[]>([]);
  const [charisma, setCharisma] = useState<CharismaProgress | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>("level");
  const [charismaSubTab, setCharismaSubTab] = useState<GiftDirection>("incoming");

  const [gifts, setGifts] = useState<Record<GiftDirection, GiftData[]>>({
    incoming: [],
    outgoing: [],
  });
  const [giftTotals, setGiftTotals] = useState<Record<GiftDirection, number>>({
    incoming: 0,
    outgoing: 0,
  });
  const [giftsLoaded, setGiftsLoaded] = useState<Record<GiftDirection, boolean>>({
    incoming: false,
    outgoing: false,
  });
  const [giftsLoading, setGiftsLoading] = useState(false);

  // Initial load: level progress/rewards/history + charisma overview
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [overview, rewardsResult, historyResult, charismaOverview] =
          await Promise.all([
            levelsApi.me(),
            levelsApi.rewards(),
            levelsApi.history(),
            charismaApi.me(),
          ]);

        if (cancelled) return;

        setProgress(overview.progress);
        setRewards(rewardsResult);
        setHistory(historyResult);
        setCharisma(charismaOverview.progress);
      } catch (err) {
        console.error("LEVEL PAGE ERROR:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load level data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lazy-load gifts for a direction the first time its sub-tab is opened
  const loadGifts = useCallback(async (direction: GiftDirection) => {
    setGiftsLoading(true);

    try {
      const result = await charismaApi.gifts(direction);

      setGifts((prev) => ({
        ...prev,
        [direction]: result.gifts.map((g) => toGiftData(g, direction)),
      }));

      setGiftTotals((prev) => ({
        ...prev,
        [direction]: result.totalValue,
      }));

      setGiftsLoaded((prev) => ({ ...prev, [direction]: true }));
    } catch (err) {
      console.error("GIFT LIST ERROR:", err);
    } finally {
      setGiftsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "charisma") return;
    if (giftsLoaded[charismaSubTab]) return;

    loadGifts(charismaSubTab);
  }, [activeTab, charismaSubTab, giftsLoaded, loadGifts]);

  if (loading) return <LevelLoading />;
  if (error || !progress || !charisma) {
    return <LevelError message={error ?? "Unable to load level."} />;
  }

  const totalCharisma = charisma.totalCharisma;
  const incomingCount = gifts.incoming.length;
  const outgoingCount = gifts.outgoing.length;

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
                  ? "bg-gradient-to-r from-rose-500/20 to-amber-500/10 text-white shadow-[0_0_30px_rgba(255,108,168,0.15)]"
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
                <div className="absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-gradient-to-r from-rose-400 to-amber-300" />
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
            <CharismaHero progress={charisma} />
            <CharismaRewards currentLevel={charisma.currentLevel} />

            {/* Charisma Overview Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-400/10 bg-gradient-to-br from-emerald-400/5 to-transparent p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/60">Received</p>
                <p className="mt-1 text-2xl font-black text-emerald-300">{giftTotals.incoming.toLocaleString()}</p>
                <p className="mt-0.5 text-[10px] text-white/20">
                  {giftsLoaded.incoming ? `${incomingCount} gifts` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-400/10 bg-gradient-to-br from-amber-400/5 to-transparent p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/60">Given</p>
                <p className="mt-1 text-2xl font-black text-amber-300">{giftTotals.outgoing.toLocaleString()}</p>
                <p className="mt-0.5 text-[10px] text-white/20">
                  {giftsLoaded.outgoing ? `${outgoingCount} gifts` : "—"}
                </p>
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
                  {giftsLoaded.incoming && (
                    <span className="rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
                      {incomingCount}
                    </span>
                  )}
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
                  {giftsLoaded.outgoing && (
                    <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black text-amber-300">
                      {outgoingCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Charisma Gift List */}
            <GiftList
              gifts={gifts[charismaSubTab]}
              isIncoming={charismaSubTab === "incoming"}
              loading={giftsLoading && !giftsLoaded[charismaSubTab]}
            />
          </div>
        )}
      </div>
    </main>
  );
}