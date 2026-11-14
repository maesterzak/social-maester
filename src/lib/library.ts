import fs from "node:fs/promises"
import path from "node:path"
import { all, dataPath, get, run } from "./db"
import { probeDuration } from "./media/ffmpeg"

// Background music tracks and extra pictures the user uploads. Files live under data/, rows in SQLite.

export type Track = { id: number; name: string; file: string; duration: number }
export type Upload = { id: number; file: string; original_name: string }

const AUDIO = new Set([".mp3", ".m4a", ".aac", ".wav", ".ogg"])
const IMAGE = new Set([".png", ".jpg", ".jpeg", ".webp"])
const MAX_AUDIO = 30 * 1024 * 1024
const MAX_IMAGE = 15 * 1024 * 1024

const safeName = (name: string) => path.basename(name).replace(/[^\w.-]+/g, "-").slice(-80)

async function save(dir: string, f: File, allowed: Set<string>, max: number, what: string): Promise<string> {
  const ext = path.extname(f.name).toLowerCase()
  if (!allowed.has(ext)) throw new Error(`${what} must be one of: ${[...allowed].join(", ")}`)
  if (f.size > max) throw new Error(`${what} is too big (max ${Math.round(max / 1024 / 1024)} MB)`)
  const rel = path.posix.join(dir, `${Date.now()}-${safeName(f.name)}`)
  await fs.mkdir(dataPath(dir), { recursive: true })
  await fs.writeFile(dataPath(rel), Buffer.from(await f.arrayBuffer()))
  return rel
}

export const listTracks = () => all<Track>("SELECT id, name, file, duration FROM music ORDER BY id DESC")
export const getTrack = (id: number) => get<Track>("SELECT id, name, file, duration FROM music WHERE id = ?", id)

export async function addTrack(f: File): Promise<Track> {
  const rel = await save("music", f, AUDIO, MAX_AUDIO, "Music file")
  let duration: number
  try {
    duration = await probeDuration(dataPath(rel))
  } catch (e) {
    await fs.rm(dataPath(rel), { force: true })
    throw e
  }
  const name = path.basename(f.name, path.extname(f.name)).slice(0, 80)
  const r = run("INSERT INTO music(name, file, duration, created_at) VALUES(?,?,?,?)", name, rel, duration, Date.now())
  return { id: Number(r.lastInsertRowid), name, file: rel, duration }
}

export async function deleteTrack(id: number) {
  const t = getTrack(id)
  if (!t) return
  run("DELETE FROM music WHERE id = ?", id)
  await fs.rm(dataPath(t.file), { force: true })
}

export async function addUpload(f: File): Promise<Upload> {
  const rel = await save("uploads", f, IMAGE, MAX_IMAGE, "Picture")
  const r = run("INSERT INTO uploads(file, original_name, created_at) VALUES(?,?,?)", rel, f.name.slice(0, 120), Date.now())
  return { id: Number(r.lastInsertRowid), file: rel, original_name: f.name }
}

export const getUpload = (id: number) => get<Upload>("SELECT id, file, original_name FROM uploads WHERE id = ?", id)
