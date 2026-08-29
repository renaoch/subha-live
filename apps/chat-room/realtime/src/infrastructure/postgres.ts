import pg from 'pg'
import type { Config } from './config.js'

const { Pool } = pg

export function createPool(config: Config): pg.Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  })
}
