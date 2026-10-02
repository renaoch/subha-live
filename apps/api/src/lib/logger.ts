// File: apps/api/src/lib/logger.ts
//
// Minimal structured JSON logger for the Core API. Emits one JSON line per
// entry so it can be indexed/parsed by the deployment platform without pulling
// in a logging dependency. It never throws — a logging failure must never break
// a normal request.
//
// `redact()` strips obvious secrets (authorization headers, tokens, keys,
// passwords, signed URLs, cookies) from any logged metadata so they can't end
// up in log sinks.

type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY = /authorization|token|secret|password|api[_-]?key|credential|signed[_-]?url|cookie|set-cookie/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  try {
    const entry = {
      level,
      time: new Date().toISOString(),
      message,
      ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
    };
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } catch {
    // Logging must never throw and break a request.
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
