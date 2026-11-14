import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { appUrl } from "@/lib/connections"
import { formatDeadline, moneyLine } from "@/lib/caption"
import { getOpportunity } from "@/lib/opportunities"

// Public page that shared links point to. Its preview tags make X, Facebook, LinkedIn, WhatsApp and
// Telegram show the post picture under the link (once the app is hosted, so their crawlers can reach it).

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = await getOpportunity((await params).id)
  if (!o) return {}
  const title = `${o.kind === "SCHOLARSHIP" ? "Scholarship" : "Job"}: ${o.title} — ${o.organization}`
  const description = [o.location, moneyLine(o), o.deadline && `Deadline ${formatDeadline(o.deadline)}`].filter(Boolean).join(" · ")
  const image = `${appUrl()}/api/card/${o.id}`
  return {
    title, description,
    openGraph: { title, description, images: [{ url: image, width: 1080, height: 1350 }], type: "article" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  }
}

export default async function SharePage({ params }: Props) {
  await connection()
  const o = await getOpportunity((await params).id)
  if (!o) notFound()
  return (
    <div className="share-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/card/${o.id}`} alt={o.title} />
      <div className="stack" style={{ gap: 10 }}>
        <span className={`badge ${o.kind === "JOB" ? "job" : "sch"}`}>{o.kind === "JOB" ? "Job" : "Scholarship"}</span>
        <h1>{o.title}</h1>
        <div className="muted">{o.organization}</div>
        {o.summary && <p style={{ margin: 0 }}>{o.summary}</p>}
        {o.eligibility.length > 0 && <ul style={{ margin: 0 }}>{o.eligibility.map((e) => <li key={e}>{e}</li>)}</ul>}
        {o.applyUrl
          ? <a className="btn primary-link" href={o.applyUrl} rel="noopener">Apply now</a>
          : <div className="muted">See the organisation&apos;s website to apply.</div>}
      </div>
    </div>
  )
}
