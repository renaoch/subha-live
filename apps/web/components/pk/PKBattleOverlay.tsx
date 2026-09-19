"use client";

import { useEffect, useRef, useState } from "react";
import { PKStartAnimation } from "./PKStartAnimation";
import { PKResultAnimation } from "./PKResultAnimation";
import type { PkState } from "@/lib/api/pk";

interface PKBattleOverlayProps {
  state: PkState | null;
  /** This room's host — the only side we have a real name/avatar for
   * locally, same convention as PkBattleBar/PkDualVideo. */
  roomHostId?: string | null;
  hostName?: string | null;
  hostAvatar?: string | null;
}

// Safety net: if a phase somehow never receives its "done" signal (a missed
// event, a disconnect mid-animation), force it closed after this long so the
// overlay can never permanently block the live room.
const STUCK_GUARD_MS = 12_000;

/**
 * Mounts the big, one-shot PK animations (start intro + countdown, and the
 * end-of-battle result) on top of the room, driven entirely by the real PK
 * lifecycle (`PkState.status` / `winner`) rather than any local simulation.
 * Renders nothing during the active battle itself — the always-on score bar
 * (`PkBattleBar`) and dual video already cover that clean, low-motion state.
 */
export function PKBattleOverlay({ state, roomHostId, hostName, hostAvatar }: PKBattleOverlayProps) {
  const [showIntro, setShowIntro] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const introShownForBattle = useRef<string | null>(null);
  const resultShownForBattle = useRef<string | null>(null);
  const prevStatus = useRef<string | null>(null);

  const battleId = state?.battleId ?? null;

  useEffect(() => {
    if (!state) {
      prevStatus.current = null;
      return;
    }

    const justStarted =
      state.status === "ACTIVE" &&
      prevStatus.current !== "ACTIVE" &&
      prevStatus.current !== "FINALIZING" &&
      prevStatus.current !== "FINISHED";

    // Only play the intro for a battle we watched transition INTO active —
    // never for one that was already active when this component mounted
    // (e.g. a viewer joining mid-fight), so refreshing never re-triggers it.
    if (justStarted && prevStatus.current != null && introShownForBattle.current !== battleId) {
      introShownForBattle.current = battleId;
      setShowIntro(true);
    }

    if (
      (state.status === "FINISHED") &&
      state.winner &&
      resultShownForBattle.current !== battleId
    ) {
      resultShownForBattle.current = battleId;
      setShowResult(true);
      setShowIntro(false);
    }

    prevStatus.current = state.status;
  }, [state, battleId]);

  // If the PK vanishes (cancelled, room left) while an animation is up,
  // don't leave it stranded on screen.
  useEffect(() => {
    if (!state) {
      setShowIntro(false);
      setShowResult(false);
    }
  }, [state]);

  if (!state) return null;

  const hostIsA = roomHostId != null && roomHostId === state.hostA;
  const hostIsB = roomHostId != null && roomHostId === state.hostB;
  const nameA = hostIsA ? hostName || "Host A" : "Host A";
  const avatarA = hostIsA ? hostAvatar : null;
  const nameB = hostIsB ? hostName || "Host B" : "Opponent";
  const avatarB = hostIsB ? hostAvatar : null;

  return (
    <>
      {showIntro && (
        <TimedOverlay onExpire={() => setShowIntro(false)} guardMs={STUCK_GUARD_MS}>
          <PKStartAnimation
            hostAName={nameA}
            hostAAvatar={avatarA}
            hostBName={nameB}
            hostBAvatar={avatarB}
            onComplete={() => setShowIntro(false)}
            skip={state.status !== "ACTIVE" && state.status !== "STARTING"}
          />
        </TimedOverlay>
      )}

      {showResult && state.winner && (
        <TimedOverlay onExpire={() => setShowResult(false)} guardMs={STUCK_GUARD_MS}>
          <PKResultAnimation
            winner={state.winner}
            hostAName={nameA}
            hostAAvatar={avatarA}
            hostBName={nameB}
            hostBAvatar={avatarB}
            scoreA={state.scoreA}
            scoreB={state.scoreB}
            durationMs={state.startedAt != null ? Date.now() - state.startedAt : null}
            onDone={() => setShowResult(false)}
          />
        </TimedOverlay>
      )}
    </>
  );
}

/** Wraps an animation with a hard timeout that force-dismisses it, so a
 * missed completion callback can never leave the overlay stuck open. */
function TimedOverlay({
  children,
  onExpire,
  guardMs,
}: {
  children: React.ReactNode;
  onExpire: () => void;
  guardMs: number;
}) {
  useEffect(() => {
    const t = window.setTimeout(onExpire, guardMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}
