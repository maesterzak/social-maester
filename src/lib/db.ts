import { DatabaseSync } from "node:sqlite"
import fs from "node:fs"
import path from "node:path"

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data")
export const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "social.db")

// `opportunities` mirrors PathMaester's public.opportunities (same column names, arrays as JSON text)
// so the source can later be swapped for PathMaester's Postgres without touching the rest of the app.
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('JOB','SCHOLARSHIP')),
  visibility TEXT NOT NULL DEFAULT 'PUBLIC',
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  location TEXT,
  work_mode TEXT NOT NULL DEFAULT 'UNKNOWN',
  employment_type TEXT,
  category TEXT,
  salary_text TEXT,
  award_amount TEXT,
  deadline TEXT,
  posted_at TEXT,
  summary TEXT,
  description TEXT,
  eligibility TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  apply_url TEXT,
  del_flg TEXT NOT NULL DEFAULT 'N',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS music (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  file TEXT NOT NULL,
  duration REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY,
  file TEXT NOT NULL,
  original_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- One click on "Post" = one campaign of 1-3 opportunities.
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued',
  music_id INTEGER REFERENCES music(id) ON DELETE SET NULL,
  music_start REAL NOT NULL DEFAULT 0,
  music_volume REAL NOT NULL DEFAULT 0.8,
  slide_seconds REAL NOT NULL DEFAULT 4,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS campaign_items (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  extra_upload_ids TEXT NOT NULL DEFAULT '[]',
  image_file TEXT,
  video_file TEXT,
  error TEXT
);

-- One row per (item, platform).
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES campaign_items(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  caption TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  external_id TEXT,
  url TEXT,
  error TEXT,
  dry_run INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_opp ON posts(opportunity_id, platform, status);

-- Accounts connected with the Connect buttons (tokens; app client secrets stay in .env).
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  data TEXT NOT NULL,
  connected_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

const g = globalThis as unknown as { __socialDb?: DatabaseSync; __socialSchema?: string }

export function db(): DatabaseSync {
  if (!g.__socialDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    g.__socialDb = new DatabaseSync(DB_PATH)
  }
  // Re-applied when the schema or the added columns change, so dev hot reload picks up new tables and columns.
  const key = SCHEMA + JSON.stringify(COLUMNS)
  if (g.__socialSchema !== key) {
    g.__socialDb.exec(SCHEMA)
    migrate(g.__socialDb)
    g.__socialSchema = key
  }
  return g.__socialDb
}

// Columns added after the first release (CREATE TABLE IF NOT EXISTS doesn't add them to old databases).
const COLUMNS: [table: string, column: string, ddl: string][] = [
  // auto = posted through the APIs; manual = media made, the user shares it from prepared tabs
  ["campaigns", "mode", "TEXT NOT NULL DEFAULT 'auto'"],
  // single = one post per opportunity; digest = one post listing all of the campaign's opportunities (Top 5)
  ["campaigns", "kind", "TEXT NOT NULL DEFAULT 'single'"],
  ["campaigns", "title", "TEXT"],
  // auto = the app sends it through the platform's API; manual = the user shares it (smart campaigns decide per platform)
  ["posts", "delivery", "TEXT NOT NULL DEFAULT 'auto'"],
]

function migrate(d: DatabaseSync) {
  for (const [table, column, ddl] of COLUMNS) {
    const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!cols.some((c) => c.name === column)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
  }
}

type Param = string | number | null
// node:sqlite rows have a null prototype, which React refuses to pass to client components: copy them.
export const all = <T>(sql: string, ...p: Param[]) => db().prepare(sql).all(...p).map((r) => ({ ...r })) as T[]
export const get = <T>(sql: string, ...p: Param[]) => {
  const r = db().prepare(sql).get(...p)
  return (r ? { ...r } : undefined) as T | undefined
}
export const run = (sql: string, ...p: Param[]) => db().prepare(sql).run(...p)

export function kvGet(key: string): string | undefined {
  return get<{ value: string }>("SELECT value FROM kv WHERE key = ?", key)?.value
}
/** Read and delete (one-time values such as login state). */
export function kvTake(key: string): string | undefined {
  const v = kvGet(key)
  run("DELETE FROM kv WHERE key = ?", key)
  return v
}
export function kvSet(key: string, value: string) {
  run("INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value)
}

/** Resolve a path inside DATA_DIR; throws if it escapes it. */
export function dataPath(...parts: string[]): string {
  const p = path.resolve(DATA_DIR, ...parts)
  if (p !== path.resolve(DATA_DIR) && !p.startsWith(path.resolve(DATA_DIR) + path.sep)) throw new Error("Bad path")
  return p
}
