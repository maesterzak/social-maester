"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { captionLength } from "@/lib/text-length"
import { Deck } from "./deck"
import { DigestEditor } from "./digest-editor"
import { ItemEditor } from "./item-editor"
import { PhonePreview } from "./phone-preview"
import { MusicPanel } from "./music-panel"
import { pickTrack } from "@/lib/catalog"
import { ASK_EXAMPLES, BEST_TIMES, PLATFORM_CROWD, goodNow, maesterPick, nextPrime, parseIntent, reachScore } from "@/lib/intel"
import type { Mission } from "@/lib/mission"
import { DIGEST_THEMES, defaultDigestTitle, suggestDigest, type DigestTheme } from "@/lib/digest-themes"
import { AUDIENCES, WEEK_THEMES, audienceInfo, type Audience } from "@/lib/segments"
import { api, type MusicChoice, type OppLite, type Pic, type PlatformLite, type TrackLite } from "./types"

type Props = { opportunities: OppLite[]; platforms: PlatformLite[]; tracks: TrackLite[]; max: number; digestMax: number; weekday: number; mission: Mission; brand: string }
type Captions = Record<string, Record<string, string>>

const PLATFORM_SHORT: Record<string, string> = { x: "X", facebook: "FB", linkedin: "LinkedIn", telegram: "Telegram", whatsapp: "WhatsApp", instagram: "IG", tiktok: "TikTok", youtube: "YouTube" }

const PAGE = 150

type Sub = "" | "REMOTE" | "NOSKILL" | "FUNDED" | "UNDERGRAD" | "MASTERS" | "PHD"
// Finer filters that only make sense inside one audience.
const SUBS: Record<string, [Sub, string][]> = {
  DIGITAL: [["REMOTE", "Remote only"]],
  STARTER: [["NOSKILL", "Easy entry (no special skill)"], ["REMOTE", "Remote only"]],
  SCHOLARSHIP: [["FUNDED", "Fully funded"], ["UNDERGRAD", "Undergraduate"], ["MASTERS", "Masters"], ["PHD", "PhD"]],
}
const subMatch = (o: OppLite, s: Sub) =>
  !s || (s === "REMOTE" ? o.remote : s === "NOSKILL" ? o.level === "NONE" : s === "FUNDED" ? o.funded : o.study.includes(s))

/** Up to 3 unposted items for one audience: closing-soon first, then newest, one per organisation. */
function smartSet(list: OppLite[], test: (o: OppLite) => boolean, prefer?: (o: OppLite) => boolean): OppLite[] {
  const rank = (o: OppLite) => (prefer?.(o) ? 0 : 100) + (o.daysLeft !== null && o.daysLeft <= 14 ? o.daysLeft : 50)
  const sorted = list
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => test(o) && o.postedTo.length === 0 && (o.daysLeft === null || o.daysLeft >= 2))
    .sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i)
  const out: OppLite[] = []
  const orgs = new Set<string>()
  for (const { o } of sorted) {
    if (orgs.has(o.organization)) continue
    orgs.add(o.organization)
    out.push(o)
    if (out.length === 3) break
  }
  return out
}

const fmtWait = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

