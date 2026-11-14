import crypto from "node:crypto"
import fs from "node:fs/promises"
import { env, fetchJson, type Publisher } from "./types"

// X API v2 with OAuth 1.0a user context (app key/secret + the account's access token/secret).
// Multipart and JSON bodies are not part of the OAuth 1.0a signature, so only the URL is signed.

const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())

type Signer = { token?: string; tokenSecret?: string; extra?: Record<string, string> }

/** OAuth 1.0a header. Defaults to the connected account's token; the login flow passes its own. */
export function oauthHeader(method: string, url: string, s: Signer = { token: env("X_ACCESS_TOKEN"), tokenSecret: env("X_ACCESS_SECRET") }): string {
  const o: Record<string, string> = {
    oauth_consumer_key: env("X_API_KEY"),
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...(s.token ? { oauth_token: s.token } : {}),
    ...s.extra,
  }
  const u = new URL(url)
  const params = [...Object.entries(o), ...u.searchParams.entries()].map(([k, v]) => [pct(k), pct(v)])
  params.sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
  const base = [method.toUpperCase(), pct(u.origin + u.pathname), pct(params.map(([k, v]) => `${k}=${v}`).join("&"))].join("&")
  const key = `${pct(env("X_API_SECRET"))}&${pct(s.tokenSecret ?? "")}`
  o.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64")
  return "OAuth " + Object.entries(o).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(", ")
}

export const publishX: Publisher = async ({ caption, file }) => {
  const uploadUrl = "https://api.x.com/2/media/upload"
  const form = new FormData()
  form.append("media", new Blob([await fs.readFile(file)], { type: "image/png" }), "card.png")
  form.append("media_category", "tweet_image")
  const up = await fetchJson<{ data: { id: string } }>(uploadUrl, {
    method: "POST", headers: { Authorization: oauthHeader("POST", uploadUrl) }, body: form,
  }, "X media upload")

  const tweetUrl = "https://api.x.com/2/tweets"
  const { data } = await fetchJson<{ data: { id: string } }>(tweetUrl, {
    method: "POST",
    headers: { Authorization: oauthHeader("POST", tweetUrl), "Content-Type": "application/json" },
    body: JSON.stringify({ text: caption, media: { media_ids: [up.data.data.id] } }),
  }, "X post")
  return { externalId: data.data.id, url: `https://x.com/i/web/status/${data.data.id}` }
}
