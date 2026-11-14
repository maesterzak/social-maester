"use client"

import { useState } from "react"
import { shareTarget } from "@/lib/share-links"
import type { Item, Post } from "@/lib/campaigns"
import { api } from "./types"

type Props = {
  item: Item & { links: Record<string, string | null> }
  posts: Post[]
  names: Record<string, string>
  reload: () => Promise<void>
}

function download(url: string, name: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Opens a tab; false if the pop-up blocker stopped it. ("noopener" would make window.open return null always.) */
function openTab(url: string): boolean {
  const w = window.open(url, "_blank")
  if (!w) return false
  w.opener = null
  return true
}

function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea")
  ta.value = text
  ta.setAttribute("readonly", "")
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0"
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try { ok = document.execCommand("copy") } catch { /* unsupported */ }
  ta.remove()
  return ok
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)

// "Share myself": opens each platform with the post prepared; the user attaches the media and clicks Post.
export function ShareKit({ item, posts, names, reload }: Props) {
  // Several messages can come from one click (copy result + blocked tabs), so keep a list.
  const [notes, setNotes] = useState<{ ok: boolean; text: string }[]>([])
  const ready = posts.every((p) => p.status === "ready" || p.status === "done")
  const image = item.image_file ? `/api/files/${item.image_file}` : null
  const video = item.video_file ? `/api/files/${item.video_file}` : null
  const name = slug(item.title)
  const targets = posts.map((p) => ({ post: p, t: shareTarget(p.platform, p.caption, item.links[p.platform] ?? null) }))

  const say = (text: string, ok = true) => setNotes((n) => [...n.filter((x) => x.text !== text), { ok, text }])

  async function copyText(text: string, what = "Caption") {
    // The old execCommand route runs synchronously inside the click, so it still works where the
    // async clipboard API is blocked (some browsers, embedded views).
    if (legacyCopy(text)) return say(`${what} copied — paste it with Ctrl+V.`)
    try { await navigator.clipboard.writeText(text); say(`${what} copied — paste it with Ctrl+V.`) }
    catch { say("Couldn't copy — open “Caption” below and copy it by hand.", false) }
  }

  async function copyPicture() {
    if (!image) return
    try {
      const blob = await (await fetch(image)).blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      say("Picture copied — paste it into the post with Ctrl+V.")
    } catch {
      say("This browser can't copy pictures — use Download picture instead.", false)
    }
  }

  // The clipboard is written before any tab opens: once a new tab takes focus, the browser refuses the copy.
  function openOne(p: Post) {
    setNotes([])
    const { t } = targets.find((x) => x.post.id === p.id)!
    if (!t.prefilled) void copyText(p.caption, `${names[p.platform]} caption`)
    if (!openTab(t.url)) say("The browser blocked the tab — allow pop-ups for this site.", false)
  }

  function openAll() {
    setNotes([])
    const open = targets.filter((x) => x.post.status !== "done")
    // Only one thing fits on the clipboard: the caption of the first platform that can't be prefilled.
    const paste = open.find((x) => !x.t.prefilled)
    if (paste) void copyText(paste.post.caption, `${names[paste.post.platform]} caption`)
    let blocked = 0
    for (const { t } of open) if (!openTab(t.url)) blocked++
    if (open.some((x) => x.t.attach === "image") && image) download(image, `${name}.png`)
    if (open.some((x) => x.t.attach === "video") && video) download(video, `${name}.mp4`)
    if (blocked) say(`The browser blocked ${blocked} of ${open.length} tabs. Click the pop-up icon in the address bar → “Always allow” for this site, then try again — or use the Open buttons below.`, false)
  }

  async function mark(p: Post, shared: boolean) {
    try { await api(`/api/posts/${p.id}/mark`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shared }) }); await reload() }
    catch (e) { say((e as Error).message, false) }
  }

  if (!ready) return <div className="muted small">Making the picture and video… the share buttons appear when they&apos;re ready.</div>

  const left = targets.filter((x) => x.post.status !== "done").length
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row">
        <button type="button" className="primary" disabled={!left} onClick={openAll}>
          {left ? `Open all ${left} platforms` : "All shared"}
        </button>
        {image && <button type="button" onClick={copyPicture}>Copy picture</button>}
        {image && <button type="button" onClick={() => download(image, `${name}.png`)}>Download picture</button>}
        {video && <button type="button" onClick={() => download(video, `${name}.mp4`)}>Download video</button>}
      </div>
      <div className="muted small">
        Opens each platform in its own tab with the post prepared, downloads the picture/video, and copies the caption
        that can&apos;t be filled in automatically. Platforms don&apos;t let other sites attach files, so add the picture or video yourself.
      </div>
      {notes.map((n) => <div key={n.text} className={n.ok ? "ok-text" : "error"}>{n.text}</div>)}

      <table>
        <tbody>
          {targets.map(({ post: p, t }) => (
            <tr key={p.id} className={p.status === "done" ? "shared-row" : ""}>
              <td style={{ width: 130 }}>
                <b>{names[p.platform] ?? p.platform}</b>
                <div className="muted small">{t.attach === "video" ? "video" : "picture"}{t.prefilled ? " · text filled in" : " · paste caption"}</div>
              </td>
              <td className="small">
                {t.hint}
                <details>
                  <summary className="muted small" style={{ cursor: "pointer", marginTop: 4 }}>Caption</summary>
                  <pre className="caption">{p.caption}</pre>
                </details>
              </td>
              <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                  <button type="button" className="small" onClick={() => openOne(p)}>Open</button>
                  <button type="button" className="small" onClick={() => { setNotes([]); void copyText(p.caption, `${names[p.platform]} caption`) }}>Copy caption</button>
                </div>
                <label className="check small" style={{ justifyContent: "flex-end", marginTop: 6 }}>
                  <input type="checkbox" checked={p.status === "done"} onChange={(e) => mark(p, e.target.checked)} /> Shared
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
