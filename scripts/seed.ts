// Sample jobs/scholarships for local testing: `pnpm seed`. Safe to re-run (upserts by id).
import { db } from "../src/lib/db"

const in_ = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)
const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString()

const rows = [
  { id: "seed-job-1", kind: "JOB", title: "Junior Backend Developer (Node.js)", organization: "Paystack", location: "Lagos, Nigeria", work_mode: "HYBRID", employment_type: "Full-time", category: "Engineering", salary_text: "₦450,000 – ₦700,000 / month", deadline: in_(14), posted_at: ago(1), summary: "Build and maintain payment APIs used by thousands of African businesses.", tags: ["nodejs", "backend", "fintech"], apply_url: "https://example.com/jobs/paystack-backend" },
  { id: "seed-job-2", kind: "JOB", title: "Data Analyst", organization: "Flutterwave", location: "Remote (Africa)", work_mode: "REMOTE", employment_type: "Full-time", category: "Data", salary_text: "$1,500 – $2,200 / month", deadline: in_(10), posted_at: ago(2), summary: "Turn transaction data into insights for product and risk teams.", tags: ["data", "sql", "remote"], apply_url: "https://example.com/jobs/flutterwave-analyst" },
  { id: "seed-job-3", kind: "JOB", title: "Graduate Trainee Programme 2027", organization: "Access Bank", location: "Abuja, Nigeria", work_mode: "ONSITE", employment_type: "Graduate programme", category: "Banking", salary_text: null, deadline: in_(21), posted_at: ago(3), summary: "12-month rotational programme for recent graduates across banking operations.", tags: ["graduate", "banking"], apply_url: "https://example.com/jobs/access-graduate" },
  { id: "seed-job-4", kind: "JOB", title: "Product Designer (UI/UX)", organization: "Moniepoint", location: "Remote", work_mode: "REMOTE", employment_type: "Contract", category: "Design", salary_text: "$2,000 / month", deadline: null, posted_at: ago(4), summary: "Design simple banking experiences for small businesses.", tags: ["design", "figma"], apply_url: "https://example.com/jobs/moniepoint-design" },
  { id: "seed-sch-1", kind: "SCHOLARSHIP", title: "Chevening Scholarship 2027/28", organization: "UK Government (FCDO)", location: "United Kingdom", work_mode: "UNKNOWN", employment_type: null, category: "Masters", award_amount: "Fully funded (tuition, stipend, flights)", deadline: in_(30), posted_at: ago(1), summary: "One-year master's degree at any UK university for future leaders.", eligibility: ["Bachelor's degree", "2 years work experience", "Return home for 2 years after"], tags: ["masters", "uk", "fully-funded"], apply_url: "https://example.com/scholarships/chevening" },
  { id: "seed-sch-2", kind: "SCHOLARSHIP", title: "Mastercard Foundation Scholars Program", organization: "University of Edinburgh", location: "Edinburgh, UK", work_mode: "UNKNOWN", employment_type: null, category: "Masters", award_amount: "Full tuition + living costs", deadline: in_(25), posted_at: ago(2), summary: "Scholarships for talented African students with a commitment to giving back.", eligibility: ["Citizen of an African country", "Financial need"], tags: ["africa", "masters"], apply_url: "https://example.com/scholarships/mastercard-edinburgh" },
  { id: "seed-sch-3", kind: "SCHOLARSHIP", title: "DAAD EPOS Development-Related Postgraduate Courses", organization: "DAAD", location: "Germany", work_mode: "UNKNOWN", employment_type: null, category: "Masters / PhD", award_amount: "€992/month + insurance + travel", deadline: in_(45), posted_at: ago(5), summary: "Postgraduate courses in Germany for professionals from developing countries.", eligibility: ["2 years professional experience", "Degree not older than 6 years"], tags: ["germany", "daad"], apply_url: "https://example.com/scholarships/daad-epos" },
]

const d = db()
const stmt = d.prepare(`INSERT INTO opportunities (id, kind, title, organization, location, work_mode, employment_type, category,
  salary_text, award_amount, deadline, posted_at, summary, eligibility, tags, apply_url)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title, deadline=excluded.deadline, posted_at=excluded.posted_at`)
for (const r of rows) {
  stmt.run(r.id, r.kind, r.title, r.organization, r.location, r.work_mode, r.employment_type, r.category,
    r.salary_text ?? null, (r as { award_amount?: string }).award_amount ?? null, r.deadline, r.posted_at, r.summary,
    JSON.stringify((r as { eligibility?: string[] }).eligibility ?? []), JSON.stringify(r.tags), r.apply_url)
}
console.log(`Seeded ${rows.length} opportunities.`)
