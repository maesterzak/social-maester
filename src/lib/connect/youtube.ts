import { callbackUrl, newState, saveConnection, takeState } from "../connections"
import { run } from "../db"
import { env, fetchJson, PlatformError } from "../platforms/types"

// "Sign in with Google" for the YouTube channel. access_type=offline + prompt=consent make Google return a
// refresh token every time, which is what the publisher keeps.

const SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"

export function start(): string {
  const q = new URLSearchParams({
    client_id: env("YOUTUBE_CLIENT_ID"), redirect_uri: callbackUrl("youtube"), response_type: "code", scope: SCOPES,
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: newState("youtube"),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

async function channelName(token: string): Promise<string> {
  const { data } = await fetchJson<{ items?: { snippet: { title: string } }[] }>(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${token}` } }, "YouTube channel")
  if (!data.items?.length) throw new PlatformError("This Google account has no YouTube channel — create one on youtube.com first")
  return data.items[0].snippet.title
}

export async function callback(q: URLSearchParams): Promise<string> {
  takeState("youtube", q.get("state"))
  if (q.get("error")) throw new Error(q.get("error_description") ?? "Google login cancelled")
  const { data: tok } = await fetchJson<{ access_token?: string; refresh_token?: string; error_description?: string }>(
    "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("YOUTUBE_CLIENT_ID"), client_secret: env("YOUTUBE_CLIENT_SECRET"),
        code: q.get("code") ?? "", grant_type: "authorization_code", redirect_uri: callbackUrl("youtube"),
      }),
    }, "YouTube token")
  if (!tok.access_token || !tok.refresh_token) throw new PlatformError(`Google login failed: ${tok.error_description ?? "no refresh token"}`)
  const name = await channelName(tok.access_token)
  run("DELETE FROM kv WHERE key = 'youtube_token'")
  saveConnection("youtube", name, { YOUTUBE_REFRESH_TOKEN: tok.refresh_token })
  return name
}

export async function test(): Promise<string> {
  const { accessToken } = await import("../platforms/youtube")
  return channelName(await accessToken())
}
