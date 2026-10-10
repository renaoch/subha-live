"use client";

import { RegionalChallengeCard } from "@/components/room/hud/RegionalChallengeCard";
import { StarTargetCard } from "@/components/room/hud/StarTargetCard";
import type { RoomChallenge } from "@/lib/api/challenges";
import type { RoomTask } from "@/lib/api/room-tasks";

/** The two cards under the pill row: Star Target (left) · Regional Star Challenge (right). */
export function TopCards(props: {
  task: RoomTask | null;
  claiming: boolean;
  onClaimTask: () => Promise<unknown>;
  challenge: RoomChallenge | null;
  skewMs: number;
  hostId: string | null;
}) {
  return (
    <div className="flex items-start justify-between">
      <StarTargetCard
        task={props.task}
        claiming={props.claiming}
        onClaim={props.onClaimTask}
      />
      <RegionalChallengeCard data={props.challenge} skewMs={props.skewMs} myHostId={props.hostId} />
    </div>
  );
}