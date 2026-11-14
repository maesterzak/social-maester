import { NextResponse } from "next/server"
import { startLogin } from "@/lib/connect"
import type { ConnectionId } from "@/lib/connections"

// Sends the browser to the platform's login page.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id as ConnectionId
  try {
    return NextResponse.redirect(await startLogin(id))
  } catch (e) {
    return NextResponse.redirect(new URL(`/settings?account=${id}&error=${encodeURIComponent((e as Error).message)}`, req.url))
  }
}
