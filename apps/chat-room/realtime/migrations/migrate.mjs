import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

// Self-contained production migration runner (plain ESM, no TypeScript, no
// tsx/devDependencies) so it can be run on Heroku as a one-off command:
//   heroku run npm run migrate
// It only needs DATABASE_URL (+ NODE_ENV to decide on SSL).

const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASE_URL = process.env.DATABASE_URL
const NODE_ENV = process.env.NODE_ENV || 'development'

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required to run migrations')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
})

async function main() {
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
