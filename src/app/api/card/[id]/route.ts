import { renderCardPng } from "@/lib/media/card"
import { getOpportunity } from "@/lib/opportunities"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await getOpportunity((await params).id)
  if (!o) return new Response("Not found", { status: 404 })
  const format = new URL(req.url).searchParams.get("format") === "story" ? "story" : "feed"
  return new Response(new Uint8Array(renderCardPng(o, format)), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } })
}
