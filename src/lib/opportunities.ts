import { all, get } from "./db"
import { pathmaesterConfigured, readOnly } from "./pathmaester-db"

// The only file that reads jobs/scholarships. With PATHMAESTER_DATABASE_URL set they come from PathMaester's
// public.opportunities (read-only); otherwise from the local SQLite sample table (same column names).
// "Public" follows PathMaester's own rule (lib/data/public-opportunities.ts): visibility PUBLIC, not deleted,
// and for the list, still open (no deadline or a deadline today or later).

export type Kind = "JOB" | "SCHOLARSHIP"

export type Opportunity = {
  id: string
  kind: Kind
  title: string
  organization: string
  location: string | null
  workMode: string
  employmentType: string | null
  category: string | null
  salaryText: string | null
  awardAmount: string | null
  deadline: string | null
  postedAt: string | null
  summary: string | null
  eligibility: string[]
  tags: string[]
  applyUrl: string | null
}

export const opportunitySource = () => (pathmaesterConfigured() ? "pathmaester" : "sample") as "pathmaester" | "sample"

type Row = {
  id: string; kind: Kind; title: string; organization: string; location: string | null; work_mode: string
  employment_type: string | null; category: string | null; salary_text: string | null; award_amount: string | null
  deadline: string | Date | null; posted_at: string | Date | null; summary: string | null
  eligibility: string | string[]; tags: string | string[]; apply_url: string | null
}

const iso = (d: string | Date | null) => (d instanceof Date ? d.toISOString() : d)
const arr = (v: string | string[] | null) => (Array.isArray(v) ? v : v ? (JSON.parse(v) as string[]) : [])

const toOpp = (r: Row): Opportunity => ({
  id: r.id, kind: r.kind, title: r.title, organization: r.organization, location: r.location,
  workMode: r.work_mode, employmentType: r.employment_type, category: r.category, salaryText: r.salary_text,
  awardAmount: r.award_amount, deadline: iso(r.deadline), postedAt: iso(r.posted_at), summary: r.summary,
  eligibility: arr(r.eligibility), tags: arr(r.tags), applyUrl: r.apply_url,
})

const PG_COLUMNS = `id, kind::text AS kind, title, organization, location, work_mode::text AS work_mode, employment_type,
  category, salary_text, award_amount, deadline, posted_at, summary, eligibility, tags, apply_url`

export async function listOpportunities(opts: { kind?: Kind; q?: string } = {}): Promise<Opportunity[]> {
  if (pathmaesterConfigured()) {
    const where = ["visibility = 'PUBLIC'", "del_flg = 'N'", "(deadline IS NULL OR deadline >= date_trunc('day', now()))"]
    const params: string[] = []
    if (opts.kind) { params.push(opts.kind); where.push(`kind::text = $${params.length}`) }
    if (opts.q) {
      params.push(`%${opts.q}%`)
      where.push(`(title ILIKE $${params.length} OR organization ILIKE $${params.length} OR location ILIKE $${params.length})`)
    }
    const rows = await readOnly<Row>(
      `SELECT ${PG_COLUMNS} FROM public.opportunities WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT 1500`, params)
    return rows.map(toOpp)
  }

  const where = ["visibility = 'PUBLIC'", "del_flg = 'N'"]
  const params: string[] = []
  if (opts.kind) { where.push("kind = ?"); params.push(opts.kind) }
  if (opts.q) {
    where.push("(title LIKE ? OR organization LIKE ? OR location LIKE ?)")
    const like = `%${opts.q}%`
    params.push(like, like, like)
  }
  return all<Row>(
    `SELECT * FROM opportunities WHERE ${where.join(" AND ")} ORDER BY COALESCE(posted_at, created_at) DESC LIMIT 200`,
    ...params,
  ).map(toOpp)
}

/** One public opportunity, open or not (a campaign may outlive the deadline). */
export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  if (pathmaesterConfigured()) {
    const rows = await readOnly<Row>(
      `SELECT ${PG_COLUMNS} FROM public.opportunities WHERE id = $1 AND visibility = 'PUBLIC' AND del_flg = 'N'`, [id])
    return rows[0] && toOpp(rows[0])
  }
  const r = get<Row>("SELECT * FROM opportunities WHERE id = ? AND del_flg = 'N'", id)
  return r && toOpp(r)
}

export async function getOpportunities(ids: string[]): Promise<Map<string, Opportunity>> {
  const list = await Promise.all(ids.map((id) => getOpportunity(id)))
  return new Map(list.filter((o): o is Opportunity => !!o).map((o) => [o.id, o]))
}
