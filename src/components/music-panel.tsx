"use client"

import { useState } from "react"
import { api, fmtTime, type MusicChoice, type TrackLite } from "./types"

type Props = {
  tracks: TrackLite[]
  setTracks: (t: TrackLite[]) => void
  music: MusicChoice
  setMusic: (m: MusicChoice) => void
  slideSeconds: number
  setSlideSeconds: (n: number) => void
}

// Background music for the Reels/TikTok videos: pick or upload a track, choose where it starts and how loud.
export function MusicPanel({ tracks, setTracks, music, setMusic, slideSeconds, setSlideSeconds }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const track = music ? tracks.find((t) => t.id === music.id) : undefined

  async function upload(f: File) {
    setBusy(true); setError("")
    try {
      const form = new FormData()
      form.append("file", f)
      const t = await api<TrackLite>("/api/music", { method: "POST", body: form })
      setTracks([t, ...tracks])
      setMusic({ id: t.id, start: 0, volume: 0.8 })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this track from the music library? Its file is deleted.")) return
    await api(`/api/music/${id}`, { method: "DELETE" })
    setTracks(tracks.filter((t) => t.id !== id))
    if (music?.id === id) setMusic(null)
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row">
        <select className="grow" style={{ width: "auto" }} value={music?.id ?? ""} aria-label="Background music"
          onChange={(e) => setMusic(e.target.value ? { id: Number(e.target.value), start: 0, volume: music?.volume ?? 0.8 } : null)}>
          <option value="">No music</option>
          {tracks.map((t) => <option key={t.id} value={t.id}>{t.name} ({fmtTime(t.duration)})</option>)}
        </select>
        <label className="btn file-btn">
          {busy ? "Uploading…" : "Upload music"}
          <input type="file" accept=".mp3,.m4a,.aac,.wav,.ogg,audio/*" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f) }} />
        </label>
      </div>
      {error && <div className="error">{error}</div>}

      {track && music && (
        <>
          <audio key={track.id} controls preload="metadata" src={`/api/files/${track.file}#t=${music.start}`} style={{ width: "100%" }} />
          <label className="small">
            Start from <b>{fmtTime(music.start)}</b>
            <input type="range" min={0} max={Math.max(0, Math.floor(track.duration - 5))} step={1} value={music.start}
              onChange={(e) => setMusic({ ...music, start: Number(e.target.value) })} />
          </label>
          <label className="small">
            Volume <b>{Math.round(music.volume * 100)}%</b>
            <input type="range" min={0.1} max={1.5} step={0.05} value={music.volume}
              onChange={(e) => setMusic({ ...music, volume: Number(e.target.value) })} />
          </label>
          <div className="row small">
            <span className="muted">Track library:</span>
            <button type="button" className="link danger small" onClick={() => remove(track.id)}>Remove “{track.name}”</button>
          </div>
        </>
      )}

      <label className="small">
        Seconds per picture <b>{slideSeconds}s</b>
        <input type="range" min={2} max={10} step={0.5} value={slideSeconds} onChange={(e) => setSlideSeconds(Number(e.target.value))} />
      </label>
    </div>
  )
}
