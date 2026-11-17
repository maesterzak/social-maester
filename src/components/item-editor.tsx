"use client"

import { useState } from "react"
import { hookLines } from "@/lib/intel"
import { captionLength } from "@/lib/text-length"
import { api, type MusicChoice, type OppLite, type Pic, type PlatformLite } from "./types"

type Props = {
  opp: OppLite
  platforms: PlatformLite[]
  captions: Record<string, string> | undefined
  defaults: Record<string, string> | undefined
  setCaption: (platform: string, text: string) => void
  pics: Pic[]
  setPics: (p: Pic[]) => void
  wantsVideo: boolean
  music: MusicChoice
  slideSeconds: number
  onRemove: () => void
  /** Controlled platform tab (the phone preview follows it); falls back to its own state. */
  tab?: string
  onTab?: (platform: string) => void
  /** Hide the picture header (the phone preview already shows it). */
  compact?: boolean
}

// One selected job/scholarship: its card, extra pictures for the video, and a caption per platform.
export function ItemEditor({ opp, platforms, captions, defaults, setCaption, pics, setPics, wantsVideo, music, slideSeconds, onRemove, tab: tabProp, onTab, compact }: Props) {
  const [ownTab, setOwnTab] = useState(platforms[0]?.id)
  const tab = tabProp ?? ownTab
  const setTab = (p: string) => { setOwnTab(p); onTab?.(p) }
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const [hook, setHook] = useState(0)
  const hooks = hookLines(opp)

  // Swaps the opening line on every platform's caption; the cycle ends back at the original line.
  function nextHook() {
    if (!captions || !defaults) return
    const n = (hook + 1) % (hooks.length + 1)
    for (const p of platforms) {
      const lines = (captions[p.id] ?? "").split("\n")
      lines[0] = n === 0 ? defaults[p.id].split("\n")[0] : hooks[n - 1]
      setCaption(p.id, lines.join("\n"))
    }
    setHook(n)
  }

  const active = platforms.find((p) => p.id === tab) ?? platforms[0]

  async function addPic(files: FileList) {
    setBusy("upload"); setError("")
    try {
      const added: Pic[] = []
      for (const f of Array.from(files).slice(0, 8 - pics.length)) {
        const form = new FormData()
        form.append("file", f)
        added.push(await api<Pic>("/api/uploads", { method: "POST", body: form }))
      }
      setPics([...pics, ...added])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }

  async function renderPreview() {
    setBusy("preview"); setError(""); setPreview(null)
    try {
      const r = await api<{ url: string }>("/api/preview-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opp.id, extraUploadIds: pics.map((p) => p.id), music, slideSeconds }),
      })
      setPreview(r.url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy("")
    }
  }

  return (
    <div className={`item a-${opp.primary}`}>
      <div className="item-head">
        {!compact && <a href={`/api/card/${opp.id}`} target="_blank" rel="noreferrer" title="Open full-size picture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="thumb" src={`/api/card/${opp.id}`} alt={`Post picture for ${opp.title}`} />
        </a>}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className={`badge ${opp.kind === "JOB" ? "job" : "sch"}`}>{opp.kind === "JOB" ? "Job" : "Scholarship"}</span>
            <button type="button" className="link small" onClick={onRemove}>Remove</button>
          </div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{opp.title}</div>
          <div className="muted small">{opp.organization}</div>

          {wantsVideo && (
            <>
              <div className="section-label" style={{ marginTop: 10 }}>Video pictures</div>
              <div className="muted small">The vertical card comes first; add more pictures to make a slideshow.</div>
              <div className="thumbs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="pic"><img src={`/api/card/${opp.id}?format=story`} alt="Vertical card" /></div>
                {pics.map((p) => (
                  <div className="pic" key={p.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.name} />
                    <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPics(pics.filter((x) => x.id !== p.id))}>×</button>
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <label className="btn file-btn small">
                  {busy === "upload" ? "Uploading…" : "Add pictures"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={!!busy || pics.length >= 8}
                    onChange={(e) => { const f = e.target.files; if (f?.length) void addPic(f); e.target.value = "" }} />
                </label>
                <button type="button" className="small" disabled={!!busy} onClick={renderPreview}>
                  {busy === "preview" ? "Making video…" : "Preview video"}
                </button>
              </div>
              {preview && <video className="preview" src={preview} controls autoPlay />}
            </>
          )}
          {error && <div className="error" style={{ marginTop: 6 }}>{error}</div>}
        </div>
      </div>

      {active && captions && (
        <>
          <div className="ptabs" role="tablist">
            {platforms.map((p) => {
              const over = captionLength(p.id, captions[p.id] ?? "") > p.captionLimit
              return (
                <button type="button" role="tab" aria-selected={p.id === active.id} key={p.id}
                  className={`${p.id === active.id ? "on" : ""} ${over ? "over" : ""}`} onClick={() => setTab(p.id)}>
                  {p.name}{over ? " !" : ""}
                </button>
              )
            })}
          </div>
          <textarea aria-label={`${active.name} caption`} value={captions[active.id] ?? ""} onChange={(e) => setCaption(active.id, e.target.value)} />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="row" style={{ gap: 12 }}>
              <button type="button" className="small" title="Try a different opening line on every platform" onClick={nextHook}>✦ New opening line</button>
              <button type="button" className="link small" disabled={captions[active.id] === defaults?.[active.id]}
                onClick={() => { if (defaults) setCaption(active.id, defaults[active.id]); setHook(0) }}>Reset caption</button>
            </span>
            <CaptionCounter platform={active} text={captions[active.id] ?? ""} />
          </div>
        </>
      )}
      {!captions && <div className="muted small" style={{ marginTop: 10 }}>Writing captions…</div>}
    </div>
  )
}

function CaptionCounter({ platform, text }: { platform: PlatformLite; text: string }) {
  const n = captionLength(platform.id, text)
  return <span className={`counter ${n > platform.captionLimit ? "over" : ""}`}>{n} / {platform.captionLimit}</span>
}
