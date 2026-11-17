import { appUrl } from "./connections"
import { kvGet, kvSet, run } from "./db"
import { pathmaesterUrl, withUtm } from "./pathmaester-links"

// The one link viewers can tap on TikTok, Instagram and YouTube Shorts: the website link on the profile.
// (Links inside captions there are plain text for normal accounts.) Which address goes in that profile field:
//   1. one the user saved on the Accounts page (e.g. their own link page), else
//   2. this app's public /bio page, once the app is hosted on https, else
//   3. PathMaester itself, which has a search box, so "search “Private Cook”" in the caption still works.

export type BioSource = "custom" | "page" | "pathmaester"
export const BIO_PLATFORMS = ["tiktok", "instagram", "youtube"] as const

export const bioPageUrl = () => (appUrl().startsWith("https://") ? `${appUrl()}/bio` : null)

export function bioLink(): { url: string; source: BioSource } {
  const saved = kvGet("bio_url") || process.env.BIO_URL?.trim()
  if (saved) return { url: saved, source: "custom" }
  const page = bioPageUrl()
  if (page) return { url: page, source: "page" }
  return { url: pathmaesterUrl() ?? "https://pathmaester.com", source: "pathmaester" }
}

/** The address to paste into one platform's profile: tagged so PathMaester's analytics can tell the visits apart. */
export function bioLinkFor(platform: string): string {
  const { url, source } = bioLink()
  if (source === "custom") return url
  if (source === "page") return `${url}?from=${platform}`
  return withUtm(url, `${platform}-bio`)
}

export function saveBioLink(url: string | null) {
  if (!url) { run("DELETE FROM kv WHERE key = 'bio_url'"); return }
  const u = new URL(url)
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Use a web address starting with https://")
  kvSet("bio_url", u.toString())
}
