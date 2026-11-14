import { NextResponse } from "next/server"
import { addTrack, listTracks } from "@/lib/library"

export async function GET() {
  return NextResponse.json(listTracks())
}

export async function POST(req: Request) {
  try {
    const f = (await req.formData()).get("file")
    if (!(f instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 })
    return NextResponse.json(await addTrack(f))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
