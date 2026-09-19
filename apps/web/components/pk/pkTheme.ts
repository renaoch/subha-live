// Shared PK color theme. The data model doesn't carry a per-host brand
// color, so sides get fixed, strongly contrasting colors (electric blue vs
// hot magenta) instead of a generic purple-on-purple gradient. If per-host
// theme colors are added later, thread them in here instead of at each
// call site.
export const PK_SIDE_A_COLOR = "#3B82F6"; // electric blue
export const PK_SIDE_B_COLOR = "#F43F5E"; // hot magenta/red
export const PK_GOLD = "#F5B93F";

export function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
