import { setting } from "../connections"

export type PlatformId = "x" | "facebook" | "linkedin" | "telegram" | "whatsapp" | "instagram" | "tiktok"

export type PlatformInfo = {
  id: PlatformId
  name: string
  /** image = the feed card (4:5 PNG); video = the vertical slideshow with background music (9:16 MP4). */
  media: "image" | "video"
  captionLimit: number
  /** All must be set in .env for the platform to be usable (unless DRY_RUN). */
  envKeys: string[]
  /** Links aren't clickable in captions on this platform. */
  linksDead?: boolean
  /** No posting API: only "share myself" mode. */
  manualOnly?: boolean
}

export type PublishInput = { caption: string; title: string; file: string }
export type PublishResult = { externalId: string; url?: string }
export type Publisher = (input: PublishInput) => Promise<PublishResult>

export class PlatformError extends Error {}

/** fetch + JSON with a readable error that includes the platform's own message. */
export async function fetchJson<T = unknown>(url: string, init: RequestInit, label: string): Promise<{ data: T; res: Response }> {
  const res = await fetch(url, init)
  const text = await res.text()
  let data: unknown = text
  try { data = text ? JSON.parse(text) : {} } catch { /* keep text */ }
  if (!res.ok) throw new PlatformError(`${label}: HTTP ${res.status} ${typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`)
  return { data: data as T, res }
}

/** A credential from the connected account, else .env. */
export function env(name: string): string {
  const v = setting(name)
  if (!v) throw new PlatformError(`${name} is missing — connect the account in Settings`)
  return v
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
