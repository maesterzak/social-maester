import fs from "node:fs"
import path from "node:path"
import { dataPath } from "@/lib/db"

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg",
}
const ALLOWED_DIRS = new Set(["music", "uploads", "media", "previews"])

/** Reads only when the browser asks for more and stops cleanly when it hangs up (seeking audio/video does that
 *  all the time). Node's stream-to-web adapter kept writing after a cancel and crashed with "Controller is already closed". */
function fileStream(file: string, start: number, end: number): ReadableStream<Uint8Array> {
  let fh: fs.promises.FileHandle | null = null
  let pos = start
  const close = async () => { const h = fh; fh = null; await h?.close() }
  return new ReadableStream<Uint8Array>({
    async start() { fh = await fs.promises.open(file, "r") },
    async pull(controller) {
      const len = Math.min(64 * 1024, end - pos + 1)
      const h = fh
      if (len <= 0 || !h) { await close(); controller.close(); return }
      const buf = new Uint8Array(len)
      const { bytesRead } = await h.read(buf, 0, len, pos)
      if (!bytesRead) { await close(); controller.close(); return }
      pos += bytesRead
      controller.enqueue(buf.subarray(0, bytesRead))
    },
    cancel: close,
  })
}

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
    return new Response(fileStream(file, start, end), { status: 206, headers: {
      "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1),
    } })
  }
  return new Response(fileStream(file, 0, size - 1), { headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(size) } })
}
