"use client"

import { useState } from "react"

export type BioItem = { id: string; kind: "JOB" | "SCHOLARSHIP"; title: string; organization: string; place: string; deadline: string | null; href: string }
export type BioGroup = { key: string; title: string | null; items: BioItem[] }

// The search matches the captions' "search “Private Cook”" wording: title, organisation or place.
export function BioList({ groups, initialQuery }: { groups: BioGroup[]; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery)
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const match = (i: BioItem) => words.every((w) => `${i.title} ${i.organization} ${i.place}`.toLowerCase().includes(w))
  const shown = groups.map((g) => ({ ...g, items: g.items.filter(match) })).filter((g) => g.items.length)

  return (
    <>
      <input className="bio-search" type="search" placeholder="Search the job or scholarship from the video…" aria-label="Search"
        value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.map((g) => (
        <section key={g.key} className={g.title ? "bio-group digest" : "bio-group"}>
          {g.title && <h2>🔥 {g.title}</h2>}
          {g.items.map((i) => (
            <a key={i.id} className={`bio-item ${i.kind === "JOB" ? "job" : "sch"}`} href={i.href} rel="noopener">
              <span className="bio-kind">{i.kind === "JOB" ? "Job" : "Scholarship"}</span>
              <b>{i.title}</b>
              <span className="muted small">{[i.organization, i.place].filter(Boolean).join(" · ")}</span>
              {i.deadline && <span className="small">⏳ Deadline {i.deadline}</span>}
              <span className="bio-apply">Apply →</span>
            </a>
          ))}
        </section>
      ))}
      {!shown.length && <p className="muted" style={{ textAlign: "center" }}>{groups.length ? "Nothing matches. Try fewer words." : "Nothing shared yet. Check back soon."}</p>}
    </>
  )
}
