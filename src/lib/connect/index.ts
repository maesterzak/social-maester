import { callbackUrl, getConnection, removeConnection, type ConnectionId } from "../connections"
import { run } from "../db"
import * as linkedin from "./linkedin"
import * as meta from "./meta"
import * as telegram from "./telegram"
import * as tiktok from "./tiktok"
import * as x from "./x"

// One entry per account to connect. Meta covers Facebook Page + Instagram with one login.

export type ConnectDef = {
  id: ConnectionId
  name: string
  covers: string
  /** .env keys of the developer app, needed before the Connect button can work. */
  appKeys: string[]
  /** "oauth" = Connect button; "form" = paste values (Telegram). */
  kind: "oauth" | "form"
  devUrl: string
  steps: string[]
}

export const CONNECTIONS: ConnectDef[] = [
  {
    id: "meta", name: "Facebook + Instagram", covers: "Facebook Page photos, Instagram Reels", kind: "oauth",
    appKeys: ["META_APP_ID", "META_APP_SECRET"], devUrl: "https://developers.facebook.com/apps",
    steps: [
      "Create an app (type Business) and add the “Facebook Login for Business” and “Instagram” products.",
      "Under Facebook Login → Settings, add the redirect URL shown below to “Valid OAuth Redirect URIs”.",
      "Put the App ID and App secret in .env as META_APP_ID / META_APP_SECRET.",
      "Instagram must be a professional (Business/Creator) account linked to your Facebook Page.",
      "In development mode only you (app admins/testers) can connect, which is all you need.",
    ],
  },
  {
    id: "tiktok", name: "TikTok", covers: "TikTok videos", kind: "oauth",
    appKeys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"], devUrl: "https://developers.tiktok.com/apps",
    steps: [
      "Create an app, add the “Login Kit” and “Content Posting API” products (turn on Direct Post), scopes user.info.basic and video.publish.",
      "TikTok only accepts https redirect URLs: set APP_URL in .env to an https address (a tunnel to this app, or the deployed site) and add the redirect URL below.",
      "Put the Client key and Client secret in .env as TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET.",
      "Add your TikTok account as a target user in the sandbox. Until TikTok audits the app, posts are private (SELF_ONLY).",
    ],
  },
  {
    id: "x", name: "X (Twitter)", covers: "X posts with picture", kind: "oauth",
    appKeys: ["X_API_KEY", "X_API_SECRET"], devUrl: "https://developer.x.com/en/portal/dashboard",
    steps: [
      "Create a project + app. Posting needs a paid API plan (or pay-per-use credits).",
      "User authentication settings: permissions “Read and write”, type “Web App”, add the callback URL below.",
      "Put the API Key and API Key Secret (consumer keys) in .env as X_API_KEY / X_API_SECRET.",
    ],
  },
  {
    id: "linkedin", name: "LinkedIn", covers: "LinkedIn posts with picture", kind: "oauth",
    appKeys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"], devUrl: "https://www.linkedin.com/developers/apps",
    steps: [
      "Create an app (it must be linked to a LinkedIn company page you admin).",
      "Products: add “Sign In with LinkedIn using OpenID Connect” and “Share on LinkedIn”.",
      "Auth → Authorized redirect URLs: add the URL below.",
      "Put the Client ID and Client Secret in .env as LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET. Tokens last 60 days.",
    ],
  },
  {
    id: "telegram", name: "Telegram channel", covers: "Telegram channel posts", kind: "form",
    appKeys: [], devUrl: "https://t.me/BotFather",
    steps: [
      "In Telegram, message @BotFather → /newbot, and copy the bot token.",
      "Add the bot to your channel as an administrator with “Post messages”.",
      "Paste the token and the channel (@channelname, or -100… id for a private channel) below.",
    ],
  },
]

const FLOWS = { x, meta, linkedin, tiktok } as const

export const connectDef = (id: string) => CONNECTIONS.find((c) => c.id === id)

export function missingAppKeys(def: ConnectDef): string[] {
  return def.appKeys.filter((k) => !process.env[k]?.trim())
}

export async function startLogin(id: ConnectionId): Promise<string> {
  const def = connectDef(id)
  if (!def || def.kind !== "oauth") throw new Error("This account has no login button")
  const missing = missingAppKeys(def)
  if (missing.length) throw new Error(`Add ${missing.join(", ")} to .env and restart first`)
  return FLOWS[id as keyof typeof FLOWS].start()
}

/** Finishes a login. Returns the account name, or null when Meta needs a Page chosen. */
export async function finishLogin(id: ConnectionId, q: URLSearchParams): Promise<string | null> {
  const flow = FLOWS[id as keyof typeof FLOWS]
  if (!flow) throw new Error("Unknown account")
  return flow.callback(q)
}

export async function testConnection(id: ConnectionId): Promise<string> {
  if (id === "telegram") return telegram.test()
  return FLOWS[id as keyof typeof FLOWS].test()
}

export function disconnect(id: ConnectionId) {
  removeConnection(id)
  if (id === "tiktok") run("DELETE FROM kv WHERE key = 'tiktok_tokens'")
}

export type ConnectStatus = ConnectDef & {
  callback: string; missingApp: string[]; account: string | null; connectedAt: number | null
  expiresAt: number | null; fromEnv: boolean; httpsProblem: boolean
}

export function connectStatuses(envReady: (id: ConnectionId) => boolean): ConnectStatus[] {
  return CONNECTIONS.map((d) => {
    const c = getConnection(d.id)
    return {
      ...d, callback: callbackUrl(d.id), missingApp: missingAppKeys(d), account: c?.account ?? null,
      connectedAt: c?.connected_at ?? null, expiresAt: c?.expires_at ?? null,
      fromEnv: !c && envReady(d.id), httpsProblem: d.id === "tiktok" && tiktok.needsHttps(),
    }
  })
}

export { meta as metaFlow, telegram as telegramFlow }
