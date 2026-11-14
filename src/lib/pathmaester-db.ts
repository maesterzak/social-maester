import pg from "pg"

// PathMaester's live Postgres (Neon), shared with real users. This app only READS it: every query runs in a
// READ ONLY transaction, so even a mistaken UPDATE/DELETE here would be rejected by the database.
// PathMaester owns the schema and its migrations.

const g = globalThis as unknown as { __pathmaesterPool?: pg.Pool }

export const pathmaesterConfigured = () => !!process.env.PATHMAESTER_DATABASE_URL?.trim()

function pool(): pg.Pool {
  if (!g.__pathmaesterPool) {
    g.__pathmaesterPool = new pg.Pool({ connectionString: process.env.PATHMAESTER_DATABASE_URL, max: 3, idleTimeoutMillis: 30_000 })
    g.__pathmaesterPool.on("error", (e) => console.error("[pathmaester-db]", e.message))
  }
  return g.__pathmaesterPool
}

export async function readOnly<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = await pool().connect()
  try {
    await c.query("BEGIN READ ONLY")
    const r = await c.query<T>(sql, params)
    await c.query("COMMIT")
    return r.rows
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {})
    throw e
  } finally {
    c.release()
  }
}
