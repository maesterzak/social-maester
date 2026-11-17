import fs from "node:fs/promises"
import path from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { audienceHeadline, formatDeadline, moneyLine, placeLine } from "../caption"
import type { Opportunity } from "../opportunities"

// Post card drawn as SVG and rasterised with resvg. "feed" = 4:5 for X/Facebook/LinkedIn/Telegram,
// "story" = 9:16 used as the first slide of the Reels/TikTok video. No emoji: resvg can't draw colour fonts.

export type CardFormat = "feed" | "story"
const SIZE: Record<CardFormat, [number, number]> = { feed: [1080, 1350], story: [1080, 1920] }
const FONT = "Segoe UI, Arial, Helvetica, DejaVu Sans, sans-serif"

const THEME = {
  JOB: { from: "#0c2e22", to: "#1f6f4a", accent: "#7ee2a8", label: "JOB OPPORTUNITY" },
  SCHOLARSHIP: { from: "#141d4a", to: "#3346a8", accent: "#ffd166", label: "SCHOLARSHIP" },
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!)

/** Greedy word wrap by estimated glyph width; last line gets an ellipsis if text is cut. */
function wrap(text: string, fontSize: number, maxWidth: number, maxLines: number, widthFactor = 0.53): string[] {
  const perLine = Math.max(8, Math.floor(maxWidth / (fontSize * widthFactor)))
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length <= perLine) { cur = next; continue }
    if (cur) lines.push(cur)
    cur = w.length > perLine ? w.slice(0, perLine - 1) + "…" : w
    if (lines.length === maxLines) break
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  if (lines.length === maxLines && lines.join(" ").length < text.length - 1) {
    const last = lines[maxLines - 1]
    lines[maxLines - 1] = (last.length > perLine - 1 ? last.slice(0, perLine - 1) : last).replace(/[\s,.;:–-]+$/, "") + "…"
  }
  return lines.slice(0, maxLines)
}

function textBlock(lines: string[], x: number, y: number, size: number, lineHeight: number, attrs: string): string {
  return `<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${lines
    .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${esc(l)}</tspan>`).join("")}</text>`
}

export function cardSvg(o: Opportunity, format: CardFormat): string {
  const [W, H] = SIZE[format]
  // The pill says who the post is for ("REMOTE JOB", "NO EXPERIENCE NEEDED", "FULLY FUNDED SCHOLARSHIP").
  const t = { ...THEME[o.kind], label: audienceHeadline(o).text }
  const pad = 80
  const inner = W - pad * 2
  const story = format === "story"
  const brand = process.env.BRAND_NAME?.trim() || "PathMaester"

  let y = story ? 400 : 150
  const parts: string[] = []

  // label pill
  const labelW = t.label.length * 26 + 64
  parts.push(`<rect x="${pad}" y="${y - 52}" width="${labelW}" height="70" rx="35" fill="${t.accent}"/>`)
  parts.push(`<text x="${pad + 32}" y="${y - 6}" font-size="34" font-weight="700" letter-spacing="3" fill="${t.from}">${t.label}</text>`)
  y += 130

  const titleSize = o.title.length > 60 ? 70 : 82
  const title = wrap(o.title, titleSize, inner, story ? 5 : 4, 0.56)
  parts.push(textBlock(title, pad, y, titleSize, titleSize * 1.15, `font-weight="800" fill="#ffffff"`))
  y += (title.length - 1) * titleSize * 1.15 + 80

  const org = wrap(o.organization, 46, inner, 2)
  parts.push(textBlock(org, pad, y, 46, 56, `font-weight="600" fill="${t.accent}"`))
  y += (org.length - 1) * 56 + (story ? 110 : 80)

  const rows: [string, string | null][] = [
    ["Location", placeLine(o) || null],
    [o.kind === "SCHOLARSHIP" ? "Award" : "Pay", moneyLine(o)],
    ["Type", o.kind === "SCHOLARSHIP" ? o.category : o.employmentType],
    ["Deadline", formatDeadline(o.deadline)],
  ]
  for (const [label, value] of rows) {
    if (!value) continue
    const v = wrap(value, 40, inner - 40, 2)
    parts.push(`<rect x="${pad}" y="${y - 58}" width="8" height="${70 + (v.length - 1) * 50}" rx="4" fill="${t.accent}"/>`)
    parts.push(`<text x="${pad + 36}" y="${y - 26}" font-size="26" font-weight="600" letter-spacing="2" fill="#ffffff" fill-opacity="0.65">${label.toUpperCase()}</text>`)
    parts.push(textBlock(v, pad + 36, y + 18, 40, 50, `font-weight="600" fill="#ffffff"`))
    y += 130 + (v.length - 1) * 50
  }

  const footerY = H - (story ? 220 : 110)
  if (o.summary) {
    const room = Math.floor((footerY - 90 - y) / 50)
    if (room >= 1) {
      const s = wrap(o.summary, 36, inner, Math.min(room, story ? 6 : 3))
      parts.push(textBlock(s, pad, y + 20, 36, 50, `fill="#ffffff" fill-opacity="0.85"`))
    }
  }

  parts.push(`<line x1="${pad}" y1="${footerY - 50}" x2="${W - pad}" y2="${footerY - 50}" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2"/>`)
  parts.push(`<text x="${pad}" y="${footerY + 10}" font-size="40" font-weight="800" fill="#ffffff">${esc(brand)}</text>`)
  parts.push(`<text x="${W - pad}" y="${footerY + 10}" font-size="32" font-weight="600" text-anchor="end" fill="${t.accent}">${story ? "Apply: link in bio" : "Apply: link in caption"}</text>`)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.from}"/><stop offset="1" stop-color="${t.to}"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<circle cx="${W - 60}" cy="80" r="260" fill="${t.accent}" fill-opacity="0.08"/>
