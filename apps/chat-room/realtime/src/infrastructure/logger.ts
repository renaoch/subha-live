export type Logger = {
  info: (obj: unknown, msg?: string) => void
  warn: (obj: unknown, msg?: string) => void
  error: (obj: unknown, msg?: string) => void
}

const REDACTED_KEYS = new Set([
  'token',
  'accessToken',
  'access_token',
  'authorization',
  'jwt',
  'password',
  'secret',
  'serviceRoleKey',
  'service_role_key',
  'message', // chat message bodies are not logged in production
])

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key) ? '[redacted]' : redact(val)
    }
    return out
  }
  return value
}

function write(level: 'info' | 'warn' | 'error', obj: unknown, msg?: string) {
  const line = {
    level,
    time: new Date().toISOString(),
    msg,
    ...((typeof obj === 'object' && obj) ? (redact(obj) as Record<string, unknown>) : { data: obj }),
  }
  const serialized = JSON.stringify(line)
  if (level === 'error') console.error(serialized)
  else if (level === 'warn') console.warn(serialized)
  else console.log(serialized)
}

export const logger: Logger = {
  info: (obj, msg) => write('info', obj, msg),
  warn: (obj, msg) => write('warn', obj, msg),
  error: (obj, msg) => write('error', obj, msg),
}
