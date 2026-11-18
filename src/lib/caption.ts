import type { Opportunity } from "./opportunities"
import type { PlatformInfo } from "./platforms/types"
import { pathmaesterUrl, publicOpportunityPath, withUtm } from "./pathmaester-links"
import { xLength } from "./text-length"
import { audienceInfo, classify, type Segment } from "./segments"

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

/** What viewers type into the search box on the bio link (PathMaester and the /bio page both search titles). */
export const searchTerm = (title: string) => {
  const t = title.replace(/\s*[([].*$/, "").trim() || title
  return t.length <= 45 ? t : t.split(/\s+/).slice(0, 5).join(" ")
}
/** "pathmaester.com": readable, for platforms where a full link can't be tapped anyway. */
const siteName = () => {
  const pm = pathmaesterUrl()
  try { return pm ? new URL(pm).hostname.replace(/^www\./, "") : null } catch { return null }
}
/** TikTok, Instagram and YouTube Shorts: captions can't hold a tappable link, so point at the profile link. */
// YouTube has no "bio": the tappable link sits under the channel name, so say that there.
// `alsoDirect` = the caption already has the job's own link above, so this line is the backup way in.
const bioLine = (find: string, platform = "", alsoDirect = false) => [
  platform === "youtube"
    ? `🔗 ${alsoDirect ? "Or open" : "Apply: open"} our channel, tap the link under our name, then search ${find}`
    : `🔗 Apply: tap the link in our bio, then search ${find}`,
  siteName() && `🌐 ${siteName()}`,
].filter(Boolean).join("\n")

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
/** "Lagos · On-site"; a location that already says the work mode ("Remote") isn't repeated. */
export const placeLine = (o: Opportunity) => [...new Set([o.location?.trim(), workModeLabel(o.workMode)].filter(Boolean))].join(" · ")

/** The headline that tells the right people "this one is for you". Used by captions and by the card label. */
export function audienceHeadline(o: Opportunity, s: Segment = classify(o)): { emoji: string; text: string } {
  if (o.kind === "SCHOLARSHIP") return { emoji: "🎓", text: s.funded ? "FULLY FUNDED SCHOLARSHIP" : "SCHOLARSHIP" }
  if (s.level === "NONE") return { emoji: "🚀", text: s.noExperienceStated ? "NO EXPERIENCE NEEDED" : s.remote ? "EASY-ENTRY REMOTE JOB" : "EASY-ENTRY JOB" }
  if (s.level === "ENTRY") return { emoji: "🌱", text: s.remote ? "ENTRY-LEVEL REMOTE JOB" : "ENTRY-LEVEL JOB" }
  if (s.remote) return { emoji: "💻", text: "REMOTE JOB" }
  return s.primary === "DIGITAL" ? { emoji: "💻", text: "DIGITAL JOB" } : { emoji: "🛠", text: "ON-SITE JOB" }
}

/** Hashtags the target audience actually searches for. */
function audienceTags(o: Opportunity, s: Segment): string[] {
  if (o.kind === "SCHOLARSHIP") return [...(s.funded ? ["FullyFunded"] : []), ...(s.study.includes("PHD") ? ["PhD"] : []), ...(s.study.includes("MASTERS") ? ["Masters"] : [])]
  return [
    ...(s.level === "NONE" ? [s.noExperienceStated ? "NoExperience" : "NowHiring", "JobAlert"] : s.level === "ENTRY" ? ["EntryLevel", "GraduateJobs"] : []),
    ...(s.remote ? ["RemoteJobs", "WorkFromHome"] : s.primary === "DIGITAL" ? ["TechJobs"] : ["OnsiteJobs"]),
  ]
}

function hashtags(o: Opportunity, max: number, extra: string[] = []): string {
  const kindTags = o.kind === "SCHOLARSHIP" ? ["Scholarship", "StudyAbroad"] : ["Jobs", "Hiring"]
  const base = [...extra, kindTags[0], ...audienceTags(o, classify(o)), kindTags[1]]
  const fromTags = o.tags.map((t) => t.replace(/[^\p{L}\p{N}]+(.)?/gu, (_, c: string | undefined) => (c ? c.toUpperCase() : "")))
  const brand = process.env.BRAND_HASHTAG?.trim()
  const all = [...new Set([...base, ...fromTags, ...(brand ? [brand.replace(/^#/, "")] : [])])].filter(Boolean)
  return all.slice(0, max).map((t) => "#" + t[0].toUpperCase() + t.slice(1)).join(" ")
}

export function buildCaption(o: Opportunity, p: PlatformInfo): string {
  const link = linkFor(o, p.id)
  const deadline = formatDeadline(o.deadline)
  const money = moneyLine(o)
  const seg = classify(o)
  const h = audienceHeadline(o, seg)
  const head = `${h.emoji} ${h.text}`
  const bestFor = `🎯 Best for: ${audienceInfo(seg.primary).bestFor}`
  const place = placeLine(o)

  if (p.id === "x") {
    const tail = [place && `📍 ${place}`, deadline && `⏳ Deadline: ${deadline}`, link && `👉 ${link}`, hashtags(o, 3)].filter(Boolean).join("\n")
    let title = `${head}\n${o.title} — ${o.organization}`
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
    bestFor,
    seg.scopeLabel && (o.kind === "SCHOLARSHIP" || seg.scope === "WORLD") && `🌍 Open to: ${seg.scopeLabel}`,
    "",
    clip(o.summary ?? "", 400),
  ]
  if (o.eligibility.length) lines.push("", "✅ Who can apply:", ...o.eligibility.slice(0, 4).map((e) => `• ${clip(e, 120)}`))
  // YouTube: the job's own link goes in the description too (not tappable in a Short, but it is copyable, and it is
  // tappable when the description is opened on a computer), with the channel-link route as the backup.
  if (p.id === "youtube" && link) lines.push("", `👉 Apply now: ${link}`, bioLine(`“${searchTerm(o.title)}”`, p.id, true))
  else if (p.linksDead) lines.push("", bioLine(`“${searchTerm(o.title)}”`, p.id))
  else if (link) lines.push("", `👉 Apply: ${link}`)
  lines.push("", hashtags(o, p.linksDead ? 8 : 5, p.id === "youtube" ? ["Shorts"] : []))

  let text = lines.filter((l) => typeof l === "string").join("\n").replace(/\n{3,}/g, "\n\n").trim()
  if ([...text].length > p.captionLimit) text = [...text].slice(0, p.captionLimit - 1).join("") + "…"
  return text
}

// ---------- Top 5 digests: one post that lists several opportunities ----------

const NUMS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"]

/** One link for the whole digest (for platforms that allow only one): PathMaester's jobs or scholarships list,
 *  or its home page for a mix. */
export function digestLink(opps: Opportunity[], platform?: string): string | null {
  const pm = pathmaesterUrl()
  if (!pm) return null
  const jobs = opps.filter((o) => o.kind === "JOB").length
  const url = jobs === opps.length ? `${pm}/jobs` : jobs === 0 ? `${pm}/scholarships` : `${pm}/`
  return platform ? withUtm(url, platform, "social-maester-digest") : url
}

/** The hashtags most of the items share, plus the brand. */
function digestTags(opps: Opportunity[], max: number, extra: string[] = []): string {
  const count = new Map<string, number>()
  for (const o of opps) {
    const s = classify(o)
    const kind = o.kind === "SCHOLARSHIP" ? ["Scholarships", "StudyAbroad"] : ["Jobs", "Hiring"]
    for (const t of [...kind, ...audienceTags(o, s)]) count.set(t, (count.get(t) ?? 0) + 1)
  }
  const ranked = [...count].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  const brand = process.env.BRAND_HASHTAG?.trim()?.replace(/^#/, "")
  return [...new Set([...extra, ...ranked, ...(brand ? [brand] : [])])].slice(0, max).map((t) => `#${t}`).join(" ")
}

export function buildDigestCaption(title: string, opps: Opportunity[], p: PlatformInfo): string {
  const head = `🔥 ${title.trim()}`
  const one = digestLink(opps, p.id)
  const place = placeLine

  if (p.id === "x") {
    // 280 characters with one link: the titles get shorter until everything fits.
    const tail = [one && `👉 All ${opps.length}: ${one}`, digestTags(opps, 2)].filter(Boolean).join("\n")
    for (let max = 60; max >= 12; max -= 4) {
      const lines = opps.map((o, i) => `${i + 1}. ${clip(o.title, max)}`)
      const text = [head, ...lines, tail].join("\n")
      if (xLength(text) <= 280) return text
    }
    return [head, tail].join("\n")
  }

  if (p.id === "telegram") {
    // Photo captions stop at 1024 characters: names and deadlines, one link to the full list.
    const lines = opps.map((o, i) => `${NUMS[i]} ${clip(o.title, 70)} — ${clip(o.organization, 40)}${o.deadline ? `\n⏳ ${formatDeadline(o.deadline)}` : ""}`)
    const text = [head, "", ...lines.flatMap((l) => [l, ""]), one && `👉 Apply: ${one}`, "", digestTags(opps, 4)].filter((l) => l !== null).join("\n")
    return [...text].length > p.captionLimit ? [...text].slice(0, p.captionLimit - 1).join("") + "…" : text
  }

  const blocks = opps.map((o, i) => {
    const link = linkFor(o, p.id)
    return [
      `${NUMS[i]} ${o.title}`,
      `🏛 ${o.organization}${place(o) ? ` · 📍 ${place(o)}` : ""}`,
      o.deadline && `⏳ Deadline: ${formatDeadline(o.deadline)}`,
      (!p.linksDead || p.id === "youtube") && link && `👉 ${link}`,
    ].filter(Boolean).join("\n")
  })
  const footer = p.linksDead
    ? [bioLine("any title above", p.id, p.id === "youtube"), "", digestTags(opps, 8, p.id === "youtube" ? ["Shorts"] : [])]
    : ["Save this post and share it with someone who needs it. 🙌", "", digestTags(opps, 5)]
  let text = [head, "", ...blocks.flatMap((b) => [b, ""]), ...footer].join("\n").replace(/\n{3,}/g, "\n\n").trim()
  if ([...text].length > p.captionLimit) text = [...text].slice(0, p.captionLimit - 1).join("") + "…"
  return text
}
