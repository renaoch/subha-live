import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { addXp } from "../levels/levels.service";

import type {
  TaskItem,
  TasksResult,
  ClaimTaskResult,
  TaskReward,
} from "./tasks.types";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  duration_type: string;
  expiry_date: string | null;
  icon_url: string | null;
  reward_coins: number;
  reward_diamonds: number;
  reward_exp: number;
  status: string;
  target_count: number;
  target_gender: string;
};

type UserTaskRow = {
  id: string;
  user_id: string;
  task_id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  completed_at: string | null;
  claimed_at: string | null;
  updated_at: string;
};

function toNumber(
  value: number | null | undefined,
): number {
  return value ?? 0;
}

function toTaskReward(
  task: TaskRow,
): TaskReward {
  return {
    coins: toNumber(task.reward_coins),
    diamonds: toNumber(task.reward_diamonds),
    exp: toNumber(task.reward_exp),
  };
}

/**
 * Get all active tasks for the authenticated user.
 */
export async function getMyTasks(
  userId: string,
): Promise<TasksResult> {
  const now =
    new Date().toISOString();

  const {
    data: tasks,
    error: tasksError,
  } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      description,
      duration_type,
      expiry_date,
      icon_url,
      reward_coins,
      reward_diamonds,
      reward_exp,
      status,
      target_count,
      target_gender
    `)
    .eq("status", "active")
    .or(
      `expiry_date.is.null,expiry_date.gt.${now}`,
    )
    .order("created_at", {
      ascending: true,
    });

  if (tasksError) {
    throw tasksError;
  }

  const taskRows =
    (tasks ?? []) as TaskRow[];

  if (taskRows.length === 0) {
    return {
      tasks: [],
    };
  }

  const taskIds =
    taskRows.map(
      (task) => task.id,
    );

  const {
    data: userTasks,
    error: userTasksError,
  } = await supabase
    .from("user_tasks")
    .select(`
      id,
      user_id,
      task_id,
      progress,
      completed,
      claimed,
      completed_at,
      claimed_at,
      updated_at
    `)
    .eq("user_id", userId)
    .in("task_id", taskIds);

  if (userTasksError) {
    throw userTasksError;
  }

  const userTaskRows =
    (userTasks ?? []) as UserTaskRow[];

  const userTasksByTaskId =
    new Map<string, UserTaskRow>();

  for (const userTask of userTaskRows) {
    userTasksByTaskId.set(
      userTask.task_id,
      userTask,
    );
  }

  const result: TaskItem[] =
    taskRows.map((task) => {
      const userTask =
        userTasksByTaskId.get(
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
            userTask?.progress ?? 0,
          ),
        );

      return {
        id: task.id,
        title: task.title,
        description:
          task.description,
        type:
          task.duration_type,
        icon:
          task.icon_url,
        targetCount,

        reward:
          toTaskReward(task),

        progress: {
          progress,
          targetCount,

          isCompleted:
            userTask?.completed ??
            progress >= targetCount,

          isClaimed:
            userTask?.claimed ??
            false,

          completedAt:
            userTask?.completed_at ??
            null,

          claimedAt:
            userTask?.claimed_at ??
            null,
        },
      };
    });

  return {
    tasks: result,
  };
}

/**
 * Get one task by ID.
 */
async function getTaskById(
  taskId: string,
): Promise<TaskRow> {
  const {
    data,
    error,
  } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      description,
      duration_type,
      expiry_date,
      icon_url,
      reward_coins,
      reward_diamonds,
      reward_exp,
      status,
      target_count,
      target_gender
    `)
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

  return data as TaskRow;
}

/**
 * Increment progress for a task.
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

  if (task.status !== "active") {
    return;
  }

  if (
    task.expiry_date &&
    new Date(task.expiry_date) <=
      new Date()
  ) {
    return;
  }

  const targetCount =
    Math.max(
      1,
      task.target_count ?? 1,
    );

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("user_tasks")
    .select(`
      id,
      user_id,
      task_id,
      progress,
      completed,
      claimed,
      completed_at,
      claimed_at,
      updated_at
    `)
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.claimed) {
    return;
  }

  const currentProgress =
    existing?.progress ?? 0;

  const newProgress =
    Math.min(
      targetCount,
      currentProgress + amount,
    );

  const completed =
    newProgress >= targetCount;

  const now =
    new Date().toISOString();

  if (existing) {
    const {
      error: updateError,
    } = await supabase
      .from("user_tasks")
      .update({
        progress: newProgress,
        completed,

        completed_at:
          completed
            ? existing.completed_at ??
              now
            : null,

        updated_at: now,
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
    .from("user_tasks")
    .insert({
      user_id: userId,
      task_id: taskId,
      progress: newProgress,
      completed,

      completed_at:
        completed
          ? now
          : null,
    });

  if (insertError) {
    throw insertError;
  }
}

/**
 * Claim a completed task.
 */
export async function claimTask(
  userId: string,
  taskId: string,
): Promise<ClaimTaskResult> {
  const task =
    await getTaskById(taskId);

  if (task.status !== "active") {
    throw new AppError(
      400,
      "Task is no longer active",
      {
        code: "TASK_NOT_ACTIVE",
      },
    );
  }

  if (
    task.expiry_date &&
    new Date(task.expiry_date) <=
      new Date()
  ) {
    throw new AppError(
      400,
      "Task has expired",
      {
        code: "TASK_EXPIRED",
      },
    );
  }

  const {
    data: userTask,
    error: userTaskError,
  } = await supabase
    .from("user_tasks")
    .select(`
      id,
      user_id,
      task_id,
      progress,
      completed,
      claimed,
      completed_at,
      claimed_at,
      updated_at
    `)
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (userTaskError) {
    throw userTaskError;
  }

  if (!userTask) {
    throw new AppError(
      400,
      "Task has not been completed",
      {
        code: "TASK_NOT_COMPLETED",
      },
    );
  }

  if (!userTask.completed) {
    throw new AppError(
      400,
      "Task has not been completed",
      {
        code: "TASK_NOT_COMPLETED",
      },
    );
  }

  if (userTask.claimed) {
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

  /**
   * Read current wallet.
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
    currentCoins +
    reward.coins;

  const newDiamonds =
    currentDiamonds +
    reward.diamonds;

  /**
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

  /**
   * Award XP.
   */
  if (reward.exp > 0) {
    await addXp(
      userId,
      reward.exp,
    );
  }

  /**
   * Mark task as claimed.
   */
  const now =
    new Date().toISOString();

  const {
    error: claimUpdateError,
  } = await supabase
    .from("user_tasks")
    .update({
      claimed: true,
      claimed_at: now,
      updated_at: now,
    })
    .eq("id", userTask.id)
    .eq("user_id", userId)
    .eq("claimed", false);

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