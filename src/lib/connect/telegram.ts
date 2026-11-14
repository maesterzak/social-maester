import { saveConnection } from "../connections"
import { env, fetchJson, PlatformError } from "../platforms/types"

// Telegram has no login: paste the bot token and channel; we check the bot can post there before saving.

type Tg<T> = { ok: boolean; result?: T; description?: string }

async function tg<T>(token: string, method: string, params: Record<string, string> = {}): Promise<T> {
  const { data } = await fetchJson<Tg<T>>(`https://api.telegram.org/bot${token}/${method}?${new URLSearchParams(params)}`, {}, "Telegram")
    .catch((e: Error) => { throw new PlatformError(e.message.replace(token, "…")) })
  if (!data.ok || !data.result) throw new PlatformError(`Telegram: ${data.description ?? "failed"}`)
  return data.result
}

async function check(token: string, channel: string): Promise<string> {
  const bot = await tg<{ id: number; username: string }>(token, "getMe")
  const chat = await tg<{ title?: string; username?: string }>(token, "getChat", { chat_id: channel })
  const member = await tg<{ status: string; can_post_messages?: boolean }>(token, "getChatMember", { chat_id: channel, user_id: String(bot.id) })
  if (member.status !== "administrator" && member.status !== "creator") throw new PlatformError(`@${bot.username} isn't an admin of that channel — add it as an admin with “Post messages”`)
  if (member.can_post_messages === false) throw new PlatformError(`@${bot.username} is an admin but can't post messages — turn on “Post messages”`)
  return `${chat.title ?? channel} (via @${bot.username})`
}

export async function save(token: string, channel: string): Promise<string> {
  token = token.trim()
  channel = channel.trim()
  if (!/^\d+:[\w-]{20,}$/.test(token)) throw new Error("That doesn't look like a bot token (from @BotFather, like 123456:ABC…)")
  if (!channel) throw new Error("Enter the channel (@channelname or its numeric id)")
  const name = await check(token, channel)
  saveConnection("telegram", name, { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHANNEL_ID: channel })
  return name
}

export const test = () => check(env("TELEGRAM_BOT_TOKEN"), env("TELEGRAM_CHANNEL_ID"))
