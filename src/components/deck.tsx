"use client"

import { useCallback, useEffect, useState } from "react"
import { drawScore, PLATFORM_CROWD } from "@/lib/intel"
import type { OppLite } from "./types"

type Props = {
  items: OppLite[]
  selected: string[]
  max: number
  theme: string
  platforms: string[]
  names: Record<string, string>
  onAdd: (id: string) => void
  onFull: () => void
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))

// One opportunity at a time, as a big card: → (or K) adds it to the lineup, ← (or J) skips, Backspace goes back.
export function Deck({ items, selected, max, theme, platforms, names, onAdd, onFull }: Props) {
  const [i, setI] = useState(0)
  const [leaving, setLeaving] = useState<"" | "left" | "right">("")
  const o = items[i]
  const full = selected.length >= max

  const go = useCallback((dir: "left" | "right") => {
    if (!o || leaving) return
    if (dir === "right") {
      if (selected.includes(o.id)) { setI((n) => n + 1); return }
      if (full) { onFull(); return }
      onAdd(o.id)
    }
    setLeaving(dir)
    // Matches the CSS fly-out; with reduced motion the class has no transition, so this is just a short pause.
    setTimeout(() => { setLeaving(""); setI((n) => n + 1) }, 230)
  }, [o, leaving, selected, full, onAdd, onFull])
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "ArrowRight" || e.key === "k") { e.preventDefault(); go("right") }
      else if (e.key === "ArrowLeft" || e.key === "j") { e.preventDefault(); go("left") }
      else if (e.key === "Backspace" || e.key === "ArrowUp") { e.preventDefault(); back() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, back])

  if (!items.length) return <div className="panel muted">Nothing matches. Try fewer words, or pick another audience.</div>
  if (!o) {
    return (
      <div className="deck-end panel">
        <div className="deck-end-big">✓</div>
        <b>You&apos;ve seen all {items.length}.</b>
        <div className="muted small">Go back to look again, or change the audience above.</div>
        <button type="button" onClick={() => setI(0)}>Start again</button>
      </div>
    )
  }

  const draw = drawScore(o, theme, platforms)
  const score = Math.min(99, draw.score)
  const on = selected.includes(o.id)
  const next = items.slice(i + 1, i + 3)

  return (
    <div className="deck">
      <div className="deck-stack">
        {next.map((n, k) => <div key={n.id} className={`deck-under u${k + 1} a-${n.primary}`} aria-hidden="true" />)}
        <article className={`deck-card a-${o.primary} ${leaving ? `fly-${leaving}` : ""} ${on ? "on" : ""}`} aria-live="polite">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="deck-img" src={`/api/card/${o.id}`} alt={`Post picture for ${o.title}`} />
          <div className="deck-info">
            <div className="row" style={{ gap: 6 }}>
              <span className={`badge ${o.kind === "JOB" ? "job" : "sch"}`}>{o.kind === "JOB" ? "Job" : "Scholarship"}</span>
              {o.badges.map((b) => <span key={b} className="badge aud">{b}</span>)}
              {o.daysLeft !== null && o.daysLeft <= 7 && <span className="badge warn">{o.daysLeft === 0 ? "Closes today" : `${o.daysLeft}d left`}</span>}
            </div>
            <h2 className="deck-title">{o.title}</h2>
            <div className="muted">{[o.organization, o.location].filter(Boolean).join(" · ")}</div>
            {o.deadline && <div className="small muted">Deadline {o.deadline}</div>}

            <div className="deck-score">
              <span className="score big" style={{ "--p": score } as React.CSSProperties}>{score}</span>
              <div className="small">
                <b>Draw score</b>
                <ul>{draw.why.slice(0, 4).map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            </div>
            {(draw.strong.length > 0 || draw.weak.length > 0) && (
              <div className="small">
                {draw.strong.length > 0 && <div>🔥 Best on <b>{draw.strong.slice(0, 3).map((p) => names[p] ?? p).join(", ")}</b> <span className="muted">({PLATFORM_CROWD[draw.strong[0]].who})</span></div>}
                {draw.weak.length > 0 && <div className="muted">Weak on {draw.weak.map((p) => names[p] ?? p).join(", ")}</div>}
              </div>
            )}
            {o.scopeLabel && <div className="small">🌍 Open to: {o.scopeLabel}</div>}
            {o.postedTo.length > 0 && <div className="small muted">Already posted on {o.postedTo.map((p) => names[p] ?? p).join(", ")}</div>}
          </div>
        </article>
      </div>

      <div className="deck-actions">
        <button type="button" className="round" onClick={back} disabled={i === 0} title="Back (Backspace)" aria-label="Back">↶</button>
        <button type="button" className="round skip" onClick={() => go("left")} title="Skip (← or J)" aria-label="Skip">✕</button>
        <button type="button" className={`round add ${on ? "on" : ""}`} onClick={() => go("right")} title="Add to lineup (→ or K)" aria-label={on ? "Already in lineup, next" : "Add to lineup"}>
          {on ? "✓" : "★"}
        </button>
        <span className="deck-count muted small">{i + 1} / {items.length}</span>
      </div>
      <div className="deck-keys muted small"><kbd>←</kbd> skip · <kbd>→</kbd> add · <kbd>⌫</kbd> back</div>
      {/* Warm the next card so the swipe feels instant. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {next.map((n) => <img key={n.id} src={`/api/card/${n.id}`} alt="" hidden />)}
    </div>
  )
}
