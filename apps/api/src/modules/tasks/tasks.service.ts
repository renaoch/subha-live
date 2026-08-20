import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

import { addXp } from "../levels/levels.service";

import type {
  DailyTask,
  UserTaskClaim,
  TaskItem,
  TasksResult,
  ClaimTaskResult,
  TaskReward,
} from "./tasks.types";

type DailyTaskRow = Pick<
  DailyTask,
  | "id"
  | "title"
  | "reward_coins"
  | "reward_diamonds"
  | "reward_exp"
  | "target_count"
  | "type"
  | "icon"
>;

type UserTaskClaimRow = Pick<
  UserTaskClaim,
  | "id"
  | "user_id"
  | "task_id"
  | "progress"
  | "is_completed"
  | "is_claimed"
  | "claimed_at"
  | "updated_at"
>;

function toNumber(
  value: number | null,
): number {
  return value ?? 0;
}

function toTaskReward(
  task: DailyTaskRow,
): TaskReward {
  return {
    coins: toNumber(
      task.reward_coins,
    ),

    diamonds: toNumber(
      task.reward_diamonds,
    ),

    exp: toNumber(
      task.reward_exp,
    ),
  };
}

/**
 * Get all active daily tasks for the authenticated user.
 *
 * This does not create task claim rows for every task.
 * Missing claim rows simply mean zero progress.
 */
export async function getMyTasks(
  userId: string,
): Promise<TasksResult> {
  const {
    data: tasks,
    error: tasksError,
  } = await supabase
    .from("daily_tasks")
    .select(
      `
        id,
        title,
        reward_coins,
        reward_diamonds,
        reward_exp,
        target_count,
        type,
        icon
      `,
    )
    .order("id", {
      ascending: true,
    });

  if (tasksError) {
    throw tasksError;
  }

  const activeTasks =
    (tasks ?? []) as DailyTaskRow[];

  if (activeTasks.length === 0) {
    return {
      tasks: [],
    };
  }

  const taskIds =
    activeTasks.map(
      (task) => task.id,
    );

  const {
    data: claims,
    error: claimsError,
  } = await supabase
    .from("user_task_claims")
    .select(
      `
        id,
        user_id,
        task_id,
        progress,
        is_completed,
        is_claimed,
        claimed_at,
        updated_at
      `,
    )
    .eq("user_id", userId)
    .in("task_id", taskIds);

  if (claimsError) {
    throw claimsError;
  }

  const claimRows =
    (claims ?? []) as UserTaskClaimRow[];

  const claimsByTaskId =
    new Map<string, UserTaskClaimRow>();

  for (const claim of claimRows) {
    claimsByTaskId.set(
      claim.task_id,
      claim,
    );
  }

  const result: TaskItem[] =
    activeTasks.map(
      (task) => {
        const claim =
          claimsByTaskId.get(
            task.id,
          );

        const targetCount =
          Math.max(
            1,
            task.target_count ?? 1,
          );

        const progress =
          Math.min(
            targetCount,
            Math.max(
              0,
              claim?.progress ?? 0,
            ),
          );

        return {
          id: task.id,

          title: task.title,

          type: task.type,

          icon: task.icon,

          targetCount,

          reward:
            toTaskReward(task),

          progress: {
            progress,

            targetCount,

            isCompleted:
              claim?.is_completed ??
              progress >= targetCount,

            isClaimed:
              claim?.is_claimed ??
              false,

            completedAt:
              null,

            claimedAt:
              claim?.claimed_at ??
              null,
          },
        };
      },
    );

  return {
    tasks: result,
  };
}

/**
 * Get a single task by ID.
 */
async function getTaskById(
  taskId: string,
): Promise<DailyTaskRow> {
  const {
    data,
    error,
  } = await supabase
    .from("daily_tasks")
    .select(
      `
        id,
        title,
        reward_coins,
        reward_diamonds,
        reward_exp,
        target_count,
        type,
        icon
      `,
    )
    .eq("id", taskId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "Task not found",
        {
          code: "TASK_NOT_FOUND",
        },
      );
    }

    throw error;
  }

  return data as DailyTaskRow;
}

