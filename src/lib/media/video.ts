import fs from "node:fs/promises"
import path from "node:path"
import { runFfmpeg } from "./ffmpeg"

// Vertical 1080x1920 slideshow: each picture is shown for `slideSeconds` with a crossfade between them,
// background music starts at `musicStart`, is trimmed to the video length and faded in/out.

export type VideoOptions = {
  slides: string[]
  out: string
  slideSeconds: number
  music?: { file: string; start: number; volume: number } | null
}

const W = 1080
const H = 1920
const FADE = 0.6

export async function renderSlideshow({ slides, out, slideSeconds, music }: VideoOptions): Promise<{ file: string; duration: number }> {
  if (!slides.length) throw new Error("No pictures to put in the video")
  await fs.mkdir(path.dirname(out), { recursive: true })
  // A single picture still needs enough time for the music to be heard.
  const each = slides.length === 1 ? Math.max(slideSeconds, 8) : slideSeconds
  const total = slides.length * each - (slides.length - 1) * FADE

  const args: string[] = []
  for (const s of slides) args.push("-loop", "1", "-framerate", "30", "-t", String(each), "-i", s)
  // Loop the track in case it is shorter than the video.
  if (music) args.push("-stream_loop", "-1", "-ss", String(music.start), "-i", music.file)
  else args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100")

  const f: string[] = []
  slides.forEach((_, i) => {
    // Fit the picture, fill the rest with a blurred, zoomed copy of itself.
    f.push(`[${i}:v]split=2[f${i}][b${i}]`)
    f.push(`[b${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=30:2,eq=brightness=-0.15[bb${i}]`)
    f.push(`[f${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease[ff${i}]`)
    f.push(`[bb${i}][ff${i}]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30,format=yuv420p[v${i}]`)
  })
  let last = "v0"
  for (let i = 1; i < slides.length; i++) {
    const offset = (i * each - i * FADE).toFixed(2)
    f.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset}[x${i}]`)
    last = `x${i}`
  }
  const a = slides.length
  const vol = music ? Math.max(0, Math.min(1.5, music.volume)) : 1
  const fadeOut = Math.max(0, total - 1.5).toFixed(2)
  f.push(`[${a}:a]atrim=0:${total.toFixed(2)},asetpts=PTS-STARTPTS,volume=${vol},afade=t=in:d=0.8,afade=t=out:st=${fadeOut}:d=1.5,aformat=sample_rates=44100:channel_layouts=stereo[aout]`)

  args.push(
    "-filter_complex", f.join(";"),
    "-map", `[${last}]`, "-map", "[aout]",
    "-t", total.toFixed(2),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    "-y", out,
  )
  await runFfmpeg(args)
  return { file: out, duration: total }
}
