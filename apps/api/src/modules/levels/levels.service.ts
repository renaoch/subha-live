import { supabase } from "../../lib/supabase";

import { AppError } from "../../errors/app-error";

import type {
  LevelDefinition,
  LevelReward,
  UserLevelHistory,
  LevelHistoryResult,
  LevelOverview,
  LevelProgress,
  LevelRewardItem,
  LevelRewardsResult,
} from "./levels.types";

import type { LevelHistoryQuery } from "./levels.schema";

/**
 * The Supabase queries below intentionally select only a subset
 * of the complete database rows.
 *
 * These local types describe exactly what each query returns.
 */
type LevelRewardRow = Pick<
  LevelReward,
  | "id"
  | "level"
  | "reward_type"
  | "reward_amount"
  | "metadata"
  | "created_at"
>;

type LevelHistoryRow = Pick<
  UserLevelHistory,
  | "id"
  | "old_level"
  | "new_level"
  | "xp_at_level_up"
  | "created_at"
>;

function toNumber(
  value: number | null,
): number {
  return value ?? 0;
}

function calculateProgress(
  totalXp: number,
  currentLevel: number,
  currentDefinition: LevelDefinition | null,
  nextDefinition: LevelDefinition | null,
): LevelProgress {
  const currentLevelXp =
    currentDefinition?.xp_required ?? 0;

  const nextLevelXp =
    nextDefinition?.xp_required ?? null;

  const xpIntoLevel = Math.max(
    0,
    totalXp - currentLevelXp,
  );

  const xpRequiredForLevel =
    nextLevelXp !== null
      ? Math.max(
          0,
          nextLevelXp - currentLevelXp,
        )
      : 0;

  let progress = 0;

  if (nextLevelXp !== null) {
    if (xpRequiredForLevel <= 0) {
      progress = 100;
    } else {
      progress =
        (xpIntoLevel / xpRequiredForLevel) * 100;
    }
  } else {
    progress = 100;
  }

  progress = Math.min(
    100,
    Math.max(0, progress),
  );

  return {
    currentLevel,

    currentXp: xpIntoLevel,

    totalXp,

    currentLevelXp,

    nextLevelXp,

    progress: Number(
      progress.toFixed(2),
    ),

    nextLevel:
      nextDefinition?.level ?? null,

    currentTitle:
      currentDefinition?.title ?? null,

    nextTitle:
      nextDefinition?.title ?? null,
  };
}

/**
 * Get the authenticated user's level overview.
 *
 * profiles.level is the current authoritative display level.
 * user_level_progress.total_xp stores cumulative XP.
 */
