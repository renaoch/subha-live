/**
 * Staged live-room capacity test.
 * Usage: API_URL=... ROOM_ID=... AUTH_TOKEN=... USERS=10000 pnpm --filter api load:live-room
 * Run against a deployed/staging API only. Each virtual user joins, checks the
 * room, waits, then leaves. AUTH_TOKEN may be a shared staging token.
 */

const apiUrl = (process.env.API_URL || "http://localhost:3000").replace(/\/$/, "");
const roomId = process.env.ROOM_ID;
const token = process.env.AUTH_TOKEN;
const users = Math.min(Number(process.env.USERS || 100), 10_000);
const durationMs = Number(process.env.DURATION_MS || 30_000);
const rampMs = Number(process.env.RAMP_MS || 60_000);

if (!roomId || !token) throw new Error("ROOM_ID and AUTH_TOKEN are required");

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const metrics = { ok: 0, failed: 0, latencyMs: [] as number[] };

async function request(path: string, method = "GET") {
  const start = performance.now();
  const response = await fetch(`${apiUrl}${path}`, { method, headers });
  metrics.latencyMs.push(performance.now() - start);
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  metrics.ok++;
}

async function virtualUser(index: number) {
  await new Promise((resolve) => setTimeout(resolve, (index / users) * rampMs));
  try {
    await request(`/api/v1/rooms/${roomId}/join`, "POST");
    await request(`/api/v1/rooms/${roomId}`);
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    await request(`/api/v1/rooms/${roomId}/leave`, "POST");
  } catch (error) {
    metrics.failed++;
    if (metrics.failed <= 5) console.error("[load]", error);
  }
}

async function main() {
  console.log(`[load] ${users} users, ${durationMs}ms hold, ${rampMs}ms ramp against ${apiUrl}`);
  await Promise.all(Array.from({ length: users }, (_, index) => virtualUser(index)));
  const sorted = metrics.latencyMs.sort((a, b) => a - b);
  const percentile = (p: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0);
  console.log(JSON.stringify({ ...metrics, p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) }, null, 2));
  if (metrics.failed > 0) process.exitCode = 1;
}

void main();