export function Composer({ opportunities, platforms, tracks: initialTracks, max, digestMax, weekday, mission, brand }: Props) {
  const router = useRouter()
  const [aud, setAud] = useState<"ALL" | Audience>("ALL")
  const [sub, setSub] = useState<Sub>("")
  const [fresh, setFresh] = useState(false)
  const [soon, setSoon] = useState(false)
  const [world, setWorld] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [rank, setRank] = useState<"smart" | "new">("smart")
  // Two acts: scout (choose up to 3) then craft (platforms, music, captions, live phone preview).
  const [stage, setStage] = useState<"scout" | "craft">("scout")
  const [view, setView] = useState<"deck" | "list">("deck")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pv, setPv] = useState<string | null>(null)
  // single = up to 3, one post each; digest = one "Top 5" post listing up to 5.
  const [format, setFormat] = useState<"single" | "digest">("single")
  const [digestTheme, setDigestTheme] = useState<string | null>(null)
  const [digestTitle, setDigestTitle] = useState("")
  const [titleTouched, setTitleTouched] = useState(false)
  const [dCaps, setDCaps] = useState<Record<string, string>>({})
  const [dDefaults, setDDefaults] = useState<Record<string, string>>({})
  const dDefaultsRef = useRef<Record<string, string>>({})
  // Set after mount (and every minute) so the server and the browser never disagree about the time.
  const [clock, setClock] = useState<Date | null>(null)
  useEffect(() => {
    setClock(new Date())
    const t = setInterval(() => setClock(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const hour = clock?.getHours() ?? null
  // Music follows the audience of the selection until the user picks a track themselves.
  const [musicTouched, setMusicTouched] = useState(false)
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
  const theme = WEEK_THEMES[weekday] ?? "DIGITAL"
  // The ask bar is read as a request: words it understands become filters, the rest is matched as text.
  const intent = useMemo(() => parseIntent(q), [q])
  const effAud = intent.aud ?? aud
  const effSub = (intent.sub || sub) as Sub
  const scores = useMemo(() => new Map(opportunities.map((o) => [o.id, reachScore(o, theme)])), [opportunities, theme])
  const words = intent.text.split(" ").filter(Boolean)
  const matches = (useTime: boolean) => opportunities.filter((o) => {
    if (effAud !== "ALL" && !o.audiences.includes(effAud)) return false
    if (!subMatch(o, effSub) || (intent.remote && !o.remote)) return false
    if ((world || intent.world) && o.scope !== "WORLD") return false
    if ((fresh || (useTime && intent.fresh)) && o.postedTo.length > 0) return false
    if ((soon || (useTime && intent.soon)) && !(o.daysLeft !== null && o.daysLeft <= 7)) return false
    if (!words.length) return true
    const hay = `${o.title} ${o.organization} ${o.location ?? ""}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  const exact = matches(true)
  // Nothing fits the whole request: drop the timing words ("closing this week", "not posted") and say so.
  const relaxed = exact.length === 0 && (intent.soon || intent.fresh)
  const filtered = relaxed ? matches(false) : exact
  const shown = rank === "smart" ? [...filtered].sort((a, b) => scores.get(b.id)!.score - scores.get(a.id)!.score) : filtered
  const stats = useMemo(() => Object.fromEntries(AUDIENCES.map((a) => {
    const all = opportunities.filter((o) => o.audiences.includes(a.id))
    return [a.id, { total: all.length, fresh: all.filter((o) => o.postedTo.length === 0).length }]
  })), [opportunities])
  const sets = useMemo(() => ({
    DIGITAL: smartSet(opportunities, (o) => o.audiences.includes("DIGITAL"), (o) => o.remote),
    PHYSICAL: smartSet(opportunities, (o) => o.audiences.includes("PHYSICAL")),
    STARTER: smartSet(opportunities, (o) => o.audiences.includes("STARTER"), (o) => o.level === "NONE"),
    SCHOLARSHIP: smartSet(opportunities, (o) => o.audiences.includes("SCHOLARSHIP"), (o) => o.funded),
  }) as Record<Audience, OppLite[]>, [opportunities])
  const lastChance = useMemo(() => opportunities
    .filter((o) => o.postedTo.length === 0 && o.daysLeft !== null && o.daysLeft >= 1 && o.daysLeft <= 7)
    .sort((a, b) => a.daysLeft! - b.daysLeft!).slice(0, 3), [opportunities])
  const isDigest = format === "digest"
  const cap = isDigest ? digestMax : max
  function applySet(items: OppLite[], audience: "ALL" | Audience) {
    setSelected(items.slice(0, cap).map((o) => o.id))
    pickAudience(audience)
  }
  function pickAudience(a: "ALL" | Audience) { setAud(a); setSub(""); setLimit(PAGE); if (intent.understood.length) setQ("") }

  const order = [theme, ...AUDIENCES.map((a) => a.id).filter((a) => a !== theme)]
  const underserved = order.reduce((best, a) => ((mission.byAudience[a] ?? 0) < (mission.byAudience[best] ?? 0) ? a : best), order[0]) as Audience

  const available = (p: PlatformLite) => mode === "manual" || p.usable
  const chosenPlatforms = platforms.filter((p) => chosen.includes(p.id) && available(p))
  const wantsVideo = chosenPlatforms.some((p) => p.media === "video")

  // Maester's pick: the 3 posts most likely to bring visitors, judged for the platforms that are ticked.
  const chosenIds = chosenPlatforms.map((p) => p.id).join(",")
  const pick = useMemo(() => maesterPick(opportunities, theme, chosenIds ? chosenIds.split(",") : []), [opportunities, theme, chosenIds])
  const pickIds = pick.map((x) => x.o.id)
  const pickSelected = pickIds.length > 0 && pickIds.length === selected.length && pickIds.every((id) => selected.includes(id))
  // Pre-selected once when the page opens, so a good post is always one click away.
  const [autoPicked, setAutoPicked] = useState(false)
  useEffect(() => {
    if (autoPicked || !pickIds.length) return
    setAutoPicked(true)
    setSelected((s) => (s.length ? s : pickIds.slice(0, max)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPicked, pickIds.join(",")])

  // Fetch default captions for newly selected items (single posts; a digest has its own captions).
  useEffect(() => {
    if (format === "digest") return
    const missing = selected.filter((id) => !defaults[id])
    if (!missing.length) return
    api<Captions>("/api/captions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: missing }) })
      .then((c) => {
        setDefaults((d) => ({ ...d, ...c }))
        setCaptions((d) => ({ ...c, ...d }))
      })
      .catch((e: Error) => setError(e.message))
  }, [selected, defaults, format])

  const selectedAudiences = selected.map((id) => byId.get(id)?.primary ?? "").join(",")
  useEffect(() => {
    if (musicTouched || !selectedAudiences || !tracks.length) return
    const t = pickTrack(tracks, selectedAudiences.split(","))
    if (t) setMusic((m) => (m?.id === t.id ? m : { id: t.id, start: 0, volume: m?.volume ?? 0.8 }))
  }, [selectedAudiences, musicTouched, tracks])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(""), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // ---------- digest ----------
  const ideas = useMemo(() => DIGEST_THEMES
    .map((t) => ({ t, ...suggestDigest(opportunities, t, theme, digestMax) }))
    .filter((x) => x.items.length >= 3)
    .sort((a, b) => Number(b.t.audience === theme) - Number(a.t.audience === theme)), [opportunities, theme, digestMax])
  const themeObj = DIGEST_THEMES.find((t) => t.id === digestTheme)
  // The suggested title follows the number picked until the user writes their own.
  const dTitle = titleTouched ? digestTitle : themeObj ? themeObj.title(selected.length) : defaultDigestTitle(selected.length)
  // The picture and captions follow the title once typing pauses, not on every keystroke.
  const [imgTitle, setImgTitle] = useState(dTitle)
  useEffect(() => { const t = setTimeout(() => setImgTitle(dTitle), 600); return () => clearTimeout(t) }, [dTitle])
  const dKey = isDigest && stage === "craft" && selected.length >= 2 && imgTitle.trim() ? `${selected.join(",")}|${imgTitle}` : ""
  useEffect(() => {
    if (!dKey) return
    let off = false
    api<Record<string, string>>("/api/digest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, title: imgTitle }) })
      .then((c) => {
        if (off) return
        // Keep any caption the user edited; replace the ones still showing the old suggestion.
        const old = dDefaultsRef.current
        setDCaps((cur) => Object.fromEntries(Object.keys(c).map((p) => [p, cur[p] === undefined || cur[p] === old[p] ? c[p] : cur[p]])))
        dDefaultsRef.current = c
        setDDefaults(c)
      })
      .catch((e: Error) => { if (!off) setError(e.message) })
    return () => { off = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dKey])
  function switchFormat(f: "single" | "digest") {
    if (f === format) return
    setFormat(f)
    if (f === "single" && selected.length > max) {
      setSelected(selected.slice(0, max))
      setToast(`Single posts take up to ${max}, so the first ${max} were kept.`)
    }
  }
  function applyIdea(t: DigestTheme, items: OppLite[]) {
    setSelected(items.map((o) => o.id))
    setDigestTheme(t.id)
    setTitleTouched(false)
  }
  function move(id: string, dir: -1 | 1) {
    setSelected((s) => {
      const i = s.indexOf(id), j = i + dir
      if (i < 0 || j < 0 || j >= s.length) return s
      const n = [...s]; [n[i], n[j]] = [n[j], n[i]]
      return n
    })
  }

  // Leaving craft with nothing selected makes no sense: go back to scouting.
  useEffect(() => { if (stage === "craft" && !selected.length) setStage("scout") }, [stage, selected.length])
  function goStage(next: "scout" | "craft") {
    setStage(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function toggle(id: string) {
    if (selected.includes(id)) return setSelected(selected.filter((s) => s !== id))
    if (selected.length >= cap) return setToast(`${isDigest ? "A digest" : "You"} can take at most ${cap} — remove one first.`)
    setSelected([...selected, id])
  }

  const problems: string[] = []
  if (!selected.length) problems.push("Select at least one job or scholarship.")
  if (!chosenPlatforms.length) problems.push("Pick at least one platform.")
  if (isDigest) {
    if (selected.length === 1) problems.push("A digest needs at least 2 opportunities.")
    if (!dTitle.trim()) problems.push("Give the digest a title.")
    for (const p of chosenPlatforms) {
      const text = dCaps[p.id] ?? ""
      if (!text.trim()) problems.push(`${p.name} caption is still being written.`)
      else if (captionLength(p.id, text) > p.captionLimit) problems.push(`${p.name} caption is too long.`)
    }
  } else for (const id of selected) {
    for (const p of chosenPlatforms) {
      const text = captions[id]?.[p.id] ?? ""
      if (!text.trim()) problems.push(`${byId.get(id)?.title}: ${p.name} caption is empty.`)
      else if (captionLength(p.id, text) > p.captionLimit) problems.push(`${byId.get(id)?.title}: ${p.name} caption is too long.`)
    }
  }
  const ready = problems.length === 0 && (isDigest ? chosenPlatforms.every((p) => dCaps[p.id]) : selected.every((id) => captions[id]))

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
            extraUploadIds: isDigest ? [] : (pics[id] ?? []).map((p) => p.id),
            captions: isDigest ? {} : Object.fromEntries(chosenPlatforms.map((p) => [p.id, captions[id][p.id]])),
          })),
          ...(isDigest ? { digest: { title: dTitle.trim(), captions: Object.fromEntries(chosenPlatforms.map((p) => [p.id, dCaps[p.id]])) } } : {}),
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

  const prime = clock ? nextPrime(chosenPlatforms.map((p) => p.id), clock) : null
  const goalPct = Math.min(100, Math.round((mission.weekItems / mission.goal) * 100))
  const maxAud = Math.max(1, ...AUDIENCES.map((a) => mission.byAudience[a.id] ?? 0))
  const active = byId.get(activeId && selected.includes(activeId) ? activeId : selected[0] ?? "")
  const pvPlatform = chosenPlatforms.find((p) => p.id === pv) ?? chosenPlatforms[0]
  const track = music ? tracks.find((t) => t.id === music.id)?.name ?? null : null
  const deckKey = [effAud, effSub, world, fresh, soon, q, rank].join("|")
  const digestImg = `/api/digest/card?ids=${selected.join(",")}&title=${encodeURIComponent(imgTitle)}`

  return (
    <div className={`studio stage-${stage}`}>
      {/* ---------- mission bar ---------- */}
      <div className="mission">
        <div className="m-cell">
          <span className={`m-flame ${mission.streak ? "lit" : ""}`} aria-hidden="true">🔥</span>
          <div>
            <b className="m-big">{mission.streak}</b> <span>day streak</span>
            <div className="muted small">{mission.postedToday ? "Posted today. Nice." : mission.streak ? "Share today to keep it going" : "Share a post to start one"}</div>
          </div>
        </div>
        <div className="m-cell">
          <span className="score" style={{ "--p": goalPct } as React.CSSProperties} aria-hidden="true">{goalPct}%</span>
          <div>
            <b className="m-big">{mission.weekItems}</b><span>/{mission.goal} this week</span>
            <div className="muted small">Goal: one opportunity a day</div>
          </div>
        </div>
        <div className="m-cell m-balance">
          <div className="m-bars" aria-label="Opportunities shared this week, per audience">
            {AUDIENCES.map((a) => (
              <span key={a.id} className={`m-bar a-${a.id}`} title={`${a.name}: ${mission.byAudience[a.id] ?? 0} this week`}>
                <i style={{ height: `${Math.max(8, ((mission.byAudience[a.id] ?? 0) / maxAud) * 100)}%` }} />
                <small>{a.emoji}</small>
              </span>
            ))}
          </div>
          <div className="small">
            <b>{audienceInfo(underserved).emoji} {audienceInfo(underserved).name}</b> needs you most
            <div className="muted">{mission.byAudience[underserved] ?? 0} shared this week</div>
            <button type="button" className="link small" onClick={() => { pickAudience(underserved); setView("deck"); goStage("scout") }}>Scout it →</button>
          </div>
        </div>
        <div className="m-cell">
          <span className={`m-dot ${prime?.now.length ? "live" : ""}`} aria-hidden="true" />
          <div className="small">
            {!prime ? <span className="muted">Checking the clock…</span>
              : prime.now.length ? <><b>Prime time now</b><div className="muted">{prime.now.map((p) => PLATFORM_SHORT[p] ?? p).join(", ")}</div></>
              : prime.next ? <><b>{PLATFORM_SHORT[prime.next.platform] ?? prime.next.platform} prime time</b><div className="muted">in {fmtWait(prime.next.inMin)} ({BEST_TIMES[prime.next.platform].label})</div></>
              : <span className="muted">No platform picked</span>}
          </div>
        </div>
      </div>

      {stage === "scout" ? (
        <section className="scout">
          <div className="format-switch" role="tablist" aria-label="What to make">
            <button type="button" role="tab" aria-selected={!isDigest} className={!isDigest ? "on" : ""} onClick={() => switchFormat("single")}>
              <b>Single posts</b><span>Up to {max}, one post each</span>
            </button>
            <button type="button" role="tab" aria-selected={isDigest} className={isDigest ? "on" : ""} onClick={() => switchFormat("digest")}>
              <b>🔥 Top {digestMax} digest</b><span>One post listing up to {digestMax}</span>
            </button>
          </div>

          {isDigest ? (
            <div className="lineup">
              <div className="lineup-head">
                <div>
                  <div className="kicker">✦ Digest ideas</div>
                  <h2 className="lineup-title">One post, five chances</h2>
                  <div className="muted small">Lists get saved and shared. Each idea is the best unposted opportunities for one theme, one per organisation. Or build your own from the deck below.</div>
                </div>
              </div>
              <div className="ideas-grid">
                {ideas.map(({ t, items, matches }) => {
                  const on = digestTheme === t.id && items.length === selected.length && items.every((o) => selected.includes(o.id))
                  return (
                    <div key={t.id} className={`idea a-${t.audience} ${on ? "on" : ""}`}>
                      <div className="idea-title">{t.emoji} {t.title(items.length)}</div>
                      <div className="muted small">{matches} match · the best {items.length}</div>
                      <ol>{items.map((o) => <li key={o.id} title={`${o.title} — ${o.organization}`}>{o.title}</li>)}</ol>
                      <button type="button" className="primary small" onClick={() => applyIdea(t, items)}>{on ? "✓ In your digest" : "Use this digest"}</button>
                    </div>
                  )
                })}
                {!ideas.length && <div className="muted small">No theme has 3 unposted opportunities right now. Build your own below.</div>}
              </div>
              <label className="digest-title">
                <span className="section-label">Digest title</span>
                <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                  <input type="text" value={dTitle} maxLength={120} onChange={(e) => { setDigestTitle(e.target.value); setTitleTouched(true) }} />
                  {titleTouched && <button type="button" className="link small" style={{ whiteSpace: "nowrap" }} onClick={() => setTitleTouched(false)}>Use suggested</button>}
                </span>
              </label>
            </div>
          ) : (
          <div className="lineup">
            <div className="lineup-head">
              <div>
                <div className="kicker">✦ Maester&apos;s pick</div>
                <h2 className="lineup-title">Tonight&apos;s lineup</h2>
                <div className="muted small">The 3 unposted opportunities most likely to bring visitors to PathMaester, judged for the {chosenPlatforms.length} platform{chosenPlatforms.length === 1 ? "" : "s"} you post to.</div>
              </div>
              {pickSelected
                ? <span className="row" style={{ gap: 8 }}><span className="badge ok">In your lineup</span><button type="button" className="primary" onClick={() => goStage("craft")}>Craft these →</button></span>
                : <button type="button" className="primary" disabled={!pick.length} onClick={() => setSelected(pickIds.slice(0, max))}>Use this lineup</button>}
            </div>
            <div className="lineup-grid">
              {pick.map(({ o, draw }, i) => (
                <button type="button" key={o.id} className={`lineup-card a-${o.primary} ${selected.includes(o.id) ? "on" : ""}`} onClick={() => toggle(o.id)} aria-pressed={selected.includes(o.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/card/${o.id}`} alt="" />
                  <span className="lineup-n">{i + 1}</span>
                  <span className="score" style={{ "--p": Math.min(99, draw.score) } as React.CSSProperties} title="Draw score: reach + who can apply + fit with your platforms">{Math.min(99, draw.score)}</span>
                  <span className="lineup-body">
                    <b>{o.title}</b>
                    <span className="muted small">{o.organization}</span>
                    <span className="small">{draw.why.slice(0, 2).join(" · ")}</span>
                    {draw.strong.length > 0 && <span className="small muted">🔥 Best on {draw.strong.slice(0, 3).map((p) => PLATFORM_SHORT[p] ?? p).join(", ")} · {PLATFORM_CROWD[draw.strong[0]].who}</span>}
                  </span>
                </button>
              ))}
              {!pick.length && <div className="muted small">Nothing new to suggest: everything open has been posted.</div>}
            </div>
          </div>
          )}

          {/* ---------- smart sets ---------- */}
          <div className="sets">
            {AUDIENCES.map((a) => (
              <div key={a.id} className={`set a-${a.id} ${a.id === theme ? "today" : ""}`}>
                <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                  <span className="name">{a.emoji} {a.name}</span>
                  {a.id === theme && <span className="badge aud">Today</span>}
                </div>
                <div className="meter" title={`${stats[a.id].total - stats[a.id].fresh} of ${stats[a.id].total} already posted`}>
                  <i style={{ width: `${stats[a.id].total ? Math.round(((stats[a.id].total - stats[a.id].fresh) / stats[a.id].total) * 100) : 0}%` }} />
                </div>
                <div className="muted small">{stats[a.id].fresh} of {stats[a.id].total} to post · {a.hint}</div>
                <ol>{sets[a.id].map((o) => <li key={o.id} title={`${o.title} — ${o.organization}`}>{o.title}</li>)}</ol>
                <div className="row" style={{ gap: 8, marginTop: "auto" }}>
                  <button type="button" className="primary small" disabled={!sets[a.id].length} onClick={() => applySet(sets[a.id], a.id)}>Use set</button>
                  <button type="button" className="link small" onClick={() => pickAudience(a.id)}>Scout all</button>
                </div>
              </div>
            ))}
            <div className="set a-URGENT">
              <span className="name">⏳ Last chance</span>
              <div className="muted small">Closing within 7 days, never posted</div>
              <ol>{lastChance.map((o) => <li key={o.id} title={`${o.title} — ${o.organization}`}>{o.title} <span className="muted">({o.daysLeft}d)</span></li>)}</ol>
              {lastChance.length === 0 && <div className="muted small">Nothing is about to close.</div>}
              <div className="row" style={{ gap: 8, marginTop: "auto" }}>
                <button type="button" className="primary small" disabled={!lastChance.length} onClick={() => { applySet(lastChance, "ALL"); setSoon(true) }}>Use set</button>
              </div>
            </div>
          </div>

          {/* ---------- ask + filters ---------- */}
          <div className="ask">
            <input type="search" aria-label="Ask for the opportunities you want" placeholder="Ask in your own words: remote jobs with no experience closing this week"
              value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} />
          </div>
          <div className="understood">
            {intent.understood.length > 0
              ? <><span className="muted">Understood:</span>{intent.understood.map((u) => <span key={u} className="badge">{u}</span>)}
                  {intent.text && <span className="badge">text: “{intent.text}”</span>}
                  <button type="button" className="link small" onClick={() => setQ("")}>Clear</button></>
              : <span className="try muted">Try: {ASK_EXAMPLES.map((ex, i) => <span key={ex}>{i > 0 && " · "}<button type="button" onClick={() => setQ(ex)}>{ex}</button></span>)}</span>}
          </div>
          <div className="picker-tools">
            <div className="tabs aud-tabs" role="tablist">
              <button type="button" className={effAud === "ALL" ? "on" : ""} onClick={() => pickAudience("ALL")}>All <span className="count">{opportunities.length}</span></button>
              {AUDIENCES.map((a) => (
                <button key={a.id} type="button" className={`a-${a.id} ${effAud === a.id ? "on" : ""}`} title={a.hint} onClick={() => pickAudience(a.id)}>
                  {a.emoji} {a.name} <span className="count">{stats[a.id].total}</span>
                </button>
              ))}
            </div>
            <span className="grow" />
            <div className="tabs" role="tablist" aria-label="View">
              <button type="button" className={view === "deck" ? "on" : ""} onClick={() => setView("deck")}>🂠 Deck</button>
              <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")}>☰ List</button>
            </div>
          </div>
          <div className="row filters">
            {(SUBS[effAud] ?? []).map(([id, label]) => (
              <button key={id} type="button" className={`pill ${effSub === id || (id === "REMOTE" && intent.remote) ? "on" : ""}`} onClick={() => setSub(sub === id ? "" : id)}>{label}</button>
            ))}
            <button type="button" className={`pill ${world || intent.world ? "on" : ""}`} title="Only what the listing itself opens to every country" onClick={() => setWorld(!world)}>🌍 Open worldwide</button>
            <button type="button" className={`pill ${fresh || (intent.fresh && !relaxed) ? "on" : ""}`} onClick={() => setFresh(!fresh)}>Not posted yet</button>
            <button type="button" className={`pill ${soon || (intent.soon && !relaxed) ? "on" : ""}`} onClick={() => setSoon(!soon)}>Closing in 7 days</button>
            <span className="grow" />
            <span className="muted small">{shown.length} found · sort</span>
            <div className="tabs">
              <button type="button" className={rank === "smart" ? "on" : ""} title="Best expected reach first" onClick={() => setRank("smart")}>Reach</button>
              <button type="button" className={rank === "new" ? "on" : ""} onClick={() => setRank("new")}>Newest</button>
            </div>
          </div>
          {relaxed && shown.length > 0 && (
            <div className="banner">Nothing matches all of that, so the timing part was dropped. These are the closest {shown.length}.</div>
          )}

          {view === "deck" ? (
            <Deck key={deckKey} items={shown} selected={selected} max={cap} theme={theme} platforms={chosenPlatforms.map((p) => p.id)}
              names={PLATFORM_SHORT} onAdd={(id) => toggle(id)} onFull={() => setToast(`Your ${isDigest ? "digest" : "lineup"} is full (${cap}). Craft it, or remove one in the dock.`)} />
          ) : (
            <div className="opps">
              {shown.slice(0, limit).map((o) => {
                const on = selected.includes(o.id)
                return (
                  <button type="button" key={o.id} className={`opp a-${o.primary} ${on ? "on" : ""}`} onClick={() => toggle(o.id)} aria-pressed={on}>
                    <span className="tick">{on ? selected.indexOf(o.id) + 1 : ""}</span>
                    <span className="grow">
                      <span className="row" style={{ gap: 6 }}>
                        <span className={`badge ${o.kind === "JOB" ? "job" : "sch"}`}>{o.kind === "JOB" ? "Job" : "Scholarship"}</span>
                        {o.badges.map((b) => <span key={b} className="badge aud" title={b === "Limited eligibility" ? o.scopeLabel : undefined}>{b}</span>)}
                        {o.daysLeft !== null && o.daysLeft <= 7 && <span className="badge warn">{o.daysLeft === 0 ? "Closes today" : `${o.daysLeft}d left`}</span>}
                        {o.postedTo.length > 0 && <span className="badge ok">Posted: {o.postedTo.map((p) => PLATFORM_SHORT[p] ?? p).join(", ")}</span>}
                      </span>
                      <span className="title" style={{ display: "block", marginTop: 4 }}>{o.title}</span>
                      <span className="meta">{[o.organization, o.location, o.deadline && `Deadline ${o.deadline}`].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="score" style={{ "--p": scores.get(o.id)!.score } as React.CSSProperties}
                      title={`Reach score ${scores.get(o.id)!.score}\n${scores.get(o.id)!.why.join("\n")}`}>{scores.get(o.id)!.score}</span>
                  </button>
                )
              })}
              {!shown.length && <div className="panel muted">Nothing matches. Try fewer words, or pick an audience above.</div>}
              {shown.length > limit && <button type="button" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more ({shown.length - limit} hidden)</button>}
            </div>
          )}
        </section>
      ) : (
        <section className="craft">
          <div className="craft-head">
            <div>
              <div className="kicker">Act 2</div>
              <h2 className="lineup-title">{isDigest ? "Craft your digest" : "Craft your posts"}</h2>
            </div>
            {isDigest ? (
              <label className="digest-title grow" style={{ maxWidth: 560 }}>
                <span className="section-label">Digest title</span>
                <input type="text" value={dTitle} maxLength={120} onChange={(e) => { setDigestTitle(e.target.value); setTitleTouched(true) }} />
              </label>
            ) : (
            <div className="tabs craft-items" role="tablist" aria-label="Post being edited">
              {selected.map((id, k) => {
                const o = byId.get(id)
                return o && (
                  <button key={id} type="button" role="tab" aria-selected={active?.id === id} className={`a-${o.primary} ${active?.id === id ? "on" : ""}`} onClick={() => setActiveId(id)}>
                    <span className="craft-n">{k + 1}</span> {o.title.length > 34 ? o.title.slice(0, 33) + "…" : o.title}
                  </button>
                )
              })}
            </div>
            )}
          </div>

          <div className="craft-grid">
            <aside className="panel stack craft-settings">
              <div>
                <h3>How</h3>
                <div className="tabs mode-tabs" role="tablist">
                  <button type="button" className={mode === "manual" ? "on" : ""} onClick={() => setMode("manual")}>Share myself</button>
                  <button type="button" className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>Auto-post</button>
                </div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  {mode === "manual" ? "Each platform opens with the post ready; you click Post." : "Sent through your connected accounts, no clicks."}
                </div>
              </div>
              <div>
                <h3>Where</h3>
                {(["image", "video"] as const).map((media) => (
                  <div key={media}>
                    <div className="section-label">{media === "image" ? "Picture posts" : "Video posts"}</div>
                    <div className="plat-grid">
                      {platforms.filter((p) => p.media === media).map((p) => (
                        <label key={p.id} className={`check ${available(p) ? "" : "disabled"}`}
                          title={available(p) ? (BEST_TIMES[p.id] ? `Usually best: ${BEST_TIMES[p.id].label}` : "") : p.manualOnly ? "No posting API — use Share myself" : `Missing: ${p.missing.join(", ")}`}>
                          <input type="checkbox" disabled={!available(p)} checked={chosen.includes(p.id) && available(p)}
                            onChange={(e) => setChosen(e.target.checked ? [...chosen, p.id] : chosen.filter((c) => c !== p.id))} />
                          <span>{PLATFORM_SHORT[p.id] ?? p.name}{hour !== null && goodNow(p.id, hour) && <i className="now-dot" title="Good time to post right now" />}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {mode === "auto" && platforms.some((p) => !p.usable && !p.manualOnly) && <div className="muted small" style={{ marginTop: 6 }}>Connect the rest in <a href="/settings">Accounts</a>.</div>}
              </div>
              {wantsVideo && (
                <div>
                  <h3>Sound</h3>
                  <MusicPanel kinds={selected.map((id) => byId.get(id)?.primary ?? "")} tracks={tracks} setTracks={setTracks} music={music} setMusic={(m) => { setMusicTouched(true); setMusic(m) }} slideSeconds={slideSeconds} setSlideSeconds={setSlideSeconds} />
                </div>
              )}
            </aside>

            <div className="craft-phone">
              <div className="tabs pv-tabs" role="tablist" aria-label="Preview on">
                {chosenPlatforms.map((p) => (
                  <button key={p.id} type="button" className={pvPlatform?.id === p.id ? "on" : ""} onClick={() => setPv(p.id)}>{PLATFORM_SHORT[p.id] ?? p.name}</button>
                ))}
              </div>
              {isDigest && active && pvPlatform && selected.length >= 2
                ? <PhonePreview opp={active} platform={pvPlatform.id} caption={dCaps[pvPlatform.id] ?? "Writing the caption…"} brand={brand}
                    track={pvPlatform.media === "video" ? track : null} extraPics={selected.map((id) => `/api/card/${id}?format=story`)}
                    feedSrc={digestImg} storySrc={`${digestImg}&format=story`} />
                : !isDigest && active && pvPlatform
                ? <PhonePreview opp={active} platform={pvPlatform.id} caption={captions[active.id]?.[pvPlatform.id] ?? "Writing the caption…"} brand={brand}
                    track={pvPlatform.media === "video" ? track : null} extraPics={(pics[active.id] ?? []).map((p) => p.url)} />
                : <div className="muted small">{isDigest ? "Pick at least 2 for a digest." : "Pick a platform to preview."}</div>}
              <div className="muted small" style={{ textAlign: "center" }}>Live preview. Close to how the app shows it, not pixel-exact.</div>
            </div>

            <div className="craft-editor">
              {isDigest ? (
                <DigestEditor items={selected.map((id) => byId.get(id)).filter((o): o is OppLite => !!o)} title={imgTitle} platforms={chosenPlatforms}
                  captions={dCaps} defaults={dDefaults} setCaption={(p, text) => setDCaps((c) => ({ ...c, [p]: text }))}
                  tab={pvPlatform?.id} onTab={setPv} onMove={move} onRemove={(id) => toggle(id)}
                  wantsVideo={wantsVideo} music={music} slideSeconds={slideSeconds} />
              ) : active && (
                <ItemEditor key={active.id} opp={active} platforms={chosenPlatforms} captions={captions[active.id]} defaults={defaults[active.id]}
                  setCaption={(p, text) => setCaptions((c) => ({ ...c, [active.id]: { ...c[active.id], [p]: text } }))}
                  pics={pics[active.id] ?? []} setPics={(p) => setPics((all) => ({ ...all, [active.id]: p }))}
                  wantsVideo={wantsVideo} music={music} slideSeconds={slideSeconds} onRemove={() => toggle(active.id)}
                  tab={pvPlatform?.id} onTab={setPv} compact />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ---------- the dock: your lineup, always in reach ---------- */}
      <div className="dock" role="region" aria-label="Your lineup">
        {stage === "craft" && <button type="button" className="dock-back" onClick={() => goStage("scout")}>← Scout</button>}
        <div className="dock-slots">
          {Array.from({ length: cap }, (_, k) => {
            const o = selected[k] ? byId.get(selected[k]) : undefined
            return o ? (
              <button key={o.id} type="button" className={`slot a-${o.primary} ${stage === "craft" && active?.id === o.id ? "on" : ""}`}
                title={stage === "scout" ? `Remove: ${o.title}` : isDigest ? `${k + 1}. ${o.title}` : `Edit: ${o.title}`}
                onClick={() => (stage === "scout" ? toggle(o.id) : !isDigest && setActiveId(o.id))}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/card/${o.id}`} alt={o.title} />
                {stage === "scout" && <span className="slot-x" aria-hidden="true">×</span>}
              </button>
            ) : <span key={k} className="slot empty" aria-label={`Empty slot ${k + 1}`}>{k + 1}</span>
          })}
        </div>
        <div className="dock-text small">
          <b>{selected.length} of {cap}</b> {isDigest ? "in the digest" : "picked"} · {chosenPlatforms.length} platform{chosenPlatforms.length === 1 ? "" : "s"}
          {stage === "craft" && !ready && selected.length > 0 && problems[0] && <div className="error">{problems[0]}</div>}
          {error && <div className="error">{error}</div>}
        </div>
        {stage === "scout"
          ? <button type="button" className="primary dock-go" disabled={!selected.length || (isDigest && selected.length < 2)} onClick={() => goStage("craft")}>{isDigest ? "Craft digest →" : `Craft ${selected.length || ""} →`}</button>
          : <button type="button" className="primary dock-go" disabled={!ready || posting} onClick={post}>
              {posting ? "Starting…" : mode === "manual" ? "Prepare to share →" : "Post now →"}
            </button>}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
