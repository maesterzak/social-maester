import { renderDigestPng } from "@/lib/media/card"
import { getOpportunities } from "@/lib/opportunities"

// The TOP-N digest picture: /api/digest/card?ids=a,b,c&title=…&format=story. Kept in memory for 10 minutes.
const CACHE = new Map<string, { at: number; png: Uint8Array<ArrayBuffer> }>()
const TTL = 10 * 60_000

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const ids = (q.get("ids") ?? "").split(",").filter(Boolean).slice(0, 5)
  const title = (q.get("title") ?? "").slice(0, 120) || `Top ${ids.length} opportunities`
  const format = q.get("format") === "story" ? "story" : "feed"
  if (ids.length < 2) return new Response("Need at least 2 ids", { status: 400 })
  const key = `${ids.join(",")}|${title}|${format}`
  let hit = CACHE.get(key)
  if (!hit || Date.now() - hit.at > TTL) {
    const found = await getOpportunities(ids)
    const opps = ids.map((id) => found.get(id)).filter((o): o is NonNullable<typeof o> => !!o)
    if (opps.length < 2) return new Response("Not found", { status: 404 })
    hit = { at: Date.now(), png: new Uint8Array(renderDigestPng(title, opps, format)) }
    CACHE.set(key, hit)
    if (CACHE.size > 200) CACHE.delete(CACHE.keys().next().value!)
  }
  return new Response(hit.png, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" } })
}
