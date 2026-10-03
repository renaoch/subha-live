// Request coalescing: concurrent callers asking for the same key share one
// in-flight promise, and a successful result is reused for a very short TTL.
// In-process only (per instance) — it exists to absorb bursts of identical
// polling reads, not to be a cache. Failures are never cached.

interface Entry<T> {
  promise: Promise<T>;
  expiresAt: number; // 0 while in flight
}

export function createCoalescer<T>(ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<string, Entry<T>>();

  function sweep() {
    if (entries.size < 500) return;
    const t = now();
    for (const [k, e] of entries) if (e.expiresAt !== 0 && e.expiresAt <= t) entries.delete(k);
  }

  return {
    async run(key: string, fn: () => Promise<T>): Promise<T> {
      const existing = entries.get(key);
      if (existing && (existing.expiresAt === 0 || existing.expiresAt > now())) {
        return existing.promise;
      }
      sweep();
      const entry: Entry<T> = { promise: undefined as unknown as Promise<T>, expiresAt: 0 };
      entry.promise = fn().then(
        (value) => {
          if (entries.get(key) === entry) entry.expiresAt = now() + ttlMs;
          return value;
        },
        (error) => {
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        },
      );
      entries.set(key, entry);
      return entry.promise;
    },
    invalidate(keyPrefix: string) {
      for (const k of entries.keys()) if (k.startsWith(keyPrefix)) entries.delete(k);
    },
    size: () => entries.size,
  };
}