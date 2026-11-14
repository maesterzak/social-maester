import { appUrl, callbackUrl, newState, saveConnection, takeState } from "../connections"
import { kvSet } from "../db"
import { env, fetchJson, PlatformError } from "../platforms/types"

// "Log in with TikTok" (Login Kit for web). TikTok only accepts https redirect URLs, so APP_URL must be
// an https address (a tunnel such as cloudflared/ngrok, or the deployed site) for this button to work.

const API = "https://open.tiktokapis.com/v2"

export const needsHttps = () => !appUrl().startsWith("https://")

export function start(): string {
  if (needsHttps()) throw new Error("TikTok only allows https login callbacks — set APP_URL to an https address first")
  const q = new URLSearchParams({
    client_key: env("TIKTOK_CLIENT_KEY"), response_type: "code", scope: "user.info.basic,video.publish",
    redirect_uri: callbackUrl("tiktok"), state: newState("tiktok"),
  })
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`
}

export async function callback(q: URLSearchParams): Promise<string> {
  takeState("tiktok", q.get("state"))
  if (q.get("error")) throw new Error(q.get("error_description") ?? "TikTok login cancelled")
  const { data: tok } = await fetchJson<{ access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; error_description?: string }>(
    `${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"),
        code: q.get("code") ?? "", grant_type: "authorization_code", redirect_uri: callbackUrl("tiktok"),
      }),
    }, "TikTok token")
  if (!tok.access_token || !tok.refresh_token) throw new PlatformError(`TikTok login failed: ${tok.error_description ?? "no token"}`)
  // The publisher keeps the live access/refresh pair in kv and refreshes it as needed.
  kvSet("tiktok_tokens", JSON.stringify({ access: tok.access_token, refresh: tok.refresh_token, expiresAt: Date.now() + (tok.expires_in ?? 86400) * 1000 }))
  const name = await displayName(tok.access_token).catch(() => "TikTok account")
  saveConnection("tiktok", name, { TIKTOK_REFRESH_TOKEN: tok.refresh_token }, Date.now() + (tok.refresh_expires_in ?? 365 * 86400) * 1000)
  return name
}

async function displayName(token: string): Promise<string> {
  const { data } = await fetchJson<{ data: { user: { display_name: string } } }>(`${API}/user/info/?fields=display_name`, {
    headers: { Authorization: `Bearer ${token}` },
  }, "TikTok user")
  return data.data.user.display_name
}

export async function test(): Promise<string> {
  const { accessToken } = await import("../platforms/tiktok")
  return displayName(await accessToken())
}
