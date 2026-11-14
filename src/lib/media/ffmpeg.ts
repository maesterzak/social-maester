import { spawn } from "node:child_process"

// ffmpeg from FFMPEG_PATH, else whatever `ffmpeg` is on PATH.
export const ffmpegBin = () => process.env.FFMPEG_PATH?.trim() || "ffmpeg"

export function runFfmpeg(args: string[], timeoutMs = 180_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegBin(), ["-hide_banner", "-nostdin", ...args], { windowsHide: true })
    let err = ""
    p.stderr.on("data", (d) => { err += d; if (err.length > 200_000) err = err.slice(-100_000) })
    const timer = setTimeout(() => p.kill("SIGKILL"), timeoutMs)
    p.on("error", (e) => { clearTimeout(timer); reject(new Error(`ffmpeg could not start (${e.message}). Install ffmpeg or set FFMPEG_PATH.`)) })
    p.on("close", (code) => {
      clearTimeout(timer)
      code === 0 ? resolve(err) : reject(new Error(`ffmpeg failed (${code}): ${err.trim().split("\n").slice(-4).join(" | ")}`))
    })
  })
}

/** Duration in seconds, read from ffmpeg's input banner. */
export async function probeDuration(file: string): Promise<number> {
  const out = await runFfmpeg(["-i", file, "-f", "null", "-t", "0", "-"]).catch((e: Error) => e.message)
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(out)
  if (!m) throw new Error("Could not read the audio duration — is this a valid audio file?")
  return +m[1] * 3600 + +m[2] * 60 + +m[3]
}

export async function ffmpegVersion(): Promise<string | null> {
  try {
    const out = await new Promise<string>((resolve, reject) => {
      const p = spawn(ffmpegBin(), ["-version"], { windowsHide: true })
      let s = ""
      p.stdout.on("data", (d) => (s += d))
      p.on("error", reject)
      p.on("close", () => resolve(s))
    })
    return out.split("\n")[0]?.trim() || null
  } catch {
    return null
  }
}
