import crypto from "node:crypto"
import { all, get, kvGet, kvSet, run } from "./db"

// Accounts connected through the Connect buttons. `data` holds the same names as the .env keys
// (e.g. FB_PAGE_TOKEN), so `setting()` can look in connections first and fall back to .env.
// App credentials (client id/secret) always stay in .env.

export type ConnectionId = "x" | "meta" | "linkedin" | "tiktok" | "telegram"
export type Connection = { id: ConnectionId; account: string; data: Record<string, string>; connected_at: number; expires_at: number | null }

type Row = { id: ConnectionId; account: string; data: string; connected_at: number; expires_at: number | null }
const toConn = (r: Row): Connection => ({ ...r, data: JSON.parse(r.data) })

export const listConnections = () => all<Row>("SELECT * FROM connections").map(toConn)
export function getConnection(id: ConnectionId): Connection | undefined {
  const r = get<Row>("SELECT * FROM connections WHERE id = ?", id)
  return r && toConn(r)
}

export function saveConnection(id: ConnectionId, account: string, data: Record<string, string>, expiresAt: number | null = null) {
  run(`INSERT INTO connections(id, account, data, connected_at, expires_at) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET account = excluded.account, data = excluded.data, connected_at = excluded.connected_at, expires_at = excluded.expires_at`,
  id, account, JSON.stringify(data), Date.now(), expiresAt)
}

export function removeConnection(id: ConnectionId) {
  run("DELETE FROM connections WHERE id = ?", id)
}

/** A credential by its .env name: connected account first, then .env. */
export function setting(name: string): string | undefined {
  for (const c of listConnections()) if (c.data[name]?.trim()) return c.data[name].trim()
  return process.env[name]?.trim() || undefined
}

/** Where the platforms send the browser back after login. Must be registered in each developer app. */
export const appUrl = () => (process.env.APP_URL?.trim() || "http://127.0.0.1:3011").replace(/\/$/, "")
export const callbackUrl = (id: ConnectionId) => `${appUrl()}/api/connect/${id}/callback`

// OAuth state kept server-side (not in a cookie) so localhost vs 127.0.0.1 doesn't matter.
export function newState(id: ConnectionId, extra: Record<string, string> = {}): string {
  const state = crypto.randomBytes(16).toString("hex")
  kvSet(`oauth_state:${id}`, JSON.stringify({ state, at: Date.now(), ...extra }))
  return state
}

export function takeState(id: ConnectionId, state: string | null): Record<string, string> {
  const raw = kvGet(`oauth_state:${id}`)
  run("DELETE FROM kv WHERE key = ?", `oauth_state:${id}`)
  const saved = raw ? JSON.parse(raw) : null
  if (!saved || !state || saved.state !== state) throw new Error("Login session expired or didn't match — click Connect again")
  if (Date.now() - saved.at > 15 * 60_000) throw new Error("Login took too long — click Connect again")
  return saved
}
