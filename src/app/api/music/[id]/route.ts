import { NextResponse } from "next/server"
import { deleteTrack } from "@/lib/library"

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await deleteTrack(Number((await params).id))
  return NextResponse.json({ ok: true })
}
