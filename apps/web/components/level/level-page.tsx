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

setProgress(overview.progress);
        setRewards(rewardsResult);
        setHistory(historyResult);
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
    <main className="min-h-dvh bg-[#17131F] font-[family-name:var(--font-body)] text-[#F3ECE0] antialiased">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-10 pt-6">
        <div>
          <h1 className="text-2xl font-bold">
            My Level
          </h1>

          <p className="mt-1 text-sm text-white/40">
            Track your progress and rewards.
          </p>
        </div>

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