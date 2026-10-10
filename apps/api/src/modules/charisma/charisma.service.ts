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
import { wishService } from "../wishes/wish.service";
import { hostTaskService } from "../host-task/host-task.service";
import { pkService } from "../pk/pk.service";
import { getGiftCatalogItem, sendGiftTransaction } from "../financial/financial.service";
import { publishGiftToRoomChat } from "../financial/financial-chat";

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
 * Sends a gift. This is the single entry point for gift-sending — call it
 * from wherever gifts are actually triggered in the app (a live room, a
 * profile page, etc).
 *
 * Financial correctness (coin deduction, host diamond credit, platform/
 * agency share, idempotency, concurrency-safe balance locking) is handled
 * entirely by financial.service.ts#sendGiftTransaction, which calls the
 * fin_send_gift() Postgres function — an atomic transaction. This
 * function ONLY runs after that transaction has committed successfully;
 * everything below (the `gifts` display row, charisma progress, room/
 * host-task/PK hooks) is presentation/progression state, never money.
 *
 * The client supplies a gift_id (catalog reference) and a
 * clientRequestId (idempotency key) — never a price or value.
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

  const catalogItem = await getGiftCatalogItem(input.giftId);
  if (!catalogItem || !catalogItem.isActive) {
    throw new AppError(404, "Gift not found", { code: "GIFT_NOT_FOUND" });
  }

  // Atomic financial transaction(s): each deducts sender coins, credits the
  // recipient diamonds (net of platform/agency share) and records the ledger.
  // A multi-send is N independent single transactions, each with a derived
  // idempotency key (`<id>#<n>`), so a retried request can never double-charge
  // and every unit is priced/validated by the same trusted SQL as a single
  // send. If the sender runs out of coins part-way, we stop and report how
  // many were delivered instead of failing the ones that already went through.
  const quantity = input.quantity ?? 1;
  let delivered = 0; // transactions that succeeded (new or already processed)
  let newlyCharged = 0; // transactions that moved money in THIS request
  let firstTransactionId: string | null = null;
  for (let i = 0; i < quantity; i++) {
    try {
      const tx = await sendGiftTransaction({
        senderId,
        recipientId: input.recipientId,
        giftId: input.giftId,
        roomId: input.roomId ?? null,
        clientRequestId: i === 0 ? input.clientRequestId : `${input.clientRequestId}#${i}`,
      });
      delivered++;
      if (!tx.alreadyProcessed) newlyCharged++;
      if (!firstTransactionId) firstTransactionId = tx.giftTransactionId;
    } catch (error) {
      // Nothing went through: surface the real error (e.g. INSUFFICIENT_BALANCE).
      if (delivered === 0) throw error;
      // Some went through: keep them, stop here, report the partial count.
      break;
    }
  }
  const chargedValue = catalogItem.coinPrice * newlyCharged;

  // This is the ONLY entry point the client actually calls to send a gift
  // (the room UI calls POST /api/v1/charisma/send, never
  // /api/v1/financial/gifts/send), so this is where the room hears about it.
  // ONE chat row is published for the whole batch: the combo counter is bumped
  // by `newlyCharged`, so "x66" is exact. Fire-and-forget and idempotency
  // guarded — a retried/duplicate request (newlyCharged = 0) never re-posts.
  if (newlyCharged > 0 && input.roomId && firstTransactionId) {
    void publishGiftToRoomChat({
      roomId: input.roomId,
      senderId,
      giftId: input.giftId,
      giftTransactionId: firstTransactionId,
      count: newlyCharged,
    });
  }

  // Display/history rows: one per gift actually charged, in a single insert.
  let gift: any = null;
  let giftError: { message?: string } | null = null;
  if (newlyCharged > 0) {
    const insertRows = Array.from({ length: newlyCharged }, () => ({
      sender_id: senderId,
      recipient_id: input.recipientId,
      gift_name: catalogItem.name,
      gift_icon: catalogItem.icon,
      value: catalogItem.coinPrice,
      stream_id: input.streamId ?? null,
      // TODO: remove this cast once database.types.ts is regenerated
      // after running 20260829_room_tasks.sql (adds gifts.room_id).
      room_id: input.roomId ?? null,
    }));
    const result = await supabase
      .from("gifts")
      .insert(insertRows as never)
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
      );
    giftError = result.error;
    gift = (result.data as any[] | null)?.[0] ?? null;
  }

  if (giftError) {
    // The money has already moved (fin_send_gift committed). This insert
    // is a display/history record — log and continue rather than making
    // the sender think their gift failed after they've already been
    // charged. The charisma/room-task/PK hooks below still run using the
    // catalog values we already have.
    console.error("[sendGift] failed to write display record for a committed financial transaction:", giftError);
  }

  const giftRow = gift ?? {
    id: input.clientRequestId,
    value: catalogItem.coinPrice,
    gift_name: catalogItem.name,
    gift_icon: catalogItem.icon,
    created_at: new Date().toISOString(),
    sender: null,
    recipient: null,
  };

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
    (progressRow?.total_charisma ?? 0) + chargedValue;

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

  const sender: any = (giftRow as any).sender;
  const recipient: any = (giftRow as any).recipient;

  // Best-effort: if this gift was sent inside a room that has a live
  // task/goal running, count its value toward that goal. Never let a
  // task-progress hiccup fail the gift itself.
  if (input.roomId) {
    roomTaskService.bumpProgress(input.roomId, chargedValue).catch((err) => {
      console.error("[sendGift] failed to bump room task progress:", err);
    });

    // Wish Box: a gift the host wished for moves that wish toward its target.
    // (the SQL applies one gift at a time, so replay it once per unit, in order)
    const wishRoomId = input.roomId;
    void (async () => {
      for (let i = 0; i < newlyCharged; i++) await wishService.applyGift(wishRoomId, input.giftId);
    })();

    // Per-user "coins earned from this room" progress: the gift's recipient
    // (typically the host) earns coin-progress toward any active eligible
    // host task in the room.
    hostTaskService.recordCoinProgress(input.roomId, input.recipientId, chargedValue).catch((err) => {
      console.error("[sendGift] failed to record host-task coin progress:", err);
    });
  }

  // PK battle scoring: only AFTER the gift transaction committed durably.
  // Tied to giftRow.id for idempotency — never score before the gift succeeded,
  // and never score the same gift twice.
  if (chargedValue > 0) {
    pkService.recordGiftScore(input.recipientId, chargedValue, giftRow.id).catch((err) => {
      console.error("[sendGift] failed to record PK score:", err);
    });
  }

  return {
    id: giftRow.id,

    senderId,
    senderName: sender?.name ?? "Unknown",
    senderAvatar: sender?.avatar ?? null,
    senderLevel: sender?.level ?? 1,

    recipientId: input.recipientId,
    recipientName: recipient?.name ?? "Unknown",
    recipientAvatar: recipient?.avatar ?? null,
    recipientLevel: newLevel,

    giftName: giftRow.gift_name,
    giftIcon: giftRow.gift_icon,
    value: toNumber(giftRow.value),
    createdAt: giftRow.created_at,
    quantity: delivered,
    requestedQuantity: quantity,
    totalValue: catalogItem.coinPrice * delivered,
  };
}