/**
 * Internal task-progress mutation.
 *
 * This is intentionally NOT exposed directly as a public HTTP
 * endpoint. Future modules such as live, social, gifts, etc.
 * should call this function when a real user action occurs.
 *
 * Example:
 *
 *   await incrementTaskProgress(
 *     userId,
 *     "watch_live",
 *     1,
 *   );
 */
export async function incrementTaskProgress(
  userId: string,
  taskId: string,
  amount = 1,
): Promise<void> {
  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    throw new AppError(
      400,
      "Progress amount must be a positive integer",
      {
        code: "INVALID_TASK_PROGRESS",
      },
    );
  }

  const task =
    await getTaskById(taskId);

  const targetCount =
    Math.max(
      1,
      task.target_count ?? 1,
    );

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("user_task_claims")
    .select(
      `
        id,
        user_id,
        task_id,
        progress,
        is_completed,
        is_claimed,
        claimed_at,
        updated_at
      `,
    )
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.is_claimed) {
    return;
  }

  const currentProgress =
    existing?.progress ?? 0;

  const newProgress =
    Math.min(
      targetCount,
      currentProgress + amount,
    );

  const isCompleted =
    newProgress >= targetCount;

  if (existing) {
    const {
      error: updateError,
    } = await supabase
      .from("user_task_claims")
      .update({
        progress: newProgress,
        is_completed: isCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  const {
    error: insertError,
  } = await supabase
    .from("user_task_claims")
    .insert({
      user_id: userId,
      task_id: taskId,
      progress: newProgress,
      is_completed: isCompleted,
    });

  if (insertError) {
    throw insertError;
  }
}

/**
 * Claim a completed task.
 *
 * The server reads all rewards from daily_tasks.
 * The client cannot modify the reward amount.
 */
export async function claimTask(
  userId: string,
  taskId: string,
): Promise<ClaimTaskResult> {
  const task =
    await getTaskById(taskId);

  const {
    data: claim,
    error: claimError,
  } = await supabase
    .from("user_task_claims")
    .select(
      `
        id,
        user_id,
        task_id,
        progress,
        is_completed,
        is_claimed,
        claimed_at,
        updated_at
      `,
    )
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claim) {
    throw new AppError(
      400,
      "Task has not been completed",
      {
        code: "TASK_NOT_COMPLETED",
      },
    );
  }

  if (!claim.is_completed) {
    throw new AppError(
      400,
      "Task has not been completed",
      {
        code: "TASK_NOT_COMPLETED",
      },
    );
  }

  if (claim.is_claimed) {
    throw new AppError(
      409,
      "Task reward has already been claimed",
      {
        code: "TASK_ALREADY_CLAIMED",
      },
    );
  }

  const reward =
    toTaskReward(task);

  /*
   * Read the current wallet values.
   */
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      "id, coins, diamonds",
    )
    .eq("id", userId)
    .single();

  if (profileError) {
    throw profileError;
  }

  const currentCoins =
    profile.coins ?? 0;

  const currentDiamonds =
    profile.diamonds ?? 0;

  const newCoins =
    currentCoins + reward.coins;

  const newDiamonds =
    currentDiamonds +
    reward.diamonds;

  /*
   * Update wallet.
   */
  const {
    error: walletError,
  } = await supabase
    .from("profiles")
    .update({
      coins: newCoins,
      diamonds: newDiamonds,
    })
    .eq("id", userId);

  if (walletError) {
    throw walletError;
  }

  /*
   * Award XP through the Level service.
   */
  if (reward.exp > 0) {
    await addXp(
      userId,
      reward.exp,
    );
  }

  /*
   * Mark reward as claimed.
   */
  const {
    error: claimUpdateError,
  } = await supabase
    .from("user_task_claims")
    .update({
      is_claimed: true,
      claimed_at:
        new Date().toISOString(),
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", claim.id)
    .eq("user_id", userId)
    .eq("is_claimed", false);

  if (claimUpdateError) {
    throw claimUpdateError;
  }

  return {
    taskId,

    reward,

    newCoins,

    newDiamonds,
  };
}