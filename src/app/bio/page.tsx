import type { Metadata } from "next"
import { connection } from "next/server"
import { BioList, type BioGroup } from "@/components/bio-list"
import { formatDeadline, linkFor, placeLine } from "@/lib/caption"
import { recentlyShared } from "@/lib/campaigns"
import { getOpportunities } from "@/lib/opportunities"
import { pathmaesterUrl, withUtm } from "@/lib/pathmaester-links"

// Public "link in bio" page for TikTok, Instagram and YouTube, whose captions can't hold a tappable link.
// Lists every opportunity shared recently with a big Apply button. ?from=tiktok tags the links for analytics;
// ?q= pre-fills the search (captions say "search “Private Cook”").

const brand = () => process.env.BRAND_NAME?.trim() || "PathMaester"

export const metadata: Metadata = {
  title: `${brand()} · Apply links`,
  description: "Every job and scholarship from our videos and posts, with a link to apply.",
}

type Search = { from?: string; q?: string }

export default async function BioPage({ searchParams }: { searchParams: Promise<Search> }) {
  await connection()
  const sp = await searchParams
  const from = /^[a-z]{2,20}$/.test(sp.from ?? "") ? sp.from! : "bio"
  const shared = recentlyShared()
  const found = await getOpportunities([...new Set(shared.flatMap((g) => g.ids))]).catch(() => new Map())
  const today = new Date().toISOString().slice(0, 10)

  const groups: BioGroup[] = shared.map((g) => ({
    key: String(g.campaignId),
    title: g.kind === "digest" ? g.title : null,
    items: g.ids.map((id) => found.get(id)).filter((o) => !!o && (!o.deadline || o.deadline.slice(0, 10) >= today)).map((o) => ({
      id: o.id, kind: o.kind, title: o.title, organization: o.organization, place: placeLine(o),
      deadline: o.deadline ? formatDeadline(o.deadline) : null, href: linkFor(o, from) ?? "#",
    })),
  })).filter((g) => g.items.length > 0)

  const pm = pathmaesterUrl()
  return (
    <div className="bio-page">
      <header className="bio-head">
        <span className="brand-mark big" aria-hidden="true" />
        <h1>{brand()}</h1>
        <p className="muted">Jobs and scholarships from our posts. Tap one to apply.</p>
      </header>
      <BioList groups={groups} initialQuery={sp.q ?? ""} />
      {pm && (
        <div className="bio-more">
          <a className="btn" href={withUtm(`${pm}/jobs`, from)}>All jobs</a>
          <a className="btn" href={withUtm(`${pm}/scholarships`, from)}>All scholarships</a>
        </div>
      )}
    </div>
  )
}
