"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { captionLength } from "@/lib/text-length"
import { ItemEditor } from "./item-editor"
import { MusicPanel } from "./music-panel"
import { api, type MusicChoice, type OppLite, type Pic, type PlatformLite, type TrackLite } from "./types"

type Props = { opportunities: OppLite[]; platforms: PlatformLite[]; tracks: TrackLite[]; max: number }
type Captions = Record<string, Record<string, string>>

const PLATFORM_SHORT: Record<string, string> = { x: "X", facebook: "FB", linkedin: "LinkedIn", telegram: "Telegram", whatsapp: "WhatsApp", instagram: "IG", tiktok: "TikTok" }

export function Composer({ opportunities, platforms, tracks: initialTracks, max }: Props) {
  const router = useRouter()
  const [kind, setKind] = useState<"ALL" | "JOB" | "SCHOLARSHIP">("ALL")
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  // manual = make the media and open prepared tabs; auto = post through the connected APIs
  const [mode, setMode] = useState<"manual" | "auto">("manual")
  const [chosen, setChosen] = useState<string[]>(() => platforms.map((p) => p.id))
  const [defaults, setDefaults] = useState<Captions>({})
  const [captions, setCaptions] = useState<Captions>({})
  const [pics, setPics] = useState<Record<string, Pic[]>>({})
  const [tracks, setTracks] = useState(initialTracks)
  const [music, setMusic] = useState<MusicChoice>(initialTracks[0] ? { id: initialTracks[0].id, start: 0, volume: 0.8 } : null)
  const [slideSeconds, setSlideSeconds] = useState(4)
  const [toast, setToast] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")

  const byId = useMemo(() => new Map(opportunities.map((o) => [o.id, o])), [opportunities])
  const shown = opportunities.filter((o) =>
    (kind === "ALL" || o.kind === kind) &&
    (!q || `${o.title} ${o.organization} ${o.location ?? ""}`.toLowerCase().includes(q.toLowerCase())))
  const available = (p: PlatformLite) => mode === "manual" || p.usable
  const chosenPlatforms = platforms.filter((p) => chosen.includes(p.id) && available(p))
  const wantsVideo = chosenPlatforms.some((p) => p.media === "video")

  // Fetch default captions for newly selected items.
  useEffect(() => {
    const missing = selected.filter((id) => !defaults[id])
    if (!missing.length) return
    api<Captions>("/api/captions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: missing }) })
      .then((c) => {
        setDefaults((d) => ({ ...d, ...c }))
        setCaptions((d) => ({ ...c, ...d }))
      })
      .catch((e: Error) => setError(e.message))
  }, [selected, defaults])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(""), 2600)
    return () => clearTimeout(t)
  }, [toast])

  function toggle(id: string) {
    if (selected.includes(id)) return setSelected(selected.filter((s) => s !== id))
    if (selected.length >= max) return setToast(`You can post at most ${max} at once — remove one first.`)
    setSelected([...selected, id])
  }

  const problems: string[] = []
  if (!selected.length) problems.push("Select at least one job or scholarship.")
  if (!chosenPlatforms.length) problems.push("Pick at least one platform.")
  for (const id of selected) {
    for (const p of chosenPlatforms) {
      const text = captions[id]?.[p.id] ?? ""
      if (!text.trim()) problems.push(`${byId.get(id)?.title}: ${p.name} caption is empty.`)
      else if (captionLength(p.id, text) > p.captionLimit) problems.push(`${byId.get(id)?.title}: ${p.name} caption is too long.`)
    }
  }
  const ready = problems.length === 0 && selected.every((id) => captions[id])

  async function post() {
    setPosting(true); setError("")
    try {
      const { id } = await api<{ id: number }>("/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          platforms: chosenPlatforms.map((p) => p.id),
          items: selected.map((id) => ({
            opportunityId: id,
            extraUploadIds: (pics[id] ?? []).map((p) => p.id),
            captions: Object.fromEntries(chosenPlatforms.map((p) => [p.id, captions[id][p.id]])),
          })),
          music: wantsVideo ? music : null,
          slideSeconds,
        }),
      })
      router.push(`/campaigns/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setPosting(false)
    }
  }

  return (
    <div className="compose">
      <section>
        <div className="picker-tools">
          <div className="tabs" role="tablist">
            {(["ALL", "JOB", "SCHOLARSHIP"] as const).map((k) => (
              <button key={k} type="button" className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
                {k === "ALL" ? "All" : k === "JOB" ? "Jobs" : "Scholarships"}
              </button>
            ))}
          </div>
          <input type="search" placeholder="Search title, organisation, location…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="opps">
          {shown.map((o) => {
            const on = selected.includes(o.id)
            return (
              <button type="button" key={o.id} className={`opp ${on ? "on" : ""}`} onClick={() => toggle(o.id)} aria-pressed={on}>
                <span className="tick">{on ? selected.indexOf(o.id) + 1 : ""}</span>
                <span className="grow">
                  <span className="row" style={{ gap: 6 }}>
                    <span className={`badge ${o.kind === "JOB" ? "job" : "sch"}`}>{o.kind === "JOB" ? "Job" : "Scholarship"}</span>
                    {o.postedTo.length > 0 && <span className="badge ok">Posted: {o.postedTo.map((p) => PLATFORM_SHORT[p] ?? p).join(", ")}</span>}
                  </span>
                  <span className="title" style={{ display: "block", marginTop: 4 }}>{o.title}</span>
                  <span className="meta">
                    {[o.organization, o.location, o.deadline && `Deadline ${o.deadline}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            )
          })}
          {!shown.length && <div className="panel muted">Nothing matches.</div>}
        </div>
      </section>

      <aside className="side stack">
        <div className="panel stack">
          <div>
            <h2>Selected ({selected.length}/{max})</h2>
            {selected.length === 0
              ? <div className="muted small">Click jobs or scholarships on the left.</div>
              : <div className="chips">{selected.map((id) => (
                  <span className="chip" key={id}><span>{byId.get(id)?.title}</span>
                    <button type="button" aria-label="Remove" onClick={() => toggle(id)}>×</button></span>
                ))}</div>}
          </div>

          <div>
            <h2>How to post</h2>
            <div className="tabs mode-tabs" role="tablist">
              <button type="button" className={mode === "manual" ? "on" : ""} onClick={() => setMode("manual")}>Share myself</button>
              <button type="button" className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>Auto-post</button>
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>
              {mode === "manual"
                ? "Pictures, video and captions are prepared; each platform opens in a tab with the post ready — you just click Post."
                : "Posts go out through the accounts connected in Accounts, no clicks needed."}
            </div>
          </div>

          <div>
            <h2>Platforms</h2>
            {(["image", "video"] as const).map((media) => (
              <div key={media}>
                <div className="section-label">{media === "image" ? "Picture posts" : "Video posts (with music)"}</div>
                <div className="plat-grid">
                  {platforms.filter((p) => p.media === media).map((p) => (
                    <label key={p.id} className={`check ${available(p) ? "" : "disabled"}`}
                      title={available(p) ? "" : p.manualOnly ? "No posting API — use Share myself" : `Missing: ${p.missing.join(", ")}`}>
                      <input type="checkbox" disabled={!available(p)} checked={chosen.includes(p.id) && available(p)}
                        onChange={(e) => setChosen(e.target.checked ? [...chosen, p.id] : chosen.filter((c) => c !== p.id))} />
                      <span>{p.name}{!available(p) && <span className="muted small"> — {p.manualOnly ? "share myself only" : "not connected"}</span>}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {mode === "auto" && platforms.some((p) => !p.usable && !p.manualOnly) && <div className="muted small" style={{ marginTop: 6 }}>Connect the rest in <a href="/settings">Accounts</a>.</div>}
          </div>

          {wantsVideo && (
            <div>
              <h2>Background music</h2>
              <MusicPanel tracks={tracks} setTracks={setTracks} music={music} setMusic={setMusic} slideSeconds={slideSeconds} setSlideSeconds={setSlideSeconds} />
            </div>
          )}
        </div>

        {selected.map((id) => byId.get(id) && (
          <ItemEditor key={id} opp={byId.get(id)!} platforms={chosenPlatforms} captions={captions[id]} defaults={defaults[id]}
            setCaption={(p, text) => setCaptions((c) => ({ ...c, [id]: { ...c[id], [p]: text } }))}
            pics={pics[id] ?? []} setPics={(p) => setPics((all) => ({ ...all, [id]: p }))}
            wantsVideo={wantsVideo} music={music} slideSeconds={slideSeconds} onRemove={() => toggle(id)} />
        ))}

        <div className="panel stack" style={{ gap: 8 }}>
          {selected.length > 0 && problems.length > 0 && <div className="error">{problems[0]}</div>}
          {error && <div className="error">{error}</div>}
          <button type="button" className="primary big" disabled={!ready || posting} onClick={post}>
            {posting ? "Starting…" : `${mode === "manual" ? "Prepare" : "Post"} ${selected.length || ""} ${selected.length === 1 ? "item" : "items"} for ${chosenPlatforms.length} ${chosenPlatforms.length === 1 ? "platform" : "platforms"}`}
          </button>
          <div className="muted small">{mode === "manual"
            ? "Next page: one click opens every platform in its own tab with the post ready."
            : "Posts go out one after another; you can watch progress on the next page."}</div>
        </div>
      </aside>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
