import { setting, type ConnectionId } from "../connections"
import { publishFacebook, publishInstagram } from "./meta"
import { publishLinkedIn } from "./linkedin"
import { publishTelegram } from "./telegram"
import { publishTikTok } from "./tiktok"
import { publishX } from "./x"
import type { PlatformId, PlatformInfo, Publisher } from "./types"

export type { PlatformId, PlatformInfo } from "./types"

export type PlatformDef = PlatformInfo & { connection: ConnectionId | null }

export const PLATFORMS: PlatformDef[] = [
  { id: "x", name: "X (Twitter)", media: "image", captionLimit: 280, connection: "x", envKeys: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"] },
  { id: "facebook", name: "Facebook Page", media: "image", captionLimit: 5000, connection: "meta", envKeys: ["FB_PAGE_ID", "FB_PAGE_TOKEN"] },
  { id: "linkedin", name: "LinkedIn", media: "image", captionLimit: 3000, connection: "linkedin", envKeys: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN"] },
  { id: "telegram", name: "Telegram channel", media: "image", captionLimit: 1024, connection: "telegram", envKeys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHANNEL_ID"] },
  { id: "whatsapp", name: "WhatsApp", media: "image", captionLimit: 4000, connection: null, envKeys: [], manualOnly: true },
  { id: "instagram", name: "Instagram Reels", media: "video", captionLimit: 2200, connection: "meta", envKeys: ["IG_USER_ID", "IG_ACCESS_TOKEN"], linksDead: true },
  { id: "tiktok", name: "TikTok", media: "video", captionLimit: 2200, connection: "tiktok", envKeys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN"], linksDead: true },
]

const PUBLISHERS: Record<PlatformId, Publisher> = {
  x: publishX, facebook: publishFacebook, linkedin: publishLinkedIn, telegram: publishTelegram,
  instagram: publishInstagram, tiktok: publishTikTok,
  whatsapp: async () => { throw new Error("WhatsApp has no posting API — use “Share myself”") },
}

export const isDryRun = () => ["1", "true", "yes"].includes((process.env.DRY_RUN ?? "").toLowerCase())

export const platformInfo = (id: string) => PLATFORMS.find((p) => p.id === id)

export function missingKeys(p: PlatformInfo): string[] {
  return p.envKeys.filter((k) => !setting(k))
}

/** usable = can be auto-posted through its API (any platform can be shared manually). */
export type PlatformStatus = PlatformDef & { missing: string[]; usable: boolean }
export function platformStatuses(): PlatformStatus[] {
  return PLATFORMS.map((p) => {
    const missing = missingKeys(p)
    return { ...p, missing, usable: !p.manualOnly && (missing.length === 0 || isDryRun()) }
  })
}

export function publisher(id: PlatformId): Publisher {
  return PUBLISHERS[id]
}
