import { supabase } from "../../lib/supabase";

import { AppError } from "../../errors/app-error";

import type {
  CharismaDefinition,
  CharismaOverview,
  CharismaProgress,
  GiftItem,
  GiftListResult,
} from "./charisma.type";

import type { GiftListQuery, SendGiftInput } from "./charisma.schema";

import { roomTaskService } from "../room-tasks/room-task.service";
import { hostTaskService } from "../host-task/host-task.service";

function toNumber(value: number | null): number {
  return value ?? 0;
}

function calculateCharismaProgress(
  totalCharisma: number,
  currentLevel: number,
  currentDefinition: CharismaDefinition | null,
  nextDefinition: CharismaDefinition | null,
): CharismaProgress {
  const currentLevelCharisma =
    currentDefinition?.charisma_required ?? 0;

  const nextLevelCharisma =
    nextDefinition?.charisma_required ?? null;

  const charismaIntoLevel = Math.max(
    0,
    totalCharisma - currentLevelCharisma,
  );

  const charismaRequiredForLevel =
    nextLevelCharisma !== null
      ? Math.max(0, nextLevelCharisma - currentLevelCharisma)
      : 0;

  let progress = 0;

  if (nextLevelCharisma !== null) {
    progress =
      charismaRequiredForLevel <= 0
        ? 100
        : (charismaIntoLevel / charismaRequiredForLevel) * 100;
  } else {
    progress = 100;
  }

  progress = Math.min(100, Math.max(0, progress));

  return {
    currentLevel,

    currentCharisma: charismaIntoLevel,

    totalCharisma,

    currentLevelCharisma,

    nextLevelCharisma,

    progress: Number(progress.toFixed(2)),

    nextLevel: nextDefinition?.level ?? null,

    currentTitle: currentDefinition?.title ?? null,

    nextTitle: nextDefinition?.title ?? null,
  };
}

/**
 * Get the authenticated user's charisma overview.
 *
 * profiles.charisma_level is the cached display tier.
 * user_charisma_progress.total_charisma stores cumulative gift value received.
 */
export async function getMyCharisma(
  userId: string,
): Promise<CharismaOverview> {
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, charisma_level")
    .eq("id", userId)
    .single();

  if (profileError) {
    if (profileError.code === "PGRST116") {
      throw new AppError(404, "User profile not found", {
        code: "PROFILE_NOT_FOUND",
      });
    }

    throw profileError;
  }

  const currentLevel = profile.charisma_level ?? 1;

  const {
    data: progressRow,
    error: progressError,
  } = await supabase
    .from("user_charisma_progress")
    .select("user_id, total_charisma, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (progressError) {
    throw progressError;
  }

  const totalCharisma = progressRow?.total_charisma ?? 0;

  /**
   * Existing users may not have a progress row yet.
   * Create it lazily, same pattern as levels.service.ts.
   */
  if (!progressRow) {
    const { error: insertError } = await supabase
      .from("user_charisma_progress")
      .insert({ user_id: userId, total_charisma: 0 });

    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }
  }

  const {
    data: currentDefinition,
    error: currentDefinitionError,
  } = await supabase
    .from("charisma_definitions")
    .select("level, charisma_required, title, created_at")
    .eq("level", currentLevel)
    .maybeSingle();

  if (currentDefinitionError) {
    throw currentDefinitionError;
  }

  const {
    data: nextDefinition,
    error: nextDefinitionError,
  } = await supabase
    .from("charisma_definitions")
    .select("level, charisma_required, title, created_at")
    .gt("level", currentLevel)
    .order("level", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextDefinitionError) {
    throw nextDefinitionError;
  }

  const progress = calculateCharismaProgress(
    totalCharisma,
    currentLevel,
    currentDefinition,
    nextDefinition,
  );

  return { progress };
}

/**
 * Get gifts sent or received by the authenticated user.
 *
 * Every row joins BOTH the sender and recipient profile, so the
 * frontend always has both parties' name/avatar/level available
 * regardless of which direction is being viewed.
 */
