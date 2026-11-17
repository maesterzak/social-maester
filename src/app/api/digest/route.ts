import { NextResponse } from "next/server"
import { z } from "zod"
import { buildDigestCaption } from "@/lib/caption"
import { getOpportunities } from "@/lib/opportunities"
import { PLATFORMS } from "@/lib/platforms"

const Body = z.object({ ids: z.array(z.string()).min(2).max(5), title: z.string().trim().min(1).max(120) })

// Default digest caption for every platform.
export async function POST(req: Request) {
  try {
    const { ids, title } = Body.parse(await req.json())
    const found = await getOpportunities(ids)
    const opps = ids.map((id) => found.get(id)).filter((o): o is NonNullable<typeof o> => !!o)
    if (opps.length < 2) return NextResponse.json({ error: "Fewer than 2 of these still exist" }, { status: 404 })
    return NextResponse.json(Object.fromEntries(PLATFORMS.map((p) => [p.id, buildDigestCaption(title, opps, p)])))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
