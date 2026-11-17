import { whoCanApply, type Scope } from "./eligibility"

// Who is each job/scholarship for? Pure rules over the text PathMaester already has (no server imports, so the
// browser can use it too). Every job gets a work style (DIGITAL or PHYSICAL) and a level; low-barrier jobs are
// also in STARTER ("quick start": little or no skill needed). Scholarships get study levels + funding.

export type Audience = "DIGITAL" | "PHYSICAL" | "STARTER" | "SCHOLARSHIP"
/** NONE = no skill/experience needed, ENTRY = interns, trainees, fresh graduates. */
export type Level = "NONE" | "ENTRY" | "MID" | "SENIOR"
export type Study = "UNDERGRAD" | "MASTERS" | "PHD"

export type Segment = {
  audiences: Audience[]
  /** The one audience this post should speak to first. */
  primary: Audience
  level: Level
  remote: boolean
  /** The listing itself says no experience/degree is needed (so posts may say it too). */
  noExperienceStated: boolean
  study: Study[]
  funded: boolean
  /** Who may apply, read from the listing (eligibility.ts). */
  scope: Scope
  scopeLabel: string
  /** Short labels for the picker, most important first. */
  badges: string[]
}

type Input = {
  kind: "JOB" | "SCHOLARSHIP"; title: string; location?: string | null; workMode?: string | null; employmentType?: string | null
  category?: string | null; summary?: string | null; awardAmount?: string | null; eligibility?: string[]; tags?: string[]
}

export const AUDIENCES: { id: Audience; emoji: string; name: string; hint: string; bestFor: string }[] = [
  { id: "DIGITAL", emoji: "💻", name: "Digital work", hint: "Laptop, online and remote jobs", bestFor: "people who want digital or remote work" },
  { id: "PHYSICAL", emoji: "🛠", name: "Physical work", hint: "On-site and hands-on jobs", bestFor: "people who want on-site, hands-on work" },
  { id: "STARTER", emoji: "🚀", name: "Quick start", hint: "Little or no skill needed", bestFor: "people who want to start earning soon, without years of experience" },
  { id: "SCHOLARSHIP", emoji: "🎓", name: "Scholarships", hint: "Study funding", bestFor: "students who want funded study" },
]
export const audienceInfo = (id: Audience) => AUDIENCES.find((a) => a.id === id)!

