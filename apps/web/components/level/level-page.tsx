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

export function LevelPage() {
  const [progress, setProgress] =
    useState<LevelProgress | null>(null);

  const [rewards, setRewards] =
    useState<LevelReward[]>([]);

  const [history, setHistory] =
    useState<LevelHistoryItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

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
        ] = await Promise.all([
          levelsApi.me(),
          levelsApi.rewards(),
          levelsApi.history(),
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

        <LevelHistory
          history={history}
        />
      </div>
    </main>
  );
}