export async function getMyLevel(
  userId: string,
): Promise<LevelOverview> {
  const profileStart = performance.now();

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, level")
    .eq("id", userId)
    .single();

  console.log(
    `level profile query: ${(
      performance.now() - profileStart
    ).toFixed(2)}ms`,
  );

  if (profileError) {
    if (profileError.code === "PGRST116") {
      throw new AppError(
        404,
        "User profile not found",
        {
          code: "PROFILE_NOT_FOUND",
        },
      );
    }

    throw profileError;
  }

  const currentLevel =
    profile.level ?? 1;

  const progressStart =
    performance.now();

  const {
    data: progress,
    error: progressError,
  } = await supabase
    .from("user_level_progress")
    .select(
      "user_id, total_xp, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  console.log(
    `level progress query: ${(
      performance.now() - progressStart
    ).toFixed(2)}ms`,
  );

  if (progressError) {
    throw progressError;
  }

  /**
   * Existing users may not have a progress row
   * if initialization was not run for them.
   *
   * Create it lazily so the API remains resilient.
   */
  const totalXp =
    progress?.total_xp ?? 0;

  if (!progress) {
    const {
      error: insertError,
    } = await supabase
      .from("user_level_progress")
      .insert({
        user_id: userId,
        total_xp: 0,
      });

    if (
      insertError &&
      insertError.code !== "23505"
    ) {
      throw insertError;
    }
  }

  const definitionsStart =
    performance.now();

  const {
    data: currentDefinition,
    error: currentDefinitionError,
  } = await supabase
    .from("level_definitions")
    .select(
      "level, xp_required, title, created_at",
    )
    .eq("level", currentLevel)
    .maybeSingle();

  console.log(
    `current level definition query: ${(
      performance.now() -
      definitionsStart
    ).toFixed(2)}ms`,
  );

  if (currentDefinitionError) {
    throw currentDefinitionError;
  }

  const {
    data: nextDefinition,
    error: nextDefinitionError,
  } = await supabase
    .from("level_definitions")
    .select(
      "level, xp_required, title, created_at",
    )
    .gt("level", currentLevel)
    .order("level", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (nextDefinitionError) {
    throw nextDefinitionError;
  }

  const levelProgress =
    calculateProgress(
      totalXp,
      currentLevel,
      currentDefinition,
      nextDefinition,
    );

  return {
    progress: levelProgress,
  };
}

/**
 * Get all level rewards.
 */
export async function getLevelRewards(): Promise<LevelRewardsResult> {
  const {
    data,
    error,
  } = await supabase
    .from("level_rewards")
    .select(
      "id, level, reward_type, reward_amount, metadata, created_at",
    )
    .order("level", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const rewards: LevelRewardItem[] =
    (data ?? []).map(
      (reward: LevelRewardRow) => ({
        id: reward.id,

        level: reward.level,

        rewardType:
          reward.reward_type,

        rewardAmount: toNumber(
          reward.reward_amount,
        ),

        metadata:
          reward.metadata &&
          typeof reward.metadata ===
            "object" &&
          !Array.isArray(
            reward.metadata,
          )
            ? (reward.metadata as Record<
                string,
                unknown
              >)
            : {},

        createdAt:
          reward.created_at,
      }),
    );

  return {
    rewards,
  };
}

/**
 * Get the authenticated user's level-up history.
 */
export async function getMyLevelHistory(
  userId: string,
  query: LevelHistoryQuery,
): Promise<LevelHistoryResult> {
  const {
    limit,
    offset,
  } = query;

  const {
    data,
    error,
  } = await supabase
    .from("user_level_history")
    .select(
      "id, old_level, new_level, xp_at_level_up, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    })
    .range(
      offset,
      offset + limit - 1,
    );

  if (error) {
    throw error;
  }

  const history =
    (data ?? []).map(
      (item: LevelHistoryRow) => ({
        id: item.id,

        oldLevel:
          item.old_level,

        newLevel:
          item.new_level,

        xpAtLevelUp: toNumber(
          item.xp_at_level_up,
        ),

        createdAt:
          item.created_at,
      }),
    );

  return {
    history,
  };
}

/**
 * Internal service used by future systems such as Tasks,
 * Live, Gifts, etc. to award XP.
 *
 * This is intentionally NOT exposed as an HTTP endpoint.
 */
export async function addXp(
  userId: string,
  amount: number,
): Promise<void> {
  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    throw new AppError(
      400,
      "XP amount must be a positive integer",
      {
        code: "INVALID_XP_AMOUNT",
      },
    );
  }

  const {
    data: progress,
    error: progressError,
  } = await supabase
    .from("user_level_progress")
    .select(
      "user_id, total_xp",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (progressError) {
    throw progressError;
  }

  const currentTotalXp =
    progress?.total_xp ?? 0;

  const newTotalXp =
    currentTotalXp + amount;

  /**
   * Find the highest level whose XP
   * requirement is <= the user's total XP.
   */
  const {
    data: newDefinition,
    error: definitionError,
  } = await supabase
    .from("level_definitions")
    .select(
      "level, xp_required, title, created_at",
    )
    .lte(
      "xp_required",
      newTotalXp,
    )
    .order("level", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (definitionError) {
    throw definitionError;
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, level")
    .eq("id", userId)
    .single();

  if (profileError) {
    throw profileError;
  }

  const oldLevel =
    profile.level ?? 1;

  const newLevel =
    newDefinition?.level ??
    oldLevel;

  /**
   * Make sure a progress row exists.
   */
  const {
    error: upsertError,
  } = await supabase
    .from("user_level_progress")
    .upsert(
      {
        user_id: userId,
        total_xp: newTotalXp,
      },
      {
        onConflict: "user_id",
      },
    );

  if (upsertError) {
    throw upsertError;
  }

  /**
   * Update the cached current level only
   * when the calculated level has changed.
   */
  if (newLevel !== oldLevel) {
    const {
      error: profileUpdateError,
    } = await supabase
      .from("profiles")
      .update({
        level: newLevel,
      })
      .eq("id", userId);

    if (profileUpdateError) {
      throw profileUpdateError;
    }

    /**
     * Record every level-up.
     */
    const {
      error: historyError,
    } = await supabase
      .from("user_level_history")
      .insert({
        user_id: userId,
        old_level: oldLevel,
        new_level: newLevel,
        xp_at_level_up: newTotalXp,
      });

    if (historyError) {
      throw historyError;
    }
  }
}