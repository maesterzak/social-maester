import type { Opportunity } from "./opportunities"
import type { PlatformInfo } from "./platforms/types"
import { pathmaesterUrl, publicOpportunityPath, withUtm } from "./pathmaester-links"
import { xLength } from "./text-length"

/**
 * Link that goes in posts: the job's public PathMaester page (PATHMAESTER_URL, tagged with the platform for
 * Analytics); else this app's public share page (/s/<id>) once it is hosted on https; else the apply link.
 */
export function linkFor(o: Opportunity, platform?: string): string | null {
  const pm = pathmaesterUrl()
  if (pm) {
    const url = `${pm}${publicOpportunityPath(o)}`
    return platform ? withUtm(url, platform) : url
  }
  const app = process.env.APP_URL?.trim().replace(/\/$/, "")
  if (app?.startsWith("https://")) return `${app}/s/${o.id}`
  return o.applyUrl
}
export const shareLink = linkFor

/** Cut long text at a word boundary. */
function clip(s: string, max: number) {
  if (s.length <= max) return s
  return s.slice(0, max).replace(/\s+\S*$/, "") + "…"
}

export function formatDeadline(d: string | null): string | null {
  if (!d) return null
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

export const moneyLine = (o: Opportunity) => (o.kind === "SCHOLARSHIP" ? o.awardAmount : o.salaryText)

const WORK_MODE: Record<string, string> = { REMOTE: "Remote", HYBRID: "Hybrid", ONSITE: "On-site" }
export const workModeLabel = (m: string) => WORK_MODE[m] ?? null

function hashtags(o: Opportunity, max: number): string {
  const base = o.kind === "SCHOLARSHIP" ? ["Scholarship", "StudyAbroad"] : ["Jobs", "Hiring"]
  const fromTags = o.tags.map((t) => t.replace(/[^\p{L}\p{N}]+(.)?/gu, (_, c: string | undefined) => (c ? c.toUpperCase() : "")))
  const brand = process.env.BRAND_HASHTAG?.trim()
  const all = [...new Set([...base, ...fromTags, ...(brand ? [brand.replace(/^#/, "")] : [])])].filter(Boolean)
  return all.slice(0, max).map((t) => "#" + t[0].toUpperCase() + t.slice(1)).join(" ")
}

export function buildCaption(o: Opportunity, p: PlatformInfo): string {
  const link = linkFor(o, p.id)
  const deadline = formatDeadline(o.deadline)
  const money = moneyLine(o)
  const head = o.kind === "SCHOLARSHIP" ? "🎓 SCHOLARSHIP" : "💼 JOB OPPORTUNITY"
  const place = [o.location, workModeLabel(o.workMode)].filter(Boolean).join(" · ")

  if (p.id === "x") {
    const tail = [place && `📍 ${place}`, deadline && `⏳ Deadline: ${deadline}`, link && `👉 ${link}`, hashtags(o, 3)].filter(Boolean).join("\n")
    let title = `${o.kind === "SCHOLARSHIP" ? "🎓" : "💼"} ${o.title} — ${o.organization}`
    while (xLength(`${title}\n${tail}`) > 280 && title.length > 20) title = title.slice(0, -2).trimEnd() + "…"
    return `${title}\n${tail}`
  }

  const lines = [
    head,
    o.title,
    `🏛 ${o.organization}`,
    place && `📍 ${place}`,
    money && `💰 ${money}`,
    o.employmentType && `🕒 ${o.employmentType}`,
    deadline && `⏳ Deadline: ${deadline}`,
    "",
    clip(o.summary ?? "", 400),
  ]
  if (o.eligibility.length) lines.push("", "✅ Who can apply:", ...o.eligibility.slice(0, 4).map((e) => `• ${clip(e, 120)}`))
  if (link) lines.push("", p.linksDead ? `👉 Apply: link in bio\n${link}` : `👉 Apply: ${link}`)
  lines.push("", hashtags(o, p.linksDead ? 8 : 5))

  let text = lines.filter((l) => typeof l === "string").join("\n").replace(/\n{3,}/g, "\n\n").trim()
  if ([...text].length > p.captionLimit) text = [...text].slice(0, p.captionLimit - 1).join("") + "…"
  return text
}
