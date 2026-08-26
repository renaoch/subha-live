import { redis } from "../lib/redis";
import { mediaKeys } from "../modules/media/media.state";

interface ReapResult {
  removed: number;
}

export async function reapExpiredMediaLeases(
  roomId: string,
): Promise<ReapResult> {
  const leasesKey =
    mediaKeys.leases(roomId);

  const leases =
(await redis.hGetAll(
    leasesKey,
  )) as Record<string, string>;

  const currentTime =
    Date.now();

  let removed = 0;

  for (const [
    participantId,
    raw,
  ] of Object.entries(
    leases,
  )) {
    try {
      const lease =
        JSON.parse(raw) as {
          expiresAt?: number;
        };

      if (
        typeof lease.expiresAt !==
          "number" ||
        lease.expiresAt >
          currentTime
      ) {
        continue;
      }

      await redis.hDel(
        leasesKey,
        participantId,
      );

      removed += 1;
    } catch {
      await redis.hDel(
        leasesKey,
        participantId,
      );

      removed += 1;
    }
  }

  return {
    removed,
  };
}
