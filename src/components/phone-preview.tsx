"use client"

import { useState } from "react"
import type { OppLite } from "./types"

type Props = {
  opp: OppLite; platform: string; caption: string; brand: string; track: string | null; extraPics: string[]
  /** Picture overrides (a digest shows its TOP-N card instead of the opportunity's own). */
  feedSrc?: string; storySrc?: string
}

// Turns links and hashtags into the coloured bits each app shows.
function Rich({ text, link }: { text: string; link: string }) {
  const parts = text.split(/(https?:\/\/\S+|#[\p{L}\p{N}_]+|@[\w.]+)/gu)
  return <>{parts.map((p, i) => (/^(https?:|#|@)/.test(p) ? <span key={i} style={{ color: link }}>{p.startsWith("http") ? p.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32) + (p.length > 40 ? "…" : "") : p}</span> : p))}</>
}

/** First n lines, with a "more" the user can open. */
function Clamp({ text, lines, more, link, className }: { text: string; lines: number; more: string; link: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const all = text.split("\n")
  const cut = !open && all.length > lines
  return (
    <div className={className} style={{ whiteSpace: "pre-wrap" }}>
      <Rich text={cut ? all.slice(0, lines).join("\n") : text} link={link} />
      {cut && <button type="button" className="ph-more" onClick={() => setOpen(true)}>{more}</button>}
    </div>
  )
}

const Avatar = ({ brand }: { brand: string }) => <span className="ph-avatar" aria-hidden="true">{brand.slice(0, 1)}</span>

// A phone showing the post the way that app will show it. Close enough to judge length and look, not pixel-exact.
export function PhonePreview({ opp, platform, caption, brand, track, extraPics, feedSrc, storySrc }: Props) {
  const handle = brand.toLowerCase().replace(/[^a-z0-9]/g, "")
  const feed = feedSrc ?? `/api/card/${opp.id}`
  const story = storySrc ?? `/api/card/${opp.id}?format=story`
  const vertical = ["tiktok", "instagram", "youtube"].includes(platform)

  return (
    <div className={`phone ${vertical ? "dark-screen" : ""}`}>
      <div className="phone-notch" aria-hidden="true" />
      <div className="phone-screen">
        {vertical ? (
          <div className="ph-vertical">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ph-bg" src={story} alt="Video first frame" />
            <div className="ph-top">{platform === "tiktok" ? "Following  ·  For You" : platform === "instagram" ? "Reels" : "Shorts"}</div>
            <div className="ph-rail" aria-hidden="true">
              <span className="ph-avatar">{brand.slice(0, 1)}</span>
              <span>♥<small>Like</small></span><span>💬<small>Reply</small></span><span>↗<small>Share</small></span>
            </div>
            <div className="ph-cap">
              <b>@{handle}</b>{platform === "youtube" && <span className="ph-sub">Subscribe</span>}
              <Clamp text={caption} lines={2} more="… more" link="#ffffff" className="ph-cap-text" />
              {track && <div className="ph-track">♫ {track}</div>}
            </div>
            {extraPics.length > 0 && <div className="ph-slides">+{extraPics.length} more slide{extraPics.length === 1 ? "" : "s"}</div>}
          </div>
        ) : platform === "whatsapp" || platform === "telegram" ? (
          <div className={`ph-chat ${platform}`}>
            <div className="ph-chat-head"><Avatar brand={brand} /><b>{platform === "telegram" ? `${brand} channel` : "Job alerts group"}</b></div>
            <div className="ph-bubble">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={feed} alt="Post picture" />
              <Clamp text={caption} lines={14} more="Read more" link={platform === "telegram" ? "#3a8be0" : "#1d9b5e"} />
              <span className="ph-time">19:04 ✓✓</span>
            </div>
          </div>
        ) : (
          <div className={`ph-feed ${platform}`}>
            <div className="ph-head">
              <Avatar brand={brand} />
              <div>
                <b>{brand}</b>
                <div className="ph-meta">{platform === "x" ? `@${handle} · 1m` : platform === "linkedin" ? "Content hub · 1m · 🌐" : "Just now · 🌐"}</div>
              </div>
            </div>
            <Clamp text={caption} lines={platform === "x" ? 20 : 3} more={platform === "linkedin" ? "…see more" : "See more"} link={platform === "x" ? "#1d9bf0" : platform === "linkedin" ? "#0a66c2" : "#1877f2"} className="ph-text" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ph-img" src={feed} alt="Post picture" />
            <div className="ph-actions">{platform === "x" ? "💬   🔁   ♥   📊" : platform === "linkedin" ? "👍 Like   💬 Comment   🔁 Repost   ➤ Send" : "👍 Like   💬 Comment   ↗ Share"}</div>
          </div>
        )}
      </div>
    </div>
  )
}
