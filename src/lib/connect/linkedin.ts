import { callbackUrl, newState, saveConnection, takeState } from "../connections"
import { env, fetchJson } from "../platforms/types"

// "Sign in with LinkedIn" (OpenID Connect) + w_member_social: posts go to your personal profile.
// Tokens last 60 days; reconnect when Settings says it expired. Company pages need LinkedIn's
// Community Management API approval (then set LINKEDIN_SCOPES and LINKEDIN_AUTHOR_URN to the organization).

const scopes = () => process.env.LINKEDIN_SCOPES?.trim() || "openid profile w_member_social"

export function start(): string {
  const q = new URLSearchParams({
    response_type: "code", client_id: env("LINKEDIN_CLIENT_ID"), redirect_uri: callbackUrl("linkedin"),
    state: newState("linkedin"), scope: scopes(),
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${q}`
}

export async function callback(q: URLSearchParams): Promise<string> {
  takeState("linkedin", q.get("state"))
  if (q.get("error")) throw new Error(q.get("error_description") ?? "LinkedIn login cancelled")
  const { data: tok } = await fetchJson<{ access_token: string; expires_in: number }>("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code: q.get("code") ?? "", redirect_uri: callbackUrl("linkedin"),
      client_id: env("LINKEDIN_CLIENT_ID"), client_secret: env("LINKEDIN_CLIENT_SECRET"),
    }),
  }, "LinkedIn token")
  const { data: me } = await fetchJson<{ sub: string; name?: string }>("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  }, "LinkedIn profile")
  const author = process.env.LINKEDIN_AUTHOR_URN?.trim() || `urn:li:person:${me.sub}`
  const name = me.name ?? author
  saveConnection("linkedin", name, { LINKEDIN_ACCESS_TOKEN: tok.access_token, LINKEDIN_AUTHOR_URN: author }, Date.now() + tok.expires_in * 1000)
  return name
}

export async function test(): Promise<string> {
  const { data } = await fetchJson<{ name?: string; sub: string }>("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${env("LINKEDIN_ACCESS_TOKEN")}` },
  }, "LinkedIn")
  return data.name ?? data.sub
}
