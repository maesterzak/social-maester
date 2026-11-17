"use client"

import { useEffect, useState } from "react"
import type { campaignDetail } from "@/lib/campaigns"
import { ShareKit } from "./share-kit"
import { api } from "./types"

type Detail = NonNullable<Awaited<ReturnType<typeof campaignDetail>>>
const ACTIVE = new Set(["queued", "running"])
const LABEL: Record<string, string> = { queued: "waiting", rendering: "making media", posting: "posting", ready: "ready to share", done: "sent", failed: "failed" }

// Live progress of one campaign; polls while anything is still queued or running.
export function CampaignView({ initial, names }: { initial: Detail; names: Record<string, string> }) {
  const [d, setD] = useState(initial)
  const [error, setError] = useState("")
  const active = ACTIVE.has(d.campaign.status) || d.posts.some((p) => ["queued", "rendering", "posting"].includes(p.status))

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => { api<Detail>(`/api/campaigns/${d.campaign.id}`).then(setD).catch(() => {}) }, 1500)
    return () => clearInterval(t)
  }, [active, d.campaign.id])

  async function retry(postId: number) {
    setError("")
    try {
      await api(`/api/posts/${postId}/retry`, { method: "POST" })
      setD(await api<Detail>(`/api/campaigns/${d.campaign.id}`))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const reload = async () => setD(await api<Detail>(`/api/campaigns/${d.campaign.id}`))
  const manual = d.campaign.mode === "manual"
  const digest = d.campaign.kind === "digest"
  // A digest is one post (on its first item) listing every opportunity.
  const items = digest ? d.items.slice(0, 1) : d.items
  const done = d.posts.filter((p) => p.status === "done").length
  return (
    <>
      <div className="page-head row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>{digest ? "🔥 Digest" : "Campaign"} #{d.campaign.id} <span className={`badge ${d.campaign.status}`}>{LABEL[d.campaign.status] ?? d.campaign.status}</span></h1>
          <div className="muted small">
            {new Date(d.campaign.created_at).toLocaleString("en-GB")} · {manual ? "share myself" : "auto-post"} · {done}/{d.posts.length} {manual ? "shared" : "sent"}
            {d.track && <> · music: {d.track.name}</>}
          </div>
        </div>
        <a className="btn" href="/">New post</a>
      </div>
      {error && <div className="banner">{error}</div>}

      <div className="stack">
        {items.map((item) => {
          const posts = d.posts.filter((p) => p.item_id === item.id)
          return (
            <div className="panel campaign-item" key={item.id}>
              <div className="stack" style={{ gap: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item.image_file && <img src={`/api/files/${item.image_file}`} alt="Feed picture" />}
                {item.video_file && <video src={`/api/files/${item.video_file}`} controls preload="metadata" />}
                {!item.image_file && !item.video_file && <div className="muted small">Media not made yet…</div>}
              </div>
              <div style={{ minWidth: 0 }}>
                <h2>{item.title}</h2>
                {digest && <ol className="digest-list small">{d.digestTitles.map((t, i) => <li key={i}>{t}</li>)}</ol>}
                {manual && !item.error && <ShareKit item={item} posts={posts} names={names} reload={reload} />}
                {item.error && <div className="error">{item.error}</div>}
                {(!manual || item.error) && <table>
                  <tbody>
                    {posts.map((p) => (
                      <tr key={p.id}>
                        <td style={{ width: 150 }}><b>{names[p.platform] ?? p.platform}</b></td>
                        <td>
                          <span className={`badge ${p.status}`}>{LABEL[p.status] ?? p.status}</span>
                          {p.dry_run ? <span className="badge" style={{ marginLeft: 6 }}>dry run</span> : null}
                          {p.url && <> · <a href={p.url} target="_blank" rel="noreferrer">View post</a></>}
                          {p.error && <div className="error" style={{ marginTop: 4, wordBreak: "break-word" }}>{p.error}</div>}
                          <details>
                            <summary className="muted small" style={{ cursor: "pointer", marginTop: 4 }}>Caption</summary>
                            <pre className="caption">{p.caption}</pre>
                          </details>
                        </td>
                        <td style={{ width: 80, textAlign: "right" }}>
                          {p.status === "failed" && <button type="button" className="small" onClick={() => retry(p.id)}>Retry</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
