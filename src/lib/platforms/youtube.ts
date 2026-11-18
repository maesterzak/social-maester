import fs from "node:fs/promises"
import { kvGet, kvSet } from "../db"
import { env, fetchJson, PlatformError, type Publisher } from "./types"

// YouTube Data API v3: the vertical slideshow goes up as a Short (a vertical video under 3 minutes is a Short
// automatically; "#Shorts" in the title helps it get picked up). Google access tokens last 1 hour, so the
// refresh token is exchanged on demand and cached in kv `youtube_token`.
// Until Google verifies the Cloud project, uploads through the API are locked to private.

type Cached = { access: string; expiresAt: number }

export async function accessToken(): Promise<string> {
  const saved = kvGet("youtube_token")
  const t: Cached | null = saved ? JSON.parse(saved) : null
  if (t && t.expiresAt > Date.now() + 60_000) return t.access
  const { data } = await fetchJson<{ access_token?: string; expires_in?: number; error_description?: string }>(
    "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("YOUTUBE_CLIENT_ID"), client_secret: env("YOUTUBE_CLIENT_SECRET"),
        grant_type: "refresh_token", refresh_token: env("YOUTUBE_REFRESH_TOKEN"),
      }),
    }, "YouTube token refresh")
  if (!data.access_token) throw new PlatformError(`YouTube token refresh failed: ${data.error_description ?? "no token"}`)
  kvSet("youtube_token", JSON.stringify({ access: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }))
  return data.access_token
}

/** Title: max 100 characters, no angle brackets, ending in #Shorts. */
export function shortsTitle(title: string): string {
  const clean = title.replace(/[<>]/g, "").trim()
  const tag = " #Shorts"
  return (clean.length > 100 - tag.length ? clean.slice(0, 100 - tag.length - 1).trimEnd() + "…" : clean) + tag
}

export const publishYouTube: Publisher = async ({ caption, title, file }) => {
  const token = await accessToken()
  // Checked before every upload, so a wrong login can never post to another channel.
  const { myChannel, checkChannel } = await import("../connect/youtube")
  checkChannel(await myChannel(token))
  const bytes = await fs.readFile(file)
  const privacy = process.env.YOUTUBE_PRIVACY?.trim() || "public"
  const meta = {
    snippet: { title: shortsTitle(title), description: caption.replace(/[<>]/g, "").slice(0, 4900), categoryId: "27" /* Education */ },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  }
  // Resumable upload: first call registers the video and returns where to send the bytes.
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(bytes.length),
    },
    body: JSON.stringify(meta),
  })
  const uploadUrl = init.headers.get("location")
  if (!init.ok || !uploadUrl) throw new PlatformError(`YouTube init: HTTP ${init.status} ${(await init.text()).slice(0, 300)}`)

  const { data } = await fetchJson<{ id?: string }>(uploadUrl, {
    method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.length) }, body: bytes,
  }, "YouTube upload")
  if (!data.id) throw new PlatformError("YouTube upload finished without a video id")
  return { externalId: data.id, url: `https://www.youtube.com/shorts/${data.id}` }
}
