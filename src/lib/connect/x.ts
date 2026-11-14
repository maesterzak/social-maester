import { callbackUrl, saveConnection } from "../connections"
import { kvSet, kvTake } from "../db"
import { oauthHeader } from "../platforms/x"
import { fetchJson, PlatformError } from "../platforms/types"

// "Log in with X" (OAuth 1.0a three-legged). The request token X hands out plays the role of the state check.
// X recommends http://127.0.0.1 over localhost for the callback.

export async function start(): Promise<string> {
  const url = "https://api.x.com/oauth/request_token"
  const res = await fetch(url, { method: "POST", headers: { Authorization: oauthHeader("POST", url, { extra: { oauth_callback: callbackUrl("x") } }) } })
  const body = new URLSearchParams(await res.text())
  if (!res.ok || !body.get("oauth_token")) throw new PlatformError(`X login: HTTP ${res.status} — is ${callbackUrl("x")} in the app's callback URLs?`)
  kvSet("x_request_token", JSON.stringify({ token: body.get("oauth_token"), secret: body.get("oauth_token_secret"), at: Date.now() }))
  return `https://api.x.com/oauth/authorize?oauth_token=${encodeURIComponent(body.get("oauth_token")!)}`
}

export async function callback(q: URLSearchParams): Promise<string> {
  const saved = JSON.parse(kvTake("x_request_token") ?? "null") as { token: string; secret: string; at: number } | null
  if (q.get("denied")) throw new Error("You cancelled the X login")
  if (!saved || saved.token !== q.get("oauth_token") || Date.now() - saved.at > 15 * 60_000) throw new Error("X login expired — click Connect again")
  const url = "https://api.x.com/oauth/access_token"
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: oauthHeader("POST", url, { token: saved.token, tokenSecret: saved.secret, extra: { oauth_verifier: q.get("oauth_verifier") ?? "" } }) },
  })
  const body = new URLSearchParams(await res.text())
  if (!res.ok || !body.get("oauth_token")) throw new PlatformError(`X login: HTTP ${res.status}`)
  const name = `@${body.get("screen_name")}`
  saveConnection("x", name, { X_ACCESS_TOKEN: body.get("oauth_token")!, X_ACCESS_SECRET: body.get("oauth_token_secret")! })
  return name
}

export async function test(): Promise<string> {
  const url = "https://api.x.com/2/users/me"
  const { data } = await fetchJson<{ data: { username: string } }>(url, { headers: { Authorization: oauthHeader("GET", url) } }, "X")
  return `@${data.data.username}`
}
