import { NextResponse } from "next/server"
import { z } from "zod"
import { buildCaption } from "@/lib/caption"
import { getOpportunity } from "@/lib/opportunities"
import { PLATFORMS } from "@/lib/platforms"

const Body = z.object({ ids: z.array(z.string()).max(5) })

// Default caption for every platform, per selected opportunity.
export async function POST(req: Request) {
  const { ids } = Body.parse(await req.json())
  const out: Record<string, Record<string, string>> = {}
  for (const id of ids) {
    const o = await getOpportunity(id)
    if (o) out[id] = Object.fromEntries(PLATFORMS.map((p) => [p.id, buildCaption(o, p)]))
  }
  return NextResponse.json(out)
}
