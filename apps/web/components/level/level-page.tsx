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

        // --------------------------------------------------
        // 1. Fetch level overview
        // --------------------------------------------------

        console.log(
          "LEVEL: fetching overview...",
        );

        const overview =
          await levelsApi.me();

        console.log(
          "LEVEL: overview success",
          overview,
        );

        if (cancelled) {
          return;
        }

        setProgress(
          overview.progress,
        );

        // --------------------------------------------------
        // 2. Fetch rewards
        // --------------------------------------------------

        console.log(
          "LEVEL: fetching rewards...",
        );

        const rewardsResult =
          await levelsApi.rewards();

        console.log(
          "LEVEL: rewards success",
          rewardsResult,
        );

        if (cancelled) {
          return;
        }

        setRewards(
          rewardsResult,
        );

        // --------------------------------------------------
        // 3. Fetch history
        // --------------------------------------------------

        console.log(
          "LEVEL: fetching history...",
        );

        const historyResult =
          await levelsApi.history();

        console.log(
          "LEVEL: history success",
          historyResult,
        );

        if (cancelled) {
          return;
        }

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

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return <LevelLoading />;
  }

  // --------------------------------------------------
  // Error
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Page
  // --------------------------------------------------

  return (
    <main className="min-h-dvh bg-[#17131F] font-[family-name:var(--font-body)] text-[#F3ECE0] antialiased">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-10 pt-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">
            My Level
          </h1>

          <p className="mt-1 text-sm text-white/40">
            Track your progress and rewards.
          </p>
        </div>

        {/* Current level + progress */}
        <LevelHero
          progress={progress}
        />

        {/* Rewards */}
        <LevelRewards
          rewards={rewards}
          currentLevel={
            progress.currentLevel
          }
        />

        {/* Level history */}
        <LevelHistory
          history={history}
        />
      </div>
    </main>
  );
}