export type OppLite = {
  id: string
  kind: "JOB" | "SCHOLARSHIP"
  title: string
  organization: string
  location: string | null
  deadline: string | null
  postedTo: string[]
}

export type PlatformLite = { id: string; name: string; media: "image" | "video"; captionLimit: number; usable: boolean; missing: string[]; manualOnly?: boolean }
export type TrackLite = { id: number; name: string; file: string; duration: number }
export type Pic = { id: number; name: string; url: string }
export type MusicChoice = { id: number; start: number; volume: number } | null

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  return data as T
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
