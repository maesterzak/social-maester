import fs from "node:fs/promises"
import { kvGet, kvSet } from "../db"
import { env, fetchJson, PlatformError, sleep, type Publisher } from "./types"

// TikTok Content Posting API, Direct Post with FILE_UPLOAD. Access tokens last 24 h, so the refresh
// token from .env is exchanged on demand and the newest pair is kept in kv `tiktok_tokens`.
// Until TikTok audits the app, posts can only be SELF_ONLY (private).

const API = "https://open.tiktokapis.com/v2"
type Tokens = { access: string; refresh: string; expiresAt: number }

export async function accessToken(): Promise<string> {
  const saved = kvGet("tiktok_tokens")
  let t: Tokens | null = saved ? JSON.parse(saved) : null
  if (t && t.expiresAt > Date.now() + 60_000) return t.access
  const { data } = await fetchJson<{ access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string }>(
    `${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"),
        grant_type: "refresh_token", refresh_token: t?.refresh ?? env("TIKTOK_REFRESH_TOKEN"),
      }),
    }, "TikTok token refresh")
  if (!data.access_token) throw new PlatformError(`TikTok token refresh failed: ${data.error_description ?? "no token"}`)
  t = { access: data.access_token, refresh: data.refresh_token ?? t?.refresh ?? env("TIKTOK_REFRESH_TOKEN"), expiresAt: Date.now() + (data.expires_in ?? 86400) * 1000 }
  kvSet("tiktok_tokens", JSON.stringify(t))
  return t.access
}

type Envelope<T> = { data: T; error: { code: string; message: string } }
async function call<T>(path: string, token: string, body: unknown, label: string): Promise<T> {
  const { data } = await fetchJson<Envelope<T>>(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  }, label)
  if (data.error && data.error.code !== "ok") throw new PlatformError(`${label}: ${data.error.code} ${data.error.message}`)
  return data.data
}

export const publishTikTok: Publisher = async ({ caption, file }) => {
  const token = await accessToken()
  const creator = await call<{ privacy_level_options: string[] }>("/post/publish/creator_info/query/", token, {}, "TikTok creator info")
  const wanted = process.env.TIKTOK_PRIVACY?.trim() || "SELF_ONLY"
  const privacy = creator.privacy_level_options.includes(wanted) ? wanted : creator.privacy_level_options[0]

  const bytes = await fs.readFile(file)
  // Files up to 64 MB go up in one chunk (our slideshows are a few MB).
  if (bytes.length > 64 * 1024 * 1024) throw new PlatformError("Video is over 64 MB")
  const init = await call<{ publish_id: string; upload_url: string }>("/post/publish/video/init/", token, {
    post_info: { title: caption, privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false },
    source_info: { source: "FILE_UPLOAD", video_size: bytes.length, chunk_size: bytes.length, total_chunk_count: 1 },
  }, "TikTok init")

  const put = await fetch(init.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}` },
    body: bytes,
  })
  if (!put.ok) throw new PlatformError(`TikTok upload: HTTP ${put.status} ${(await put.text()).slice(0, 200)}`)

  for (let i = 0; i < 60; i++) {
    const st = await call<{ status: string; fail_reason?: string; publicaly_available_post_id?: string[] }>(
      "/post/publish/status/fetch/", token, { publish_id: init.publish_id }, "TikTok status")
    if (st.status === "PUBLISH_COMPLETE") {
      const postId = st.publicaly_available_post_id?.[0]
      return { externalId: postId ?? init.publish_id, url: postId ? `https://www.tiktok.com/video/${postId}` : undefined }
    }
    if (st.status === "FAILED") throw new PlatformError(`TikTok publish failed: ${st.fail_reason ?? "unknown"}`)
    await sleep(5000)
  }
  // Still processing: TikTok finishes on its side; keep the publish id.
  return { externalId: init.publish_id }
}
