import { renderCardPng } from "@/lib/media/card"
import { getOpportunity } from "@/lib/opportunities"

// Rendered cards kept in memory for 10 minutes: each one otherwise costs a round trip to PathMaester's database.
const CACHE = new Map<string, { at: number; png: Uint8Array<ArrayBuffer> }>()
const TTL = 10 * 60_000

// Cached for 5 minutes in the browser: the swipe deck and phone preview show the same cards many times.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  const format = new URL(req.url).searchParams.get("format") === "story" ? "story" : "feed"
  const key = `${id}:${format}`
  let hit = CACHE.get(key)
  if (!hit || Date.now() - hit.at > TTL) {
    const o = await getOpportunity(id)
    if (!o) return new Response("Not found", { status: 404 })
    hit = { at: Date.now(), png: new Uint8Array(renderCardPng(o, format)) }
    CACHE.set(key, hit)
    if (CACHE.size > 400) CACHE.delete(CACHE.keys().next().value!)
  }
  return new Response(hit.png, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" } })
}
