import fs from "node:fs/promises"
import { env, fetchJson, PlatformError, sleep, type Publisher } from "./types"

// Facebook Page photo posts and Instagram Reels, both through the Graph API with a Page access token
// (Instagram professional account linked to that Page).

const version = () => process.env.META_GRAPH_VERSION?.trim() || "v23.0"
const graph = (path: string) => `https://graph.facebook.com/${version()}/${path}`

export const publishFacebook: Publisher = async ({ caption, file }) => {
  const form = new FormData()
  form.append("source", new Blob([await fs.readFile(file)], { type: "image/png" }), "card.png")
  form.append("message", caption)
  form.append("published", "true")
  form.append("access_token", env("FB_PAGE_TOKEN"))
  const { data } = await fetchJson<{ id: string; post_id?: string }>(graph(`${env("FB_PAGE_ID")}/photos`), { method: "POST", body: form }, "Facebook photo")
  const postId = data.post_id ?? data.id
  return { externalId: postId, url: `https://www.facebook.com/${postId}` }
}

// Reels via resumable upload, so the video doesn't need a public URL.
export const publishInstagram: Publisher = async ({ caption, file }) => {
  const token = env("IG_ACCESS_TOKEN")
  const igUser = env("IG_USER_ID")
  const params = new URLSearchParams({ media_type: "REELS", upload_type: "resumable", caption, share_to_feed: "true", access_token: token })
  const { data: container } = await fetchJson<{ id: string; uri: string }>(graph(`${igUser}/media`), { method: "POST", body: params }, "Instagram container")

  const bytes = await fs.readFile(file)
  await fetchJson(container.uri, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(bytes.length) },
    body: bytes,
  }, "Instagram upload")

  // Instagram processes the video before it can be published.
  for (let i = 0; ; i++) {
    const { data: st } = await fetchJson<{ status_code: string; status?: string }>(
      graph(`${container.id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`), {}, "Instagram status")
    if (st.status_code === "FINISHED") break
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new PlatformError(`Instagram processing failed: ${st.status ?? st.status_code}`)
    if (i >= 60) throw new PlatformError("Instagram processing timed out after 5 minutes")
    await sleep(5000)
  }

  const { data } = await fetchJson<{ id: string }>(graph(`${igUser}/media_publish`), {
    method: "POST", body: new URLSearchParams({ creation_id: container.id, access_token: token }),
  }, "Instagram publish")
  const { data: link } = await fetchJson<{ permalink?: string }>(
    graph(`${data.id}?fields=permalink&access_token=${encodeURIComponent(token)}`), {}, "Instagram permalink").catch(() => ({ data: {} as { permalink?: string } }))
  return { externalId: data.id, url: link.permalink }
}
