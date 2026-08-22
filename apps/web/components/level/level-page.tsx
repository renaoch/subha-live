"use client";

import { useEffect, useState } from "react";

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
import { LevelTabs } from "./level-tabs";
import { GiftList } from "./gift-list";

// Types for gift data
interface Gift {
  id: string;
  senderName: string;
  senderAvatar?: string | null;
  senderLevel?: number;
  giftName: string;
  giftIcon?: string;
  value: number;
  timestamp: string;
}

export function LevelPage() {
  const [progress, setProgress] =
    useState<LevelProgress | null>(null);

  const [rewards, setRewards] =
    useState<LevelReward[]>([]);

  const [history, setHistory] =
    useState<LevelHistoryItem[]>([]);

  const [incomingGifts, setIncomingGifts] = useState<Gift[]>([]);
  const [outgoingGifts, setOutgoingGifts] = useState<Gift[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");

  useEffect(() => {
    let cancelled = false;

    async function loadLevel() {
      try {
        setLoading(true);
        setError(null);

        const [
          overview,
          rewardsResult,
          historyResult,
          // TODO: Replace with actual API calls
          // incomingResult,
          // outgoingResult,
        ] = await Promise.all([
          levelsApi.me(),
          levelsApi.rewards(),
          levelsApi.history(),
          // levelsApi.gifts({ type: "incoming" }),
          // levelsApi.gifts({ type: "outgoing" }),
        ]);

        if (cancelled) {
          return;
        }

        setProgress(
          overview.progress,
        );

        setRewards(
          rewardsResult,
        );

        setHistory(
          historyResult,
        );

        // Temporary mock data until API is ready
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
        console.error(
          "LEVEL API ERROR:",
          err,
        );

        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load level data.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLevel();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LevelLoading />;
  }

  if (error || !progress) {
    return (
      <LevelError
        message={
          error ??
          "Unable to load level."
        }
      />
    );
  }

  return (
    <main className="min-h-dvh bg-[#120E19] text-[#F8F1E6] antialiased">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-12 pt-5">
        {/* Page heading */}
        <header className="px-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#D9A94A]/70">
                Profile
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-tight">
                My Level
              </h1>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-sm text-white/50">
              ✦
            </div>
          </div>

          <p className="mt-2 text-sm text-white/35">
            Build your XP, unlock rewards,
            and climb higher.
          </p>
        </header>

        <LevelHero
          progress={progress}
        />

        <LevelRewards
          rewards={rewards}
          currentLevel={
            progress.currentLevel
          }
        />

        {/* Gifts section with tabs */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#17131F] p-5">
          {/* Background aura */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-400/10 blur-[100px]" />

          <div className="relative z-10">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                  Gifts
                </p>
                <h2 className="mt-1 text-xl font-black text-[#F8F1E6]">
                  Charisma & Gifting
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-300">
                  +{incomingGifts.reduce((sum, g) => sum + g.value, 0).toLocaleString()}
                </span>
                <span className="text-[9px] text-white/20">received</span>
              </div>
            </div>

            <p className="mt-1 text-xs text-white/30">
              Track gifts you receive (charisma) and gifts you send
            </p>

            <div className="mt-4">
              <LevelTabs
                incomingCount={incomingGifts.length}
                outgoingCount={outgoingGifts.length}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              >
                {activeTab === "incoming" ? (
                  <GiftList
                    gifts={incomingGifts}
                    isIncoming={true}
                    loading={false}
                  />
                ) : (
                  <GiftList
                    gifts={outgoingGifts}
                    isIncoming={false}
                    loading={false}
                  />
                )}
              </LevelTabs>
            </div>
          </div>
        </section>

        <LevelHistory
          history={history}
        />
      </div>
    </main>
  );
}