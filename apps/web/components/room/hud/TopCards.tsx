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
  // Two fixed slots. Star Target always owns the left one and Regional always
  // the right, so a lone card never drifts to the wrong side (Star Target only
  // exists while an admin has an active target running).
  return (
    <div className="flex items-start gap-2">
      <div className="w-[calc(50%-4px)] max-w-[188px]">
        <StarTargetCard task={props.task} claiming={props.claiming} onClaim={props.onClaimTask} />
      </div>
      <div className="ml-auto w-[calc(50%-4px)] max-w-[188px]">
        <RegionalChallengeCard data={props.challenge} skewMs={props.skewMs} myHostId={props.hostId} />
      </div>
    </div>
  );
}