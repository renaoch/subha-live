// File: apps/web/lib/sound.ts
//
// Tiny Web Audio synthesizer for in-app sound effects. Using the Web
// Audio API instead of shipping an audio file means there's nothing to
// upload/host and it plays instantly with no network round trip.

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;

  if (!sharedContext) {
    sharedContext = new Ctor();
  }
  if (sharedContext.state === "suspended") {
    void sharedContext.resume();
  }
  return sharedContext;
}

function tone(
  ctx: AudioContext,
  { freq, start, duration, gain = 0.18, type = "sine" }: {
    freq: number;
    start: number;
    duration: number;
    gain?: number;
    type?: OscillatorType;
  },
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

  gainNode.gain.setValueAtTime(0, ctx.currentTime + start);
  gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

/** Bright ascending three-note chime played when a gift is sent. */
export function playGiftSentSound() {
  const ctx = getContext();
  if (!ctx) return;

  try {
    tone(ctx, { freq: 587.33, start: 0, duration: 0.16, gain: 0.16 }); // D5
    tone(ctx, { freq: 739.99, start: 0.09, duration: 0.16, gain: 0.16 }); // F#5
    tone(ctx, { freq: 987.77, start: 0.18, duration: 0.32, gain: 0.2 }); // B5
    tone(ctx, { freq: 1318.51, start: 0.22, duration: 0.34, gain: 0.12, type: "triangle" }); // E6 sparkle
  } catch {
    // Audio is a nice-to-have; never let it break the send flow.
  }
}

// ─── Subha Lucky sounds ──────────────────────────────────────────────────

/** Short mechanical tick for the reel spin. */
export function playLuckySpinSound() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    tone(ctx, { freq: 180, start: 0, duration: 0.08, gain: 0.08, type: "square" });
    tone(ctx, { freq: 140, start: 0.08, duration: 0.08, gain: 0.06, type: "square" });
  } catch {
    /* ignore */
  }
}

/** Soft click for a reel stopping. */
export function playLuckyStopSound() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    tone(ctx, { freq: 520, start: 0, duration: 0.06, gain: 0.07, type: "triangle" });
  } catch {
    /* ignore */
  }
}

/** Ascending chime for a normal win. */
export function playLuckyWinSound() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    tone(ctx, { freq: 659.25, start: 0, duration: 0.14, gain: 0.14 }); // E5
    tone(ctx, { freq: 830.61, start: 0.08, duration: 0.16, gain: 0.14 }); // G#5
    tone(ctx, { freq: 1046.5, start: 0.16, duration: 0.24, gain: 0.16 }); // C6
  } catch {
    /* ignore */
  }
}

/** Richer, longer fanfare for a large win. */
export function playLuckyBigWinSound() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    tone(ctx, { freq: 523.25, start: 0, duration: 0.16, gain: 0.14 });
    tone(ctx, { freq: 659.25, start: 0.12, duration: 0.16, gain: 0.14 });
    tone(ctx, { freq: 783.99, start: 0.24, duration: 0.16, gain: 0.15 });
    tone(ctx, { freq: 1046.5, start: 0.36, duration: 0.4, gain: 0.18 });
  } catch {
    /* ignore */
  }
}

/** Special sparkle fanfare for the Lucky jackpot. */
export function playLuckyJackpotSound() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    tone(ctx, { freq: 659.25, start: 0, duration: 0.2, gain: 0.16 });
    tone(ctx, { freq: 987.77, start: 0.12, duration: 0.2, gain: 0.16 });
    tone(ctx, { freq: 1318.51, start: 0.24, duration: 0.32, gain: 0.18, type: "triangle" });
    tone(ctx, { freq: 1975.53, start: 0.32, duration: 0.4, gain: 0.12, type: "triangle" });
  } catch {
    /* ignore */
  }
}
