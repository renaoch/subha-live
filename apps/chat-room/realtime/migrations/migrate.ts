import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { loadConfig } from '../src/infrastructure/config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const config = loadConfig()
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  })

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const files = readdirSync(__dirname)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file])
      if (rows.length) {
        console.log(`skip (already applied): ${file}`)
        continue
      }
      const sql = readFileSync(join(__dirname, file), 'utf8')
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`applied: ${file}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
