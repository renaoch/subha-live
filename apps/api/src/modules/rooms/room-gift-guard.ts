import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { roomStageService } from "./room-stage.service";
import { roomModerationState } from "./room-moderation.state";

/**
 * Who may be gifted inside a room. Runs BEFORE the (unchanged) coin/earnings
 * transaction, on every gift entry point, so a direct API call can't bypass
 * the UI rules.
 *
 *  - No room, or the recipient is the room's host -> existing behaviour, untouched.
 *  - Recipient is anyone else (a stage speaker) -> only allowed in Party Voice
 *    (audio) rooms, only if they are on a stage seat RIGHT NOW, and only if the
 *    sender is not blocked from the room. This covers viewer->speaker and
 *    speaker->speaker. Other room types keep their current rules.
 *
 * The recipient is always the user id the client sent, validated here against
 * live stage state — never a slot index, never a fallback to the host.
 */
export async function assertGiftRecipientAllowed(input: {
  senderId: string;
  recipientId: string;
  roomId?: string | null;
}): Promise<void> {
  const { senderId, recipientId, roomId } = input;
  if (!roomId) return;

  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, host_id, media_type, status")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to verify gift room", { code: "GIFT_ROOM_LOOKUP_FAILED", details: error.message });
  }
  if (!room) throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });

  if (recipientId === room.host_id) return; // existing host-gift behaviour

  if (room.media_type !== "audio") {
    throw new AppError(403, "Gifts to stage participants are only available in Party Voice rooms", {
      code: "GIFT_ROOM_TYPE_NOT_ALLOWED",
    });
  }
  if (room.status !== "live") {
    throw new AppError(409, "This room is not live", { code: "ROOM_NOT_LIVE" });
  }
  if (senderId === recipientId) {
    throw new AppError(400, "You cannot send a gift to yourself", { code: "INVALID_GIFT_RECIPIENT" });
  }

  await roomModerationState.assertNotBlocked(roomId, senderId);

  if (!(await roomStageService.isSeated(roomId, recipientId))) {
    throw new AppError(409, "That person is no longer on stage", { code: "GIFT_RECIPIENT_NOT_ON_STAGE" });
  }
}
