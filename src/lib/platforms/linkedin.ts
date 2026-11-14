import fs from "node:fs/promises"
import { env, fetchJson, PlatformError, type Publisher } from "./types"

// LinkedIn Posts API with an image (Images API upload). Author is a person (urn:li:person:…) or a
// company page (urn:li:organization:…). Commentary uses LinkedIn's "little text" format.

const headers = () => ({
  Authorization: `Bearer ${env("LINKEDIN_ACCESS_TOKEN")}`,
  "LinkedIn-Version": process.env.LINKEDIN_VERSION?.trim() || "202510",
  "X-Restli-Protocol-Version": "2.0.0",
})

/** Escape reserved characters; keep #hashtags as real hashtags. */
export function littleText(s: string): string {
  return s.split(/(#[\p{L}\p{N}_]+)/u).map((part) =>
    /^#[\p{L}\p{N}_]+$/u.test(part)
      ? `{hashtag|\\#|${part.slice(1)}}`
      : part.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => "\\" + c),
  ).join("")
}

export const publishLinkedIn: Publisher = async ({ caption, title, file }) => {
  const author = env("LINKEDIN_AUTHOR_URN")
  const { data: init } = await fetchJson<{ value: { uploadUrl: string; image: string } }>(
    "https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    }, "LinkedIn image init")

  const put = await fetch(init.value.uploadUrl, { method: "PUT", headers: { Authorization: headers().Authorization }, body: await fs.readFile(file) })
  if (!put.ok) throw new PlatformError(`LinkedIn image upload: HTTP ${put.status}`)

  const { res } = await fetchJson("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      author,
      commentary: littleText(caption),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: init.value.image, altText: title.slice(0, 120) } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  }, "LinkedIn post")
  const id = res.headers.get("x-restli-id") ?? ""
  return { externalId: id, url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined }
}