export async function getMyGifts(
  userId: string,
  query: GiftListQuery,
): Promise<GiftListResult> {
  const { direction, limit, offset } = query;

  const filterColumn =
    direction === "incoming" ? "recipient_id" : "sender_id";

  const {
    data,
    error,
    count,
  } = await supabase
    .from("gifts")
    .select(
      `
        id,
        value,
        gift_name,
        gift_icon,
        created_at,
        sender:profiles!gifts_sender_id_fkey(id, name, avatar, level),
        recipient:profiles!gifts_recipient_id_fkey(id, name, avatar, level)
      `,
      { count: "exact" },
    )
    .eq(filterColumn, userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  const {
    data: totalsData,
    error: totalsError,
  } = await supabase
    .from("gifts")
    .select("value")
    .eq(filterColumn, userId);

  if (totalsError) {
    throw totalsError;
  }

const totalValue = (totalsData ?? []).reduce(
  (sum: number, row: { value: number | null }) => sum + toNumber(row.value),
  0,
);

  const gifts: GiftItem[] = (data ?? []).map((row: any) => ({
    id: row.id,

    senderId: row.sender?.id,
    senderName: row.sender?.name ?? "Unknown",
    senderAvatar: row.sender?.avatar ?? null,
    senderLevel: row.sender?.level ?? 1,

    recipientId: row.recipient?.id,
    recipientName: row.recipient?.name ?? "Unknown",
    recipientAvatar: row.recipient?.avatar ?? null,
    recipientLevel: row.recipient?.level ?? 1,

    giftName: row.gift_name,
    giftIcon: row.gift_icon,
    value: toNumber(row.value),
    createdAt: row.created_at,
  }));

  return {
    gifts,
    totalValue,
    count: count ?? gifts.length,
  };
}

/**
 * Records a gift and updates the recipient's charisma progress.
 *
 * This is the single source of truth for gift-sending — call it from
 * wherever gifts are actually triggered in the app (a live room, a
 * profile page, etc). It handles the ledger row, the recipient's
 * cumulative charisma, and recalculating/caching their charisma tier.
 */
export async function sendGift(
  senderId: string,
  input: SendGiftInput,
): Promise<GiftItem> {
  if (senderId === input.recipientId) {
    throw new AppError(400, "You cannot send a gift to yourself", {
      code: "INVALID_GIFT_RECIPIENT",
    });
  }

  const {
    data: gift,
    error: giftError,
  } = await supabase
    .from("gifts")
    .insert({
      sender_id: senderId,
      recipient_id: input.recipientId,
      gift_name: input.giftName,
      gift_icon: input.giftIcon,
      value: input.value,
      stream_id: input.streamId ?? null,
      // TODO: remove this cast once database.types.ts is regenerated
      // after running 20260829_room_tasks.sql (adds gifts.room_id) —
      // the generated Insert type doesn't know about the column yet.
      room_id: input.roomId ?? null,
    } as never)
    .select(
      `
        id,
        value,
        gift_name,
        gift_icon,
        created_at,
        sender:profiles!gifts_sender_id_fkey(id, name, avatar, level),
        recipient:profiles!gifts_recipient_id_fkey(id, name, avatar, level)
      `,
    )
    .single();

  if (giftError) {
    throw giftError;
  }

  const {
    data: progressRow,
    error: progressError,
  } = await supabase
    .from("user_charisma_progress")
    .select("user_id, total_charisma")
    .eq("user_id", input.recipientId)
    .maybeSingle();

  if (progressError) {
    throw progressError;
  }

  const newTotalCharisma =
    (progressRow?.total_charisma ?? 0) + input.value;

  const { error: upsertError } = await supabase
    .from("user_charisma_progress")
    .upsert(
      {
        user_id: input.recipientId,
        total_charisma: newTotalCharisma,
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    throw upsertError;
  }

  /**
   * Find the highest tier whose requirement is <= the recipient's new total.
   */
  const {
    data: newDefinition,
    error: definitionError,
  } = await supabase
    .from("charisma_definitions")
    .select("level")
    .lte("charisma_required", newTotalCharisma)
    .order("level", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (definitionError) {
    throw definitionError;
  }

  const {
    data: recipientProfile,
    error: recipientProfileError,
  } = await supabase
    .from("profiles")
    .select("id, charisma_level")
    .eq("id", input.recipientId)
    .single();

  if (recipientProfileError) {
    throw recipientProfileError;
  }

  const oldLevel = recipientProfile.charisma_level ?? 1;
  const newLevel = newDefinition?.level ?? oldLevel;

  if (newLevel !== oldLevel) {
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ charisma_level: newLevel })
      .eq("id", input.recipientId);

    if (profileUpdateError) {
      throw profileUpdateError;
    }
  }

  const sender: any = (gift as any).sender;
  const recipient: any = (gift as any).recipient;

  // Best-effort: if this gift was sent inside a room that has a live
  // task/goal running, count its value toward that goal. Never let a
  // task-progress hiccup fail the gift itself.
  if (input.roomId) {
    roomTaskService.bumpProgress(input.roomId, input.value).catch((err) => {
      console.error("[sendGift] failed to bump room task progress:", err);
    });

    // Per-user "coins earned from this room" progress: the gift's recipient
    // (typically the host) earns coin-progress toward any active eligible
    // host task in the room.
    hostTaskService.recordCoinProgress(input.roomId, input.recipientId, input.value).catch((err) => {
      console.error("[sendGift] failed to record host-task coin progress:", err);
    });
  }

  return {
    id: gift.id,

    senderId,
    senderName: sender?.name ?? "Unknown",
    senderAvatar: sender?.avatar ?? null,
    senderLevel: sender?.level ?? 1,

    recipientId: input.recipientId,
    recipientName: recipient?.name ?? "Unknown",
    recipientAvatar: recipient?.avatar ?? null,
    recipientLevel: newLevel,

    giftName: gift.gift_name,
    giftIcon: gift.gift_icon,
    value: toNumber(gift.value),
    createdAt: gift.created_at,
  };
}