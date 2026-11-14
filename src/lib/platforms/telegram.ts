import fs from "node:fs/promises"
import { env, fetchJson, PlatformError, type Publisher } from "./types"

// Telegram channel post via a bot that is an admin of the channel.
export const publishTelegram: Publisher = async ({ caption, file }) => {
  const chat = env("TELEGRAM_CHANNEL_ID")
  const form = new FormData()
  form.append("chat_id", chat)
  form.append("caption", caption)
  form.append("photo", new Blob([await fs.readFile(file)], { type: "image/png" }), "card.png")
  const { data } = await fetchJson<{ ok: boolean; description?: string; result?: { message_id: number } }>(
    `https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendPhoto`, { method: "POST", body: form }, "Telegram")
  if (!data.ok || !data.result) throw new PlatformError(`Telegram: ${data.description ?? "failed"}`)
  const id = String(data.result.message_id)
  const url = chat.startsWith("@") ? `https://t.me/${chat.slice(1)}/${id}` : undefined
  return { externalId: id, url }
}
