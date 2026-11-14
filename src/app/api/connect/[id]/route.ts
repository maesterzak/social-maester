import { NextResponse } from "next/server"
import { z } from "zod"
import { connectDef, disconnect, metaFlow, telegramFlow } from "@/lib/connect"
import type { ConnectionId } from "@/lib/connections"

const Telegram = z.object({ token: z.string(), channel: z.string() })
const MetaPick = z.object({ pageId: z.string() })

// POST: Telegram's pasted bot token/channel, or the chosen Facebook Page. DELETE: disconnect.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  try {
    const body = await req.json()
    if (id === "telegram") {
      const b = Telegram.parse(body)
      return NextResponse.json({ account: await telegramFlow.save(b.token, b.channel) })
    }
    if (id === "meta") return NextResponse.json({ account: metaFlow.choosePage(MetaPick.parse(body).pageId) })
    return NextResponse.json({ error: "Not supported" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  if (!connectDef(id)) return NextResponse.json({ error: "Unknown account" }, { status: 404 })
  disconnect(id as ConnectionId)
  return NextResponse.json({ ok: true })
}
