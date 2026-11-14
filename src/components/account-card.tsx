"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ConnectStatus } from "@/lib/connect"
import { api } from "./types"

type Props = { a: ConnectStatus; pages: { id: string; name: string; ig?: string }[]; highlight: boolean }

// One account on the Settings page: setup steps, Connect / Test / Disconnect, Telegram form, Facebook Page picker.
export function AccountCard({ a, pages, highlight }: Props) {
  const router = useRouter()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState("")
  const [channel, setChannel] = useState("")
  const connected = !!a.account || a.fromEnv
  const expired = a.expiresAt !== null && a.expiresAt < Date.now()
  const [open, setOpen] = useState(!connected || highlight)

  async function act(fn: () => Promise<string | void>) {
    setBusy(true); setMsg(null)
    try {
      const text = await fn()
      if (text) setMsg({ ok: true, text })
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const test = () => act(async () => `Works: ${(await api<{ account: string }>(`/api/connect/${a.id}/test`, { method: "POST" })).account}`)
  const disconnect = () => confirm(`Disconnect ${a.name}? Saved tokens are removed from this app.`) &&
    act(async () => { await api(`/api/connect/${a.id}`, { method: "DELETE" }); return "Disconnected" })
  const post = (body: unknown) => act(async () =>
    `Connected: ${(await api<{ account: string }>(`/api/connect/${a.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).account}`)

  const canConnect = a.missingApp.length === 0 && !a.httpsProblem

  return (
    <div className="panel stack" style={{ gap: 10, outline: highlight ? "2px solid var(--accent)" : undefined }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>{a.name}</h2>
          <div className="muted small">{a.covers}</div>
        </div>
        <div className="row">
          {a.account && !expired && <span className="badge ok">connected: {a.account}</span>}
          {a.account && expired && <span className="badge bad">expired — reconnect</span>}
          {a.fromEnv && <span className="badge ok">ready (keys in .env)</span>}
          {!connected && <span className="badge">not connected</span>}
        </div>
      </div>

      {a.id === "meta" && pages.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <b>Which Facebook Page should posts go to?</b>
          {pages.map((p) => (
            <button key={p.id} type="button" disabled={busy} onClick={() => post({ pageId: p.id })} style={{ justifyContent: "space-between" }}>
              <span>{p.name}</span><span className="muted small">{p.ig ? `Instagram @${p.ig}` : "no Instagram linked"}</span>
            </button>
          ))}
        </div>
      )}

      <div className="row">
        {a.kind === "oauth" && (
          canConnect
            ? <a className="btn primary-link" href={`/api/connect/${a.id}/start`}>{a.account ? "Reconnect" : "Connect"} {a.name}</a>
            : <button type="button" disabled title={a.httpsProblem ? "Needs an https APP_URL" : `Missing ${a.missingApp.join(", ")}`}>Connect {a.name}</button>
        )}
        {connected && <button type="button" disabled={busy} onClick={test}>{busy ? "Checking…" : "Test"}</button>}
        {a.account && <button type="button" className="danger" disabled={busy} onClick={disconnect}>Disconnect</button>}
        <button type="button" className="link small" onClick={() => setOpen(!open)}>{open ? "Hide setup" : "Setup steps"}</button>
      </div>
      {msg && <div className={msg.ok ? "ok-text" : "error"}>{msg.text}</div>}

      {a.kind === "oauth" && a.missingApp.length > 0 && (
        <div className="small">Missing in <code>.env</code>: {a.missingApp.map((k) => <code key={k} style={{ marginRight: 4 }}>{k}</code>)}</div>
      )}
      {a.httpsProblem && (
        <div className="small error">TikTok only accepts https login addresses. Set <code>APP_URL</code> to an https address that reaches this app (a tunnel or the deployed site).</div>
      )}

      {open && (
        <div className="setup small">
          <ol>{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <div className="row">
            <a href={a.devUrl} target="_blank" rel="noreferrer">Open developer portal ↗</a>
            {a.kind === "oauth" && <span>Redirect / callback URL: <code style={{ userSelect: "all" }}>{a.callback}</code></span>}
          </div>
        </div>
      )}

      {a.kind === "form" && (open || !connected) && (
        <form className="stack" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); void post({ token, channel }) }}>
          <input type="text" placeholder="Bot token, e.g. 123456:ABC-DEF…" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" aria-label="Bot token" />
          <input type="text" placeholder="Channel, e.g. @pathmaester_jobs" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel" />
          <div><button type="submit" className="primary" disabled={busy || !token || !channel}>{busy ? "Checking…" : "Check & save"}</button></div>
        </form>
      )}
    </div>
  )
}
