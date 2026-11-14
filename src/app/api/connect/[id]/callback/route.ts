import { NextResponse } from "next/server"
import { finishLogin } from "@/lib/connect"
import type { ConnectionId } from "@/lib/connections"

// The platform sends the browser back here after login.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id as ConnectionId
  const back = (q: string) => NextResponse.redirect(new URL(`/settings?account=${id}&${q}`, req.url))
  try {
    const name = await finishLogin(id, new URL(req.url).searchParams)
    return name === null ? back("pick=1") : back(`connected=${encodeURIComponent(name)}`)
  } catch (e) {
    return back(`error=${encodeURIComponent((e as Error).message)}`)
  }
}
