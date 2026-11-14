// Ported from PathMaester lib/opportunities/public-path.ts (slugify, publicOpportunityPath, withUtm).
// Keep in step with it: the slug words are cosmetic, PathMaester looks pages up by the id after "--".

export function slugify(text: string, max = 70) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "")
}

/** "/jobs/senior-backend-engineer-irecharge--cmv32zgzk000109jprzpcucht" */
export function publicOpportunityPath(o: { id: string; kind: string; title: string; organization: string }) {
  const segment = o.kind === "SCHOLARSHIP" ? "scholarships" : "jobs"
  const words = slugify(`${o.title} ${o.organization}`) || "opportunity"
  return `/${segment}/${words}--${o.id}`
}

/** Analytics tags so PathMaester's Google Analytics shows visits per platform. */
export function withUtm(url: string, source: string, campaign = "social-maester") {
  const u = new URL(url)
  u.searchParams.set("utm_source", source)
  u.searchParams.set("utm_medium", "social")
  u.searchParams.set("utm_campaign", campaign)
  return u.toString()
}

export const pathmaesterUrl = () => process.env.PATHMAESTER_URL?.trim().replace(/\/$/, "") || null
