import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3002),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  WEBSOCKET_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10000),

  // Comma-separated allowed origins for the HTTP endpoints (chat history).
  // Empty = reflect any origin (the service is JWT-authenticated, no cookies).
  CORS_ORIGINS: z.string().optional().default(''),

  REDIS_URL: z.string().min(1),
  DATABASE_URL: z.string().min(1),

  SUPABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().optional().default(''),
  SUPABASE_JWT_ISSUER: z.string().optional().default(''),
  SUPABASE_JWT_AUDIENCE: z.string().default('authenticated'),

  CORE_API_BASE_URL: z.string().url(),
  CORE_API_AUTH_ENDPOINT: z.string().default('/api/v1/rooms/:roomId/authorize'),
  CORE_API_PROFILE_ENDPOINT: z.string().default('/api/v1/users/:userId/profile'),
  CORE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),

  CHAT_MAX_MESSAGE_LENGTH: z.coerce.number().int().positive().default(500),
  CHAT_RATE_LIMIT_MESSAGES: z.coerce.number().int().positive().default(10),
  CHAT_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(1),
  CHAT_CONNECTION_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  CHAT_CONNECTION_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  CHAT_HISTORY_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  CHAT_HISTORY_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  CHAT_HISTORY_LIMIT: z.coerce.number().int().positive().default(100),
  CHAT_HISTORY_MAX_LIMIT: z.coerce.number().int().positive().default(500),
  CHAT_REDIS_RETENTION_MINUTES: z.coerce.number().int().positive().default(60),
  CHAT_BUCKET_SIZE_MINUTES: z.coerce.number().int().positive().default(5),
  CHAT_PERSISTENCE_BATCH_SIZE: z.coerce.number().int().positive().default(200),
  CHAT_PERSISTENCE_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  CHAT_PERSISTENCE_STREAM_MAXLEN: z.coerce.number().int().positive().default(200000),
  CHAT_AUTH_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  CHAT_HISTORY_LOCK_TTL_SECONDS: z.coerce.number().int().positive().default(5),
})

export type Config = z.infer<typeof envSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse({
    ...env,
    DATABASE_URL: env.DATABASE_URL ?? env.POSTGRES_URL_NON_POOLING ?? env.POSTGRES_URL,
    SUPABASE_URL: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
  })
}

export const config = loadConfig()
