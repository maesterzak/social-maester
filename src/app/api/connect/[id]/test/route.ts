import { NextResponse } from "next/server"
import { testConnection } from "@/lib/connect"
import type { ConnectionId } from "@/lib/connections"

// Makes a harmless read call with the saved credentials.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ account: await testConnection((await params).id as ConnectionId) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
