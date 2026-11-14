import { callbackUrl, newState, saveConnection, setting, takeState } from "../connections"
import { kvGet, kvSet, kvTake } from "../db"
import { env, fetchJson, PlatformError } from "../platforms/types"

// "Log in with Facebook" for the Page (photos) and its linked Instagram professional account (Reels).
// A Page token fetched with a long-lived user token doesn't expire.

const version = () => process.env.META_GRAPH_VERSION?.trim() || "v23.0"
const graph = (path: string) => `https://graph.facebook.com/${version()}/${path}`
const SCOPES = ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "business_management", "instagram_basic", "instagram_content_publish"]

export type MetaPage = { id: string; name: string; token: string; ig?: { id: string; username: string } }

export function start(): string {
  const q = new URLSearchParams({
    client_id: env("META_APP_ID"), redirect_uri: callbackUrl("meta"), state: newState("meta"),
    scope: SCOPES.join(","), response_type: "code",
  })
  return `https://www.facebook.com/${version()}/dialog/oauth?${q}`
}

/** Returns the account name, or null when the user must pick one of several Pages. */
export async function callback(q: URLSearchParams): Promise<string | null> {
  takeState("meta", q.get("state"))
  if (q.get("error")) throw new Error(q.get("error_description") ?? "Facebook login cancelled")
  const app = { client_id: env("META_APP_ID"), client_secret: env("META_APP_SECRET") }
  const { data: short } = await fetchJson<{ access_token: string }>(
    graph(`oauth/access_token?${new URLSearchParams({ ...app, redirect_uri: callbackUrl("meta"), code: q.get("code") ?? "" })}`), {}, "Facebook token")
  const { data: long } = await fetchJson<{ access_token: string }>(
    graph(`oauth/access_token?${new URLSearchParams({ ...app, grant_type: "fb_exchange_token", fb_exchange_token: short.access_token })}`), {}, "Facebook long-lived token")
  const { data: pages } = await fetchJson<{ data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[] }>(
    graph(`me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=50&access_token=${encodeURIComponent(long.access_token)}`), {}, "Facebook pages")
  const list: MetaPage[] = pages.data.map((p) => ({
    id: p.id, name: p.name, token: p.access_token,
    ig: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username ?? "" } : undefined,
  }))
  if (!list.length) throw new PlatformError("No Facebook Pages found — you must be an admin of a Page and allow it in the login dialog")
  if (list.length === 1) return pick(list[0])
  kvSet("meta_pages", JSON.stringify(list))
  return null
}

/** Pages waiting for a choice (names only; tokens stay server-side). */
export function pendingPages(): { id: string; name: string; ig?: string }[] {
  const raw = kvGet("meta_pages")
  return raw ? (JSON.parse(raw) as MetaPage[]).map((p) => ({ id: p.id, name: p.name, ig: p.ig?.username })) : []
}

export function choosePage(id: string): string {
  const list = JSON.parse(kvTake("meta_pages") ?? "[]") as MetaPage[]
  const page = list.find((p) => p.id === id)
  if (!page) throw new Error("That Page is no longer available — click Connect again")
  return pick(page)
}

function pick(p: MetaPage): string {
  const data: Record<string, string> = { FB_PAGE_ID: p.id, FB_PAGE_TOKEN: p.token }
  if (p.ig) Object.assign(data, { IG_USER_ID: p.ig.id, IG_ACCESS_TOKEN: p.token, IG_USERNAME: p.ig.username })
  const name = p.ig ? `${p.name} + @${p.ig.username}` : p.name
  saveConnection("meta", name, data)
  return name
}

export async function test(): Promise<string> {
  const token = env("FB_PAGE_TOKEN")
  const { data } = await fetchJson<{ name: string }>(graph(`${env("FB_PAGE_ID")}?fields=name&access_token=${encodeURIComponent(token)}`), {}, "Facebook Page")
  let out = `Page “${data.name}”`
  const ig = setting("IG_USER_ID")
  if (ig) {
    const { data: igd } = await fetchJson<{ username: string }>(graph(`${ig}?fields=username&access_token=${encodeURIComponent(env("IG_ACCESS_TOKEN"))}`), {}, "Instagram")
    out += `, Instagram @${igd.username}`
  } else out += " (no Instagram professional account linked)"
  return out
}
