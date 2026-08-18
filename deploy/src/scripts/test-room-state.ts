import "dotenv/config";

import { connectRedis, redis } from "../lib/redis";
import { roomState } from "../modules/rooms/room-state.service";

async function main() {
  const roomId = "test-room";
  const user1 = "user-1";
  const user2 = "user-2";

  const maxSpeakerSlots = 3;

  await connectRedis();

  console.log("Redis connected");

  // Start with a clean room so previous test data cannot affect the result.
  await roomState.clear(roomId);

  // Room state
  await roomState.setState(roomId, {
    status: "live",
    hostId: user1,
  });

  console.log(
    "Room state:",
    await roomState.getState(roomId),
  );

  // Viewers
  await roomState.addViewer(roomId, user1);
  await roomState.addViewer(roomId, user2);

  console.log(
    "Viewer count:",
    await roomState.getViewerCount(roomId),
  );

  console.log(
    "User 1 is viewer:",
    await roomState.isViewer(roomId, user1),
  );

  // Speakers
  console.log(
    "Speaker 1 added:",
    await roomState.addSpeaker(
      roomId,
      "speaker-1",
      maxSpeakerSlots,
    ),
  );

  console.log(
    "Speaker 2 added:",
    await roomState.addSpeaker(
      roomId,
      "speaker-2",
      maxSpeakerSlots,
    ),
  );

  console.log(
    "Speaker 3 added:",
    await roomState.addSpeaker(
      roomId,
      "speaker-3",
      maxSpeakerSlots,
    ),
  );

  // This should fail because all 3 slots are occupied.
  console.log(
    "Speaker 4 added:",
    await roomState.addSpeaker(
      roomId,
      "speaker-4",
      maxSpeakerSlots,
    ),
  );

  console.log(
    "Speakers:",
    await roomState.getSpeakers(roomId),
  );

  console.log(
    "Speaker count:",
    await roomState.getSpeakerCount(roomId),
  );

  // Audio requests
  await roomState.addAudioRequest(roomId, user2);

  console.log(
    "Audio requests:",
    await roomState.getAudioRequests(roomId),
  );

  console.log(
    "User 2 requested audio:",
    await roomState.hasAudioRequest(
      roomId,
      user2,
    ),
  );

  // Cleanup
  await roomState.clear(roomId);

  console.log("Room state cleared");

  console.log(
    "State after cleanup:",
    await roomState.getState(roomId),
  );

  await redis.quit();
}

main().catch(async (error) => {
  console.error(
    "Room state test failed:",
    error,
  );

  if (redis.isOpen) {
    await redis.quit();
  }

  process.exit(1);
});