import { NextResponse } from "next/server"
import { z } from "zod"
import { CampaignInput, createCampaign } from "@/lib/campaigns"
import { kick } from "@/lib/worker"

export async function POST(req: Request) {
  try {
    const id = await createCampaign(CampaignInput.parse(await req.json()))
    kick()
    return NextResponse.json({ id })
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : (e as Error).message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
