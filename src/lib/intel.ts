import type { Audience } from "./segments"

// The "thinking" parts of the hub, all plain rules that run in the browser (no AI service, nothing sent anywhere):
// understanding a typed request, scoring how well a post should do, alternative opening lines, and posting times.

/** The slice of an opportunity these rules need (matches OppLite in components/types.ts). */
export type Scorable = {
  kind: "JOB" | "SCHOLARSHIP"; organization: string; primary: string; level: string; remote: boolean; funded: boolean
  postedTo: string[]; daysLeft: number | null; scope: string; scopeLabel: string
}

// ---------- 1. Ask bar: "remote jobs with no experience closing this week" → filters ----------

export type Intent = {
  aud: Audience | null
  /** Sub-filter id used by the composer: NOSKILL, FUNDED, UNDERGRAD, MASTERS, PHD. */
  sub: string
  remote: boolean
  /** Only what the listing opens to every country. */
  world: boolean
  soon: boolean
  fresh: boolean
  /** What is left to match against title / organisation / location. */
  text: string
  understood: string[]
}

type Rule = [RegExp, (i: Intent) => void, string]
const setAud = (i: Intent, a: Audience) => { i.aud ??= a }

const RULES: Rule[] = [
  [/\b(no|without|zero|little|any) (work )?(experience|skills?|degree|qualifications?)\b|\bunskilled\b|\bbeginners?\b|\beasy( entry)?\b|\bsurviv\w*\b|\bany ?jobs?\b/g,
    (i) => { setAud(i, "STARTER"); i.sub = "NOSKILL" }, "easy entry"],
  [/\b(entry[- ]level|interns?|internships?|trainees?|graduates?|junior|starter|quick start)\b/g, (i) => setAud(i, "STARTER"), "quick start"],
  [/\b(fully[- ]funded|full funding|funded)\b/g, (i) => { setAud(i, "SCHOLARSHIP"); i.sub = "FUNDED" }, "fully funded"],
  [/\b(ph\.?d|doctorate|doctoral)\b/g, (i) => { setAud(i, "SCHOLARSHIP"); i.sub ||= "PHD" }, "PhD"],
  [/\b(masters?|m\.?sc|mba|postgraduate)\b/g, (i) => { setAud(i, "SCHOLARSHIP"); i.sub ||= "MASTERS" }, "masters"],
  [/\b(undergraduate|bachelor'?s?)\b/g, (i) => { setAud(i, "SCHOLARSHIP"); i.sub ||= "UNDERGRAD" }, "undergraduate"],
  [/\b(scholarships?|study abroad|bursar\w*|fellowships?)\b/g, (i) => setAud(i, "SCHOLARSHIP"), "scholarships"],
  [/\b(remote|work(ing)? from home|wfh|from home|from anywhere)\b/g, (i) => { setAud(i, "DIGITAL"); i.remote = true }, "remote only"],
  [/\b(digital|online|tech|laptop|computer)\b/g, (i) => setAud(i, "DIGITAL"), "digital work"],
  [/\b(physical|on-?site|hands[- ]on|manual|in[- ]person)\b/g, (i) => setAud(i, "PHYSICAL"), "physical work"],
  [/\b(worldwide|world ?wide|any country|all nationalities|international|global(ly)?|open to (all|everyone))\b/g, (i) => { i.world = true }, "open worldwide"],
  [/\b(closing( soon)?|urgent|deadline|last chance|this week|ending( soon)?|expir\w*)\b/g, (i) => { i.soon = true }, "closing in 7 days"],
  [/\b(not posted( yet)?|unposted|never posted|haven'?t posted|new|fresh)\b/g, (i) => { i.fresh = true }, "not posted yet"],
]
const FILLER = /\b(jobs?|work|works|roles?|opportunit(y|ies)|vacanc(y|ies)|for|in|at|the|that|with|a|an|and|or|me|show|find|get|give|i|want|need|people|who|is|are|to|of|some|please|only)\b/g

export function parseIntent(q: string): Intent {
  const i: Intent = { aud: null, sub: "", remote: false, world: false, soon: false, fresh: false, text: "", understood: [] }
  let rest = ` ${q.toLowerCase()} `
  for (const [re, apply, label] of RULES) {
    re.lastIndex = 0
    if (!re.test(rest)) continue
    apply(i)
    i.understood.push(label)
    rest = rest.replace(re, " ")
  }
  i.text = rest.replace(FILLER, " ").replace(/[^\p{L}\p{N}\s&+.-]/gu, " ").replace(/\s+/g, " ").trim()
  return i
}

export const ASK_EXAMPLES = [
  "remote jobs with no experience",
  "fully funded masters closing this week",
  "physical work in Lagos",
  "scholarships open worldwide",
]

// ---------- 2. Reach score: how strongly a post should pull, 0–99, with the reasons ----------

export function reachScore(o: Scorable, theme: string): { score: number; why: string[]; raw: number } {
  let s = 38
  const why: string[] = []
  const add = (n: number, reason: string) => { s += n; why.push(`${n > 0 ? "+" : "−"}${Math.abs(n)}  ${reason}`) }
  if (o.postedTo.length === 0) add(15, "never posted, so it is new to your followers")
  else add(-22, "already posted, so a repeat")
  if (o.daysLeft !== null) {
    if (o.daysLeft <= 1) add(-14, "closes today or tomorrow, so too late for most people")
    else if (o.daysLeft <= 7) add(20, "closes this week, and urgency gets clicks")
    else if (o.daysLeft <= 14) add(10, "closes within two weeks")
  }
  if (o.remote) add(10, "remote, so anyone anywhere can apply")
  if (o.funded) add(12, "fully funded")
  if (o.level === "NONE") add(12, "easy entry, so the widest audience")
  else if (o.level === "ENTRY") add(8, "entry level, open to fresh graduates")
  else if (o.level === "SENIOR") add(-6, "senior role, so a small audience")
  if (o.primary === theme) add(8, "matches today's theme")
  return { score: Math.max(1, Math.min(99, s)), why, raw: s }
}

// ---------- 3. Opening lines: other ways to start the same caption ----------

export function hookLines(o: Scorable): string[] {
  const out: string[] = []
  if (o.daysLeft !== null && o.daysLeft >= 1 && o.daysLeft <= 21) out.push(`⏳ ${o.daysLeft} day${o.daysLeft === 1 ? "" : "s"} left to apply`)
  out.push(
    o.kind === "SCHOLARSHIP" ? (o.funded ? "🎓 Want to study without paying the fees?" : "🎓 Planning to study? This could help pay for it")
      : o.primary === "STARTER" ? "🚀 Need a job but short on experience? Start here"
      : o.remote ? "💻 Want a job you can do from home?"
      : o.primary === "DIGITAL" ? "💻 Good with a laptop? This one is for you"
      : "🛠 Prefer real, hands-on work? Read this")
  out.push(`📢 ${o.organization} is ${o.kind === "SCHOLARSHIP" ? "accepting applications" : "hiring"}`)
  out.push("👀 Tag someone who needs to see this")
  return out
}

// ---------- 4. Posting times: common rules of thumb (local time), not measured from your own accounts ----------

export const BEST_TIMES: Record<string, { label: string; windows: [number, number][] }> = {
  x: { label: "8–10am, 6–9pm", windows: [[8, 10], [18, 21]] },
  facebook: { label: "1–4pm", windows: [[13, 16]] },
  linkedin: { label: "8–10am on weekdays", windows: [[8, 10]] },
  telegram: { label: "7–9pm", windows: [[19, 21]] },
  whatsapp: { label: "7–9pm", windows: [[19, 21]] },
  instagram: { label: "6–9pm", windows: [[18, 21]] },
  tiktok: { label: "7–10pm", windows: [[19, 22]] },
  youtube: { label: "6–9pm", windows: [[18, 21]] },
}
export const goodNow = (platform: string, hour: number) => (BEST_TIMES[platform]?.windows ?? []).some(([a, b]) => hour >= a && hour < b)

// ---------- 5. Maester's pick: which posts will pull the most people to PathMaester, on the chosen platforms ----------
// Three things are weighed: the post itself (reach score), how much of a worldwide audience can actually apply, and how well it suits the crowd on each chosen platform. Platform crowds are general
// knowledge about who uses each network, not numbers measured from your own accounts.

/** The audience is worldwide, so what counts is how many of them the listing lets apply (read by eligibility.ts). */
function homeFit(o: Scorable): { pts: number; why: string } | null {
  if (o.scope === "WORLD") return { pts: 12, why: o.kind === "SCHOLARSHIP" ? "the listing is open to all nationalities" : "remote with no country limit, so anyone can apply" }
  if (o.scope === "REGION") return { pts: -3, why: `only for ${o.scopeLabel}` }
  if (o.scope === "COUNTRY") return o.kind === "SCHOLARSHIP"
    ? { pts: -12, why: `limited: ${o.scopeLabel}` }
    : { pts: o.remote ? -4 : -8, why: `only for ${o.scopeLabel}` }
  return o.kind === "SCHOLARSHIP" ? { pts: 0, why: "the listing doesn't say which nationalities can apply" } : null
}

type Crowd = { who: string; fit: (o: Scorable) => number }
const urgent = (o: Scorable) => o.daysLeft !== null && o.daysLeft >= 2 && o.daysLeft <= 7
export const PLATFORM_CROWD: Record<string, Crowd> = {
  linkedin: { who: "working professionals and graduates",
    fit: (o) => (o.level === "MID" || o.level === "SENIOR" ? 10 : o.level === "ENTRY" ? 6 : -8) + (o.primary === "DIGITAL" ? 4 : 0) + (o.kind === "SCHOLARSHIP" ? -2 : 0) },
  x: { who: "tech and news followers who act fast",
    fit: (o) => (o.remote ? 8 : 0) + (o.primary === "DIGITAL" ? 4 : 0) + (urgent(o) ? 5 : 0) + (o.funded ? 5 : 0) + (o.level === "SENIOR" ? -2 : 0) },
  facebook: { who: "a broad audience of all ages",
    fit: (o) => (o.level === "NONE" ? 10 : o.level === "ENTRY" ? 5 : o.level === "SENIOR" ? -8 : 0) + (o.primary === "PHYSICAL" ? 5 : 0) + (o.funded ? 4 : 0) },
  whatsapp: { who: "friends, family and community groups who forward things",
    fit: (o) => (o.level === "NONE" ? 10 : o.level === "ENTRY" ? 6 : o.level === "SENIOR" ? -8 : 0) + (o.funded ? 8 : o.kind === "SCHOLARSHIP" ? 4 : 0) },
  telegram: { who: "opportunity hunters who follow alert channels",
    fit: (o) => (o.kind === "SCHOLARSHIP" ? 8 : 0) + (o.funded ? 4 : 0) + (o.remote ? 6 : 0) + (urgent(o) ? 5 : 0) },
  instagram: { who: "students and young people",
    fit: (o) => (o.kind === "SCHOLARSHIP" ? 9 : 0) + (o.funded ? 5 : 0) + (o.level === "NONE" || o.level === "ENTRY" ? 8 : o.level === "SENIOR" ? -10 : 0) + (o.remote ? 3 : 0) },
  tiktok: { who: "students and first-time job seekers",
    fit: (o) => (o.kind === "SCHOLARSHIP" ? 9 : 0) + (o.funded ? 6 : 0) + (o.level === "NONE" ? 10 : o.level === "ENTRY" ? 8 : o.level === "SENIOR" ? -12 : -2) + (o.remote ? 3 : 0) },
  youtube: { who: "students searching how to study or work abroad",
    fit: (o) => (o.kind === "SCHOLARSHIP" ? 10 : 0) + (o.funded ? 6 : 0) + (o.level === "NONE" || o.level === "ENTRY" ? 6 : o.level === "SENIOR" ? -10 : 0) + (o.remote ? 4 : 0) },
}

export type Draw = { score: number; why: string[]; strong: string[]; weak: string[] }

/** How strongly this post should draw visitors when shared on these platforms. */
export function drawScore(o: Scorable, theme: string, platforms: string[]): Draw {
  const base = reachScore(o, theme)
  const why = base.why.filter((w) => w.startsWith("+")).map((w) => w.replace(/^\+\d+\s+/, ""))
  let score = base.raw
  const home = homeFit(o)
  if (home) { score += home.pts; why.unshift(home.why) }
  const fits = platforms.filter((p) => PLATFORM_CROWD[p]).map((p) => ({ p, f: PLATFORM_CROWD[p].fit(o) }))
  if (fits.length) score += fits.reduce((n, x) => n + x.f, 0) / fits.length
  return {
    // Reach, home fit and platform fit can add up to about 145; scaled so the best posts land in the 80s and 90s.
    score: Math.max(1, Math.min(99, Math.round(score * 0.68))), why,
    strong: fits.filter((x) => x.f >= 8).sort((a, b) => b.f - a.f).map((x) => x.p),
    weak: fits.filter((x) => x.f < 0).map((x) => x.p),
  }
}

/** The 3 unposted posts with the strongest draw: one per organisation, at most 2 from the same audience. */
export function maesterPick<T extends Scorable & { id: string }>(list: T[], theme: string, platforms: string[]): { o: T; draw: Draw }[] {
  const ranked = list
    .filter((o) => o.postedTo.length === 0 && (o.daysLeft === null || o.daysLeft >= 2))
    .map((o) => ({ o, draw: drawScore(o, theme, platforms) }))
    .sort((a, b) => b.draw.score - a.draw.score)
  const out: { o: T; draw: Draw }[] = []
  const orgs = new Set<string>()
  const perAudience: Record<string, number> = {}
  for (const r of ranked) {
    if (orgs.has(r.o.organization) || (perAudience[r.o.primary] ?? 0) >= 2) continue
    orgs.add(r.o.organization)
    perAudience[r.o.primary] = (perAudience[r.o.primary] ?? 0) + 1
    out.push(r)
    if (out.length === 3) break
  }
  return out
}

/** The next prime-time window among these platforms: "now" when one is open, else minutes until the soonest one opens. */
export function nextPrime(platforms: string[], at: Date): { now: string[]; next: { platform: string; inMin: number } | null } {
  const mins = at.getHours() * 60 + at.getMinutes()
  const now = platforms.filter((p) => goodNow(p, at.getHours()))
  let next: { platform: string; inMin: number } | null = null
  for (const p of platforms) for (const [a] of BEST_TIMES[p]?.windows ?? []) {
    const wait = (a * 60 - mins + 1440) % 1440
    if (wait > 0 && (!next || wait < next.inMin)) next = { platform: p, inMin: wait }
  }
  return { now, next }
}