<circle cx="${W - 140}" cy="${H - 340}" r="180" fill="#ffffff" fill-opacity="0.04"/>
${parts.join("\n")}
</svg>`
}

export function renderCardPng(o: Opportunity, format: CardFormat): Buffer {
  const svg = cardSvg(o, format)
  const r = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Arial" } })
  return r.render().asPng()
}

export async function writeCard(o: Opportunity, format: CardFormat, file: string): Promise<string> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, renderCardPng(o, format))
  return file
}

// ---------- Top 5 digest: one card listing several opportunities ----------

const MIXED = { from: "#1a1238", to: "#4a2fd0", accent: "#d4ff3a", label: "TOP" }

/** The colours of the kind most items share (jobs green, scholarships blue), else a neutral violet. */
function digestTheme(opps: Opportunity[]) {
  const jobs = opps.filter((o) => o.kind === "JOB").length
  if (jobs === opps.length) return THEME.JOB
  if (jobs === 0) return THEME.SCHOLARSHIP
  return MIXED
}

export function digestCardSvg(title: string, opps: Opportunity[], format: CardFormat): string {
  const [W, H] = SIZE[format]
  const t = digestTheme(opps)
  const story = format === "story"
  const pad = 80
  const inner = W - pad * 2
  const brand = process.env.BRAND_NAME?.trim() || "PathMaester"
  const parts: string[] = []

  let y = story ? 300 : 150
  const label = `TOP ${opps.length}`
  const labelW = label.length * 28 + 64
  parts.push(`<rect x="${pad}" y="${y - 52}" width="${labelW}" height="70" rx="35" fill="${t.accent}"/>`)
  parts.push(`<text x="${pad + 32}" y="${y - 6}" font-size="36" font-weight="800" letter-spacing="3" fill="${t.from}">${label}</text>`)
  y += 118

  const titleSize = story ? 76 : 64
  const head = wrap(title, titleSize, inner, 3, 0.56)
  parts.push(textBlock(head, pad, y, titleSize, titleSize * 1.12, `font-weight="800" fill="#ffffff"`))
  y += (head.length - 1) * titleSize * 1.12 + (story ? 90 : 64)

  const footerY = H - (story ? 220 : 110)
  const rowH = Math.min(story ? 230 : 190, (footerY - 70 - y) / opps.length)
  const nameSize = rowH > 170 ? 38 : 34
  opps.forEach((o, i) => {
    const top = y + i * rowH
    const cy = top + 30
    parts.push(`<circle cx="${pad + 30}" cy="${cy}" r="30" fill="${t.accent}"/>`)
    parts.push(`<text x="${pad + 30}" y="${cy + 12}" font-size="34" font-weight="800" text-anchor="middle" fill="${t.from}">${i + 1}</text>`)
    const name = wrap(o.title, nameSize, inner - 100, rowH > 150 ? 2 : 1, 0.55)
    parts.push(textBlock(name, pad + 90, top + 40, nameSize, nameSize * 1.15, `font-weight="700" fill="#ffffff"`))
    const sub = [o.organization, formatDeadline(o.deadline) && `Deadline ${formatDeadline(o.deadline)}`].filter(Boolean).join(" · ")
    const subY = top + 40 + (name.length - 1) * nameSize * 1.15 + 44
    parts.push(textBlock(wrap(sub, 26, inner - 100, 1), pad + 90, subY, 26, 32, `font-weight="600" fill="${t.accent}" fill-opacity="0.9"`))
    if (i < opps.length - 1) parts.push(`<line x1="${pad + 90}" y1="${top + rowH - 18}" x2="${W - pad}" y2="${top + rowH - 18}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>`)
  })

  parts.push(`<line x1="${pad}" y1="${footerY - 50}" x2="${W - pad}" y2="${footerY - 50}" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2"/>`)
  parts.push(`<text x="${pad}" y="${footerY + 10}" font-size="40" font-weight="800" fill="#ffffff">${esc(brand)}</text>`)
  parts.push(`<text x="${W - pad}" y="${footerY + 10}" font-size="32" font-weight="600" text-anchor="end" fill="${t.accent}">${story ? "Links: in bio" : "Links in the caption"}</text>`)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.from}"/><stop offset="1" stop-color="${t.to}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<circle cx="${W - 40}" cy="60" r="280" fill="${t.accent}" fill-opacity="0.09"/>
<circle cx="${W - 120}" cy="${H - 300}" r="200" fill="#ffffff" fill-opacity="0.04"/>
${parts.join("\n")}
</svg>`
}

export function renderDigestPng(title: string, opps: Opportunity[], format: CardFormat): Buffer {
  const r = new Resvg(digestCardSvg(title, opps, format), { font: { loadSystemFonts: true, defaultFontFamily: "Arial" } })
  return r.render().asPng()
}

export async function writeDigestCard(title: string, opps: Opportunity[], format: CardFormat, file: string): Promise<string> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, renderDigestPng(title, opps, format))
  return file
}

/** Video slides for a digest: the TOP-N cover, then each opportunity's own vertical card. */
export async function writeDigestSlides(title: string, opps: Opportunity[], dir: string): Promise<string[]> {
  const slides = [await writeDigestCard(title, opps, "story", path.join(dir, "digest-cover.png"))]
  for (const [i, o] of opps.entries()) slides.push(await writeCard(o, "story", path.join(dir, `digest-${i + 1}.png`)))
  return slides
}
