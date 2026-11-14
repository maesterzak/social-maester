import { NextResponse } from "next/server"
import { retryPost } from "@/lib/campaigns"
import { kick } from "@/lib/worker"

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const campaignId = retryPost(Number((await params).id))
    kick()
    return NextResponse.json({ campaignId })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
