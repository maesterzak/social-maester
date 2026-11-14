import fs from "node:fs"
import { NextResponse } from "next/server"
import { z } from "zod"
import { dataPath } from "@/lib/db"
import { getTrack, getUpload } from "@/lib/library"
import { writeCard } from "@/lib/media/card"
import { renderSlideshow } from "@/lib/media/video"
import { getOpportunity } from "@/lib/opportunities"

const Body = z.object({
  opportunityId: z.string(),
  extraUploadIds: z.array(z.number().int()).max(8).default([]),
  music: z.object({ id: z.number().int(), start: z.number().min(0), volume: z.number().min(0).max(1.5) }).nullable(),
  slideSeconds: z.number().min(2).max(15).default(4),
})

// Renders the Reels/TikTok video exactly as it will be posted, so the music can be checked first.
export async function POST(req: Request) {
  try {
    const b = Body.parse(await req.json())
    const o = await getOpportunity(b.opportunityId)
    if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const stamp = Date.now()
    fs.rmSync(dataPath("previews"), { recursive: true, force: true }) // keep only the latest preview
    const story = await writeCard(o, "story", dataPath(`previews/${stamp}-story.png`))
    const extras = b.extraUploadIds.map((id) => getUpload(id)).filter(Boolean).map((u) => dataPath(u!.file))
    const track = b.music ? getTrack(b.music.id) : undefined
    const rel = `previews/${stamp}-preview.mp4`
    const { duration } = await renderSlideshow({
      slides: [story, ...extras], out: dataPath(rel), slideSeconds: b.slideSeconds,
      music: track && b.music ? { file: dataPath(track.file), start: b.music.start, volume: b.music.volume } : null,
    })
    return NextResponse.json({ url: `/api/files/${rel}`, duration })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
