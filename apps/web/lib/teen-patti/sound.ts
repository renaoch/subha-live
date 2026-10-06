// Tiny WebAudio synth for table sounds. No audio files, no network. Safe to
// call anywhere: it no-ops when AudioContext is unavailable or still locked.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  deal(count = 15) {
    for (let i = 0; i < count; i++) tone(1500 - (i % 5) * 60, i * 0.07, 0.07, "triangle", 0.05, 600);
  },
  flip() {
    tone(520, 0, 0.12, "triangle", 0.07, 260);
  },
  reveal(count = 4) {
    for (let i = 0; i < count; i++) tone(560 + i * 40, i * 0.26, 0.12, "triangle", 0.06, 280);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.35, "sine", 0.08));
  },
  lose() {
    [392, 330].forEach((f, i) => tone(f, i * 0.16, 0.3, "sine", 0.06));
  },
  click() {
    tone(900, 0, 0.05, "square", 0.025);
  },
};