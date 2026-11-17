"use client"

import { useState } from "react"
import { api } from "./types"

type Props = {
  link: { url: string; source: "custom" | "page" | "pathmaester" }
  perPlatform: Record<string, string>
  pageReady: boolean
}

const SOURCE: Record<Props["link"]["source"], string> = {
  custom: "Your own link (saved below)",
  page: "This app's public Apply-links page",
  pathmaester: "PathMaester's site (it has a search box, so captions say what to search)",
}

const STEPS: { id: string; name: string; how: string; rule: string }[] = [
  { id: "tiktok", name: "TikTok", how: "Profile → Edit profile → Website (or Links).",
    rule: "TikTok only shows a tappable website on a Business account, or a personal account with about 1,000+ followers. Switching to Business is free (Settings → Account)." },
  { id: "instagram", name: "Instagram", how: "Profile → Edit profile → Links → Add external link.",
    rule: "Every account can have up to 5 tappable links. Stories can also carry a tappable link sticker." },
  { id: "youtube", name: "YouTube", how: "YouTube Studio → Customisation → Basic info → Links.",
    rule: "Shorts descriptions aren't tappable since 2023; the channel links under your name are." },
]

// "Link in bio": captions on TikTok, Instagram and YouTube Shorts can't hold a tappable link, so the profile link
// is where viewers go. Shows which address to use, copies it, and lets the user save their own.
export function BioCard({ link: initial, perPlatform, pageReady }: Props) {
  const [link, setLink] = useState(initial)
  const [draft, setDraft] = useState(initial.source === "custom" ? initial.url : "")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); setMsg({ ok: true, text: `${what} copied — paste it into the profile.` }) }
    catch { setMsg({ ok: false, text: "Couldn't copy — select the address and copy it by hand." }) }
  }
  async function save(url: string | null) {
    setMsg(null)
    try {
      setLink(await api<Props["link"]>("/api/bio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }))
      setMsg({ ok: true, text: url ? "Saved. Captions keep saying “tap the link in our bio”." : "Back to the automatic link." })
      if (!url) setDraft("")
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }

  return (
    <div className="panel stack bio-card" style={{ gap: 12 }} id="bio">
      <div>
        <h2 style={{ margin: 0 }}>🔗 Link in bio</h2>
        <div className="muted small">TikTok, Instagram Reels and YouTube Shorts don&apos;t make links in captions tappable. The website link on your profile is the one people can tap, so every caption there says “tap the link in our bio, then search …”.</div>
      </div>
      <div className="bio-now">
        <div className="section-label" style={{ margin: 0 }}>Put this in your profiles</div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <code className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "8px 10px" }}>{link.url}</code>
          <button type="button" className="primary" onClick={() => copy(link.url, "Link")}>Copy</button>
        </div>
        <div className="muted small">{SOURCE[link.source]}{link.source === "pathmaester" && !pageReady && <> · Once this app is hosted on https, it switches to its own Apply-links page with every post you share (<a href="/bio" target="_blank" rel="noreferrer">preview it</a>).</>}</div>
      </div>

      <table>
        <tbody>
          {STEPS.map((s) => (
            <tr key={s.id}>
              <td style={{ width: 110 }}><b>{s.name}</b></td>
              <td className="small">{s.how}<div className="muted">{s.rule}</div></td>
              <td style={{ width: 120, textAlign: "right" }}>
                <button type="button" className="small" title={perPlatform[s.id]} onClick={() => copy(perPlatform[s.id], `${s.name} link`)}>Copy for {s.name}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small">“Copy for …” adds a tag to the link, so PathMaester&apos;s analytics shows which app the visits came from.</div>

      <form className="row" onSubmit={(e) => { e.preventDefault(); void save(draft.trim() || null) }}>
        <label className="grow small">Use my own link instead (for example a link page you already have)
          <input type="text" inputMode="url" placeholder="https://…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <button type="submit" disabled={!draft.trim()}>Save</button>
        {link.source === "custom" && <button type="button" className="link small" onClick={() => save(null)}>Use automatic</button>}
      </form>
      {msg && <div className={msg.ok ? "ok-text" : "error"}>{msg.text}</div>}
    </div>
  )
}
