import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { dataPath } from "@/lib/db"

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg",
}
const ALLOWED_DIRS = new Set(["music", "uploads", "media", "previews"])

// Serves uploaded and rendered media from data/, with Range support so audio/video can seek.
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path
  if (!ALLOWED_DIRS.has(parts[0])) return new Response("Not found", { status: 404 })
  let file: string
  try { file = dataPath(...parts) } catch { return new Response("Bad path", { status: 400 }) }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("Not found", { status: 404 })

  const size = fs.statSync(file).size
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream"
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "")
  if (range && (range[1] || range[2])) {
    const start = range[1] ? +range[1] : Math.max(0, size - +range[2])
    const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream
    return new Response(stream, { status: 206, headers: {
      "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1),
    } })
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream
  return new Response(stream, { headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(size) } })
}
