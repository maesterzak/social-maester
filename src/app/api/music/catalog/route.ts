import { NextResponse } from "next/server"
import { addCatalogTracks, catalogStatus, listTracks } from "@/lib/library"

export async function GET() {
  return NextResponse.json({ catalog: catalogStatus(), tracks: listTracks() })
}

// Body: { keys?: string[] } — downloads those catalog tracks (all missing ones when keys is omitted).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { keys?: string[] }
  const result = await addCatalogTracks(Array.isArray(body.keys) ? body.keys : undefined)
  return NextResponse.json({ ...result, catalog: catalogStatus(), tracks: listTracks() })
}
