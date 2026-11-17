import { reachScore, type Scorable } from "./intel"

// Ready-made Top 5 digest ideas. Pure rules over the hub's data (runs in the browser): each theme picks the
// unposted opportunities with the best reach score, one per organisation.

type Item = Scorable & { id: string; title: string }

// The titles make promises, so the rules ask for evidence: an internship has to say so, a hands-on job needs
// hands-on work named in its title (a technician, a nurse, a driver…), not just an office job that isn't remote.
const HANDS_ON_TITLE = /\b(technicians?|drivers?|riders?|nurses?|nursing|midwi\w+|chefs?|cooks?|electricians?|mechanics?|mechanical|welders?|plumbers?|warehouse|cleaners?|guards?|operators?|pharmacists?|pharmacy|caregivers?|carers?|laborator\w+|installers?|maintenance|construction|site engineers?|field (engineers?|technicians?|officers?|agents?)|farm\w*|agric\w*|hospitality|waiters?|waitress\w*|baristas?|receptionists?|front desk|cashiers?|store ?keepers?|dispatch\w*|delivery|fleet|production|factory|health assistants?|teachers?|tutors?|craftsm\w+|carpenters?|painters?|tailors?)\b/i
const ENTRY_TITLE = /\b(intern(ship)?s?|trainees?|graduate|apprentice\w*|entry[- ]level|junior)\b/i

export type DigestTheme = {
  id: string
  emoji: string
  /** Audience colour for the card (see segments.ts), or URGENT. */
  audience: string
  title: (n: number) => string
  test: (o: Item) => boolean
}

export const DIGEST_THEMES: DigestTheme[] = [
  { id: "remote", emoji: "🌍", audience: "DIGITAL", title: (n) => `${n} remote jobs you can do from anywhere`,
    test: (o) => o.kind === "JOB" && o.remote && o.scope === "WORLD" },
  { id: "easy", emoji: "🚀", audience: "STARTER", title: (n) => `${n} jobs you can start without years of experience`,
    test: (o) => o.kind === "JOB" && o.level === "NONE" },
  { id: "entry", emoji: "🌱", audience: "STARTER", title: (n) => `${n} internships and graduate programmes`,
    test: (o) => o.kind === "JOB" && o.level === "ENTRY" && ENTRY_TITLE.test(o.title) },
  { id: "funded", emoji: "🎓", audience: "SCHOLARSHIP", title: (n) => `${n} fully funded scholarships`,
    test: (o) => o.kind === "SCHOLARSHIP" && o.funded },
  { id: "world-sch", emoji: "🌍", audience: "SCHOLARSHIP", title: (n) => `${n} scholarships open to all nationalities`,
    test: (o) => o.kind === "SCHOLARSHIP" && o.scope === "WORLD" },
  { id: "hands-on", emoji: "🛠", audience: "PHYSICAL", title: (n) => `${n} hands-on jobs hiring now`,
    test: (o) => o.kind === "JOB" && !o.remote && HANDS_ON_TITLE.test(o.title) },
  { id: "closing", emoji: "⏳", audience: "URGENT", title: (n) => `${n} opportunities closing this week`,
    test: (o) => o.daysLeft !== null && o.daysLeft <= 7 },
]

/** The best `n` unposted items for a theme (still open for at least 2 days), one per organisation. */
export function suggestDigest<T extends Item>(list: T[], theme: DigestTheme, day: string, n = 5): { items: T[]; matches: number } {
  const all = list.filter((o) => theme.test(o) && o.postedTo.length === 0 && (o.daysLeft === null || o.daysLeft >= 2))
  const ranked = all.map((o) => ({ o, s: reachScore(o, day).score })).sort((a, b) => b.s - a.s)
  const items: T[] = []
  const orgs = new Set<string>()
  for (const { o } of ranked) {
    if (orgs.has(o.organization)) continue
    orgs.add(o.organization)
    items.push(o)
    if (items.length === n) break
  }
  return { items, matches: all.length }
}

export const defaultDigestTitle = (n: number) => `Top ${n} opportunities this week`
