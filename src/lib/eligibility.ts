// Who is allowed to apply? Read from the listing's own eligibility lines, summary and location (pure rules, usable in
// the browser). The answer is only as good as the listing text: UNKNOWN means it says nothing about nationality or place.

export type Scope = "WORLD" | "REGION" | "COUNTRY" | "UNKNOWN"
/** label = short phrase that completes "Open to: …" (empty for UNKNOWN). */
export type WhoCanApply = { scope: Scope; label: string }

type Input = {
  kind: "JOB" | "SCHOLARSHIP"; title: string; location?: string | null; workMode?: string | null
  summary?: string | null; eligibility?: string[]
}

const REGIONS: [RegExp, string][] = [
  [/\bsub-saharan\b/i, "Sub-Saharan African countries"],
  [/\bafrica(n|ns)?\b/i, "African countries"],
  [/\bcommonwealth\b/i, "Commonwealth countries"],
  [/\b(developing countr\w+|low[- ](and|or) middle[- ]income|adb borrowing|least developed)\b/i, "developing countries"],
  [/\b(asian?|asia-pacific)\b/i, "Asian countries"],
  [/\blatin america\w*\b/i, "Latin America"],
  [/\b(arab|middle east\w*|mena)\b/i, "Middle East and North Africa"],
  [/\b(council of europe|european (member states|countries))\b/i, "European countries"],
  [/\b(eu|eea|european)\b[ /-]*(union )?(citizens?|nationals?|residents?|students)\b/i, "EU / EEA countries"],
]
const WORLD = /\b([Aa]ny|[Aa]ll) nationalit\w+|\bworldwide\b|anywhere in the world|\bopen to all\b|international (students?|applicants?|candidates?|scholars?)|\bnon-?(eu|eea)\b|eu and non-eu|from (any|all) countr\w+|regardless of (nationality|citizenship)|all countries|(around|across|all over) the (world|globe)|\bglobally\b/
// "Do not hold Italian citizenship", "Not resident in Italy": a rule that shuts out locals means it is for everyone else.
const NEGATED = /\b(not|non-?|excluding|except)\b/i
const PLACE_RULE = /\b(citizens?|citizenship|nationals?|nationality|residents?|resident in|residing in|reside in|living in|passport)\b/i
const DEMONYM_GROUP = /\b[A-Z][a-z]+(ian|ean|ese|ish|i)\s+(scholars?|students?|citizens?|nationals?|youths?|undergraduates?|graduates?|universit\w+|institutions?)\b/
const ENROLLED_IN_PLACE = /\benrolled (in|at) (an? |the )?(recogni[sz]ed |eligible |accredited )?[A-Z][a-zA-Z]+/
const JOB_PLACE = /\b(?:based in|located in|residents? of|must (?:reside|live|be based|be located) in|authori[sz]ed to work in|right to work in|eligible to work in)\s+((?:the )?[A-Z][\w.-]*(?:,? (?:or |and )?[A-Z][\w.-]*){0,3})/
const OPEN_PLACE = /\b(worldwide|anywhere|global|international|emea)\b/i

// Weaker hints ("enrolled at a university outside Japan"): only used when no line limits it to a country.
const WORLD_HINT = /\boverseas\b|\boutside (of )?(the )?[A-Z][a-z]+/
const isWorld = (l: string) => WORLD.test(l) || WORLD.test(l.toLowerCase())
const clip = (s: string, n = 90) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s)

export function whoCanApply(o: Input): WhoCanApply {
  const lines = (o.eligibility ?? []).map((l) => l.trim()).filter(Boolean)
  const loc = (o.location ?? "").trim()

  if (o.kind === "SCHOLARSHIP") {
    // 1. A named region (in the title or an eligibility line) is the clearest limit.
    for (const [re, name] of REGIONS) if (re.test(o.title) || lines.some((l) => re.test(l))) return { scope: "REGION", label: name }
    // 2. The listing says it is open to everyone.
    if (lines.some(isWorld) || lines.some((l) => PLACE_RULE.test(l) && NEGATED.test(l))) return { scope: "WORLD", label: "all nationalities" }
    // 3. A line that names who may apply by country: quote it rather than guess the country.
    const limit = lines.find((l) => (PLACE_RULE.test(l) && !NEGATED.test(l)) || DEMONYM_GROUP.test(l) || (ENROLLED_IN_PLACE.test(l) && !NEGATED.test(l)))
    if (limit) return { scope: "COUNTRY", label: clip(limit) }
    if (lines.some((l) => WORLD_HINT.test(l))) return { scope: "WORLD", label: "all nationalities" }
    // 4. Only the summary speaks: trust it for "open to all" or a region, not for a country.
    const sum = o.summary ?? ""
    if (isWorld(sum)) return { scope: "WORLD", label: "all nationalities" }
    for (const [re, name] of REGIONS) if (re.test(sum)) return { scope: "REGION", label: name }
    return { scope: "UNKNOWN", label: "" }
  }

  const stated = [...lines, o.summary ?? ""].map((l) => JOB_PLACE.exec(l)?.[1]).find(Boolean)
  if (stated) return { scope: "COUNTRY", label: `people in ${stated.replace(/[.,]$/, "")}` }
  const remote = o.workMode === "REMOTE"
  if (remote && (!loc || OPEN_PLACE.test(loc) || /^remote$/i.test(loc))) return { scope: "WORLD", label: "anyone, anywhere (remote)" }
  const place = loc.replace(/^remote\b[\s,(:-]*/i, "").replace(/\)$/, "") || loc
  if (loc) return { scope: "COUNTRY", label: remote ? `remote workers: ${place}` : `people who can work in ${place}` }
  return { scope: "UNKNOWN", label: "" }
}
