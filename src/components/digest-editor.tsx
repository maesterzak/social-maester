"use client"

import { useState } from "react"
import { captionLength } from "@/lib/text-length"
import { api, type MusicChoice, type OppLite, type PlatformLite } from "./types"

type Props = {
  items: OppLite[]
  title: string
  platforms: PlatformLite[]
  captions: Record<string, string>
  defaults: Record<string, string>
  setCaption: (platform: string, text: string) => void
  tab: string | undefined
  onTab: (platform: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onRemove: (id: string) => void
  wantsVideo: boolean
  music: MusicChoice
  slideSeconds: number
}

// The digest in Craft: its order (which is the order on the picture and in the captions), one caption per
// platform, and a preview of the video (cover slide, then one slide per opportunity).
export function DigestEditor({ items, title, platforms, captions, defaults, setCaption, tab, onTab, onMove, onRemove, wantsVideo, music, slideSeconds }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const active = platforms.find((p) => p.id === tab) ?? platforms[0]

  async function renderPreview() {
    setBusy(true); setError(""); setPreview(null)
    try {
      const r = await api<{ url: string }>("/api/preview-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest: { ids: items.map((o) => o.id), title }, music, slideSeconds }),
      })
      setPreview(r.url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="item digest-editor">
      <div className="section-label" style={{ marginTop: 0 }}>Running order</div>
      <ol className="digest-order">
        {items.map((o, i) => (
          <li key={o.id} className={`a-${o.primary}`}>
            <span className="craft-n">{i + 1}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <b>{o.title}</b>
              <span className="muted small">{o.organization}{o.deadline ? ` · ${o.deadline}` : ""}</span>
            </span>
            <button type="button" className="small" disabled={i === 0} aria-label={`Move ${o.title} up`} onClick={() => onMove(o.id, -1)}>↑</button>
            <button type="button" className="small" disabled={i === items.length - 1} aria-label={`Move ${o.title} down`} onClick={() => onMove(o.id, 1)}>↓</button>
            <button type="button" className="small danger" aria-label={`Remove ${o.title}`} onClick={() => onRemove(o.id)}>×</button>
          </li>
        ))}
      </ol>
      {items.length < 2 && <div className="error">A digest needs at least 2. Go back to Scout to add more.</div>}

      {wantsVideo && (
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="small" disabled={busy || items.length < 2} onClick={renderPreview}>
            {busy ? "Making video…" : "Preview digest video"}
          </button>
          <span className="muted small">Cover, then one slide each ({items.length + 1} slides, about {(items.length + 1) * slideSeconds}s)</span>
        </div>
      )}
      {preview && <video className="preview" src={preview} controls autoPlay />}
      {error && <div className="error" style={{ marginTop: 6 }}>{error}</div>}

      {active && Object.keys(captions).length > 0 ? (
        <>
          <div className="ptabs" role="tablist">
            {platforms.map((p) => {
              const over = captionLength(p.id, captions[p.id] ?? "") > p.captionLimit
              return (
                <button type="button" role="tab" aria-selected={p.id === active.id} key={p.id}
                  className={`${p.id === active.id ? "on" : ""} ${over ? "over" : ""}`} onClick={() => onTab(p.id)}>
                  {p.name}{over ? " !" : ""}
                </button>
              )
            })}
          </div>
          <textarea aria-label={`${active.name} digest caption`} value={captions[active.id] ?? ""} onChange={(e) => setCaption(active.id, e.target.value)} />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button type="button" className="link small" disabled={captions[active.id] === defaults[active.id]}
              onClick={() => setCaption(active.id, defaults[active.id])}>Reset caption</button>
            <span className={`counter ${captionLength(active.id, captions[active.id] ?? "") > active.captionLimit ? "over" : ""}`}>
              {captionLength(active.id, captions[active.id] ?? "")} / {active.captionLimit}
            </span>
          </div>
        </>
      ) : <div className="muted small" style={{ marginTop: 10 }}>{items.length < 2 ? "" : "Writing captions…"}</div>}
    </div>
  )
}
