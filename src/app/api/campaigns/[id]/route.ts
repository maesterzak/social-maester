import { NextResponse } from "next/server"
import { campaignDetail } from "@/lib/campaigns"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const d = await campaignDetail(Number((await params).id))
  return d ? NextResponse.json(d) : NextResponse.json({ error: "Not found" }, { status: 404 })
}
