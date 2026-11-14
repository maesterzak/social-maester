import { NextResponse } from "next/server"
import { z } from "zod"
import { markPost } from "@/lib/campaigns"

const Body = z.object({ shared: z.boolean() })

// Manual sharing: the user ticks a post as shared (or un-ticks it).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { shared } = Body.parse(await req.json())
    return NextResponse.json({ campaignId: markPost(Number((await params).id), shared) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