const SENIOR = /\b(senior|sr|lead|principal|staff|head|director|vp|vice president|chief|c[etf]o|manager|architect|founding|expert|supervisor|consultant|partner)\b/
const ENTRY = /\b(intern|interns|internship|trainee|trainees|graduate|entry[- ]level|junior|jr|apprentice|apprenticeship|nysc|corper|siwes|fresher|early career|volunteer)\b/
// Work most people can start without a degree or special training.
const NO_SKILL = /\b(cleaner|janitor|driver|rider|dispatch|guard|waiter|waitress|steward|stewardess|cook|kitchen|housekeep\w*|nanny|attendant|cashier|receptionist|front desk|store ?keeper|shop|sales (rep\w*|girl|boy|attendant|assistant|associate|agent)|factory|labou?rer|loader|porter|messenger|office assistant|gardener|bartender|barista|usher|packer|machine operator|delivery (rider|driver|agent|man|person|assistant)|call cent(er|re)|customer (service|care|support) (rep\w*|agent|officer|assistant|associate)|data entry|telemarketer|caregiver|merchandiser|canvasser|field (agent|marketer)|helper|handyman|laundry|tailor|domestic)\b/
const NO_SKILL_TEXT = /\b(no (prior |previous |work )?experience|without experience|ssce|o'? ?level|waec|neco|secondary school|no degree|no qualification|training (is|will be) provided)\b/

const DIGITAL = /\b(software|developer|programm\w*|full[- ]?stack|front[- ]?end|back[- ]?end|devops|sysadmin|cloud|cyber\w*|data|machine learning|ml|ai|python|javascript|react|web|saas|ux|ui|product (design\w*|manag\w*)|design\w*|graphic\w*|motion|video edit\w*|content|copywrit\w*|writer|seo|social media|digital|virtual|online|remote|it|ict|tech\w*|qa|blockchain|crypto|analyst|analytics|e-?commerce)\b/
const PHYSICAL = /\b(mechanic\w*|civil|electric\w*|technician|plumb\w*|weld\w*|construction|field|driver|rider|nurs\w*|doctor|pharmac\w*|medical|clinical|laborator\w*|health\w*|hospital|warehouse|logistics|factory|production|manufactur\w*|operator|maintenance|chef|cook|kitchen|hotel|hospitality|security (guard|officer|man)|guard|clean\w*|farm\w*|agric\w*|teacher|retail|store|installation|hse|mining|oil|gas|marine|aviation|facility|survey\w*|automotive|plant|quality control|receptionist|front desk|cashier|waiter|waitress|attendant|housekeep\w*)\b/

// Unmistakably computer work, even when the listing also mentions a plant, a site or a hospital client.
const STRONG_DIGITAL = /\b(software|developer|programm\w*|full[- ]?stack|front[- ]?end|back[- ]?end|devops|sysadmin|cloud|cyber\w*|data (scien\w*|engineer\w*|analy\w*)|machine learning|ai|python|javascript|web|saas|ux|ui|product design\w*|graphic\w*|social media|digital marketing|it support)\b/

const UNDERGRAD = /\b(undergraduate|bachelor\w*|b\.?sc|first degree|secondary school leavers?|high school)\b/
const MASTERS = /\b(master\w*|m\.?sc|mba|postgraduate|post-graduate|graduate (study|studies|school|program\w*))\b/
const PHD = /\b(ph\.?d|doctoral|doctorate|postdoc\w*|post-doc\w*)\b/
const FUNDED = /\b(fully[- ]funded|full(y)? (scholarship|tuition|funding)|full ride|stipend|all expenses)\b/

export function classify(o: Input): Segment {
  const title = o.title.toLowerCase()
  const meta = [o.title, o.category, o.employmentType, ...(o.tags ?? [])].filter(Boolean).join(" · ").toLowerCase()
  const body = [o.summary, ...(o.eligibility ?? [])].filter(Boolean).join(" ").toLowerCase()
  const who = whoCanApply(o)
  const whoBadge = who.scope === "WORLD" ? ["Open worldwide"] : who.scope === "REGION" ? [`${who.label} only`] : o.kind === "SCHOLARSHIP" && who.scope === "COUNTRY" ? ["Limited eligibility"] : []

  if (o.kind === "SCHOLARSHIP") {
    const text = `${meta} ${body}`
    const study: Study[] = []
    if (UNDERGRAD.test(text)) study.push("UNDERGRAD")
    if (MASTERS.test(text)) study.push("MASTERS")
    if (PHD.test(text)) study.push("PHD")
    const funded = FUNDED.test(`${text} ${o.awardAmount ?? ""}`.toLowerCase())
    const names: Record<Study, string> = { UNDERGRAD: "Undergraduate", MASTERS: "Masters", PHD: "PhD" }
    return {
      audiences: ["SCHOLARSHIP"], primary: "SCHOLARSHIP", level: "ENTRY", remote: false, noExperienceStated: false, study, funded,
      scope: who.scope, scopeLabel: who.label,
      badges: [...(funded ? ["Fully funded"] : []), ...study.map((s) => names[s]), ...whoBadge],
    }
  }

  const noExperienceStated = !SENIOR.test(title) && NO_SKILL_TEXT.test(body)
  const level: Level = SENIOR.test(title) ? "SENIOR"
    : NO_SKILL.test(title) || noExperienceStated ? "NONE"
    : ENTRY.test(meta) ? "ENTRY"
    : "MID"

  const remote = o.workMode === "REMOTE"
  const physicalWords = PHYSICAL.test(meta)
  const digitalWords = DIGITAL.test(meta)
  // Remote is always digital. Otherwise hands-on words win over computer words ("Field IT technician");
  // with no clue at all, a job that isn't remote is one you turn up for.
  const strongDigital = STRONG_DIGITAL.test(`${title} · ${(o.category ?? "").toLowerCase()}`)
  const style: Audience = remote || strongDigital ? "DIGITAL" : physicalWords ? "PHYSICAL" : digitalWords ? "DIGITAL" : "PHYSICAL"
  const starter = level === "NONE" || level === "ENTRY"

  const badges = [
    style === "DIGITAL" ? (remote ? "Digital · Remote" : "Digital") : (physicalWords && !strongDigital ? "Hands-on" : "On-site"),
    ...(level === "NONE" ? [noExperienceStated ? "No experience needed" : "Easy entry"] : level === "ENTRY" ? ["Entry level"] : []),
    ...whoBadge,
  ]
  return {
    audiences: starter ? [style, "STARTER"] : [style],
    // A no-skill job is first of all for people who need work now; an internship still leads with its work style.
    primary: level === "NONE" ? "STARTER" : style,
    level, remote, noExperienceStated, study: [], funded: false, scope: who.scope, scopeLabel: who.label, badges,
  }
}

/** Themed days keep the feed varied: each weekday speaks to one audience. 0 = Sunday. */
export const WEEK_THEMES: Audience[] = ["STARTER", "DIGITAL", "SCHOLARSHIP", "PHYSICAL", "STARTER", "DIGITAL", "SCHOLARSHIP"]
