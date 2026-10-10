import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { getActiveGiftCatalog } from "../financial/financial.service";

export interface RoomWish {
  giftId: string;
  code: string;
  name: string;
  icon: string;
  coinPrice: number;
  targetCount: number;
  currentCount: number;
}

export interface RoomWishes {
  wishes: RoomWish[];
  /** Sum of fulfilled / sum of requested across all wishes ("0/10"). */
  fulfilled: number;
  total: number;
}

const wishTable = () => supabase.from("room_wishes" as any) as any;

export const MAX_WISHES = 5;

async function assertIsRoomHost(roomId: string, userId: string): Promise<void> {
  const { data, error } = await supabase.from("rooms").select("host_id").eq("id", roomId).maybeSingle();
  if (error) {
    throw new AppError(500, "Failed to look up room", { code: "ROOM_LOOKUP_FAILED", details: error.message });
  }
  if (!data) throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
  if (data.host_id !== userId) {
    throw new AppError(403, "Only the room host can edit the Wish Box", { code: "WISH_FORBIDDEN" });
  }
}

export const wishService = {
  async list(roomId: string): Promise<RoomWishes> {
    const { data, error } = await wishTable()
      .select("gift_id, target_count, current_count, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    if (error) {
      throw new AppError(500, "Failed to load wishes", { code: "WISH_LIST_FAILED", details: error.message });
    }
    const catalog = await getActiveGiftCatalog();
    const wishes: RoomWish[] = [];
    for (const row of (data ?? []) as any[]) {
      const gift = catalog.find((g) => g.id === row.gift_id);
      if (!gift) continue; // gift was retired from the catalog
      wishes.push({
        giftId: gift.id,
        code: gift.code,
        name: gift.name,
        icon: gift.icon,
        coinPrice: gift.coinPrice,
        targetCount: row.target_count,
        currentCount: Math.min(row.current_count, row.target_count),
      });
    }
    return {
      wishes,
      fulfilled: wishes.reduce((n, w) => n + w.currentCount, 0),
      total: wishes.reduce((n, w) => n + w.targetCount, 0),
    };
  },

  /** Host replaces the room's wish list. Existing progress is kept for gifts that stay. */
  async replace(
    roomId: string,
    userId: string,
    items: Array<{ giftId: string; targetCount: number }>,
  ): Promise<RoomWishes> {
    await assertIsRoomHost(roomId, userId);

    const unique = new Map<string, number>();
    for (const it of items) unique.set(it.giftId, it.targetCount);
    if (unique.size > MAX_WISHES) {
      throw new AppError(400, `You can add up to ${MAX_WISHES} wishes`, { code: "WISH_LIMIT" });
    }

    const catalog = await getActiveGiftCatalog();
    for (const giftId of unique.keys()) {
      if (!catalog.some((g) => g.id === giftId)) {
        throw new AppError(400, "Unknown gift", { code: "WISH_UNKNOWN_GIFT" });
      }
    }

    const keep = [...unique.keys()];
    const del = wishTable().delete().eq("room_id", roomId);
    const { error: delError } = keep.length ? await del.not("gift_id", "in", `(${keep.join(",")})`) : await del;
    if (delError) {
      throw new AppError(500, "Failed to update wishes", { code: "WISH_UPDATE_FAILED", details: delError.message });
    }

    if (keep.length) {
      const { error } = await wishTable().upsert(
        keep.map((giftId) => ({ room_id: roomId, gift_id: giftId, target_count: unique.get(giftId), updated_at: new Date().toISOString() })),
        { onConflict: "room_id,gift_id" },
      );
      if (error) {
        throw new AppError(500, "Failed to update wishes", { code: "WISH_UPDATE_FAILED", details: error.message });
      }
    }
    return this.list(roomId);
  },

  /** Called after a gift commits. Atomic, capped at target, never throws into the gift flow. */
  async applyGift(roomId: string, giftId: string): Promise<void> {
    const { error } = await supabase.rpc("wish_apply_gift" as any, { p_room_id: roomId, p_gift_id: giftId });
    if (error) console.error("[wishes] apply failed:", error.message);
  },
};
