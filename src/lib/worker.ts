import fs from "node:fs"
import { all, dataPath, run } from "./db"
import { campaignItems, campaignPosts, getCampaign, type Item } from "./campaigns"
import { getTrack, getUpload } from "./library"
import { getOpportunity } from "./opportunities"
import { writeCard } from "./media/card"
import { renderSlideshow } from "./media/video"
import { platformInfo, publisher, missingKeys, type PlatformId } from "./platforms"
import { sleep } from "./platforms/types"

// In-process queue: one campaign at a time, posts one after another. kick() is safe to call often.

const g = globalThis as unknown as { __socialWorker?: { running: boolean; again: boolean } }
const state = (g.__socialWorker ??= { running: false, again: false })

export function kick() {
  if (state.running) { state.again = true; return }
  state.running = true
  void loop().finally(() => { state.running = false })
}

async function loop() {
  do {
    state.again = false
    for (const { id } of all<{ id: number }>("SELECT id FROM campaigns WHERE status IN ('queued','running') ORDER BY id")) {
      await processCampaign(id).catch((e) => console.error(`[worker] campaign ${id}:`, e))
    }
  } while (state.again)
}

/** After a restart: posts caught mid-upload may or may not have gone out, so don't resend them blindly. */
export function recover() {
  run("UPDATE posts SET status = 'failed', error = 'Interrupted by a restart — check the platform before retrying', updated_at = ? WHERE status = 'posting'", Date.now())
  run("UPDATE posts SET status = 'queued', updated_at = ? WHERE status = 'rendering'", Date.now())
}

const mediaRel = (campaignId: number, itemId: number, name: string) => `media/c${campaignId}/i${itemId}-${name}`

async function renderItem(c: NonNullable<ReturnType<typeof getCampaign>>, item: Item, needImage: boolean, needVideo: boolean) {
  const o = await getOpportunity(item.opportunity_id)
  if (!o) throw new Error("This job/scholarship no longer exists")
  if (needImage && !(item.image_file && fs.existsSync(dataPath(item.image_file)))) {
    const rel = mediaRel(c.id, item.id, "feed.png")
    await writeCard(o, "feed", dataPath(rel))
    run("UPDATE campaign_items SET image_file = ? WHERE id = ?", rel, item.id)
    item.image_file = rel
  }
  if (needVideo && !(item.video_file && fs.existsSync(dataPath(item.video_file)))) {
    const story = await writeCard(o, "story", dataPath(mediaRel(c.id, item.id, "story.png")))
    const extras = (JSON.parse(item.extra_upload_ids) as number[])
      .map((id) => getUpload(id)).filter((u) => u && fs.existsSync(dataPath(u.file))).map((u) => dataPath(u!.file))
    const track = c.music_id ? getTrack(c.music_id) : undefined
    const rel = mediaRel(c.id, item.id, "video.mp4")
    await renderSlideshow({
      slides: [story, ...extras],
      out: dataPath(rel),
      slideSeconds: c.slide_seconds,
      music: track ? { file: dataPath(track.file), start: c.music_start, volume: c.music_volume } : null,
    })
    run("UPDATE campaign_items SET video_file = ? WHERE id = ?", rel, item.id)
    item.video_file = rel
  }
}

async function processCampaign(id: number) {
  const c = getCampaign(id)
  if (!c) return
  run("UPDATE campaigns SET status = 'running' WHERE id = ?", id)
  const posts = campaignPosts(id)

  for (const item of campaignItems(id)) {
    const queued = posts.filter((p) => p.item_id === item.id && p.status === "queued")
    if (!queued.length) continue
    // Manual sharing always gets the picture too (handy to paste anywhere).
    const needImage = c.mode === "manual" || queued.some((p) => platformInfo(p.platform)?.media === "image")
    const needVideo = queued.some((p) => platformInfo(p.platform)?.media === "video")

    for (const p of queued) run("UPDATE posts SET status = 'rendering', updated_at = ? WHERE id = ?", Date.now(), p.id)
    try {
      await renderItem(c, item, needImage, needVideo)
      run("UPDATE campaign_items SET error = NULL WHERE id = ?", item.id)
    } catch (e) {
      const msg = `Couldn't make the picture/video: ${(e as Error).message}`
      run("UPDATE campaign_items SET error = ? WHERE id = ?", msg, item.id)
      for (const p of queued) run("UPDATE posts SET status = 'failed', error = ?, updated_at = ? WHERE id = ?", msg, Date.now(), p.id)
      continue
    }

    if (c.mode === "manual") {
      // Nothing is sent: the user shares from the prepared tabs and marks each post done.
      for (const p of queued) run("UPDATE posts SET status = 'ready', updated_at = ? WHERE id = ?", Date.now(), p.id)
      continue
    }

    for (const p of queued) {
      const info = platformInfo(p.platform)!
      const file = info.media === "video" ? item.video_file : item.image_file
      run("UPDATE posts SET status = 'posting', updated_at = ? WHERE id = ?", Date.now(), p.id)
      try {
        if (!file) throw new Error("Media file missing")
        let result: { externalId: string; url?: string }
        if (p.dry_run) {
          await sleep(500)
          result = { externalId: `dry-${p.id}` }
        } else {
          const missing = missingKeys(info)
          if (missing.length) throw new Error(`${info.name} isn't set up (missing ${missing.join(", ")})`)
          result = await publisher(p.platform as PlatformId)({ caption: p.caption, title: item.title, file: dataPath(file) })
        }
        run("UPDATE posts SET status = 'done', external_id = ?, url = ?, error = NULL, updated_at = ? WHERE id = ?",
          result.externalId, result.url ?? null, Date.now(), p.id)
      } catch (e) {
        run("UPDATE posts SET status = 'failed', error = ?, updated_at = ? WHERE id = ?", (e as Error).message.slice(0, 1000), Date.now(), p.id)
      }
    }
  }

  const after = campaignPosts(id)
  if (after.some((p) => p.status === "queued")) return // retried meanwhile; next loop picks it up
  const failed = after.filter((p) => p.status === "failed").length
  if (c.mode === "manual") {
    run("UPDATE campaigns SET status = ? WHERE id = ?", failed ? "failed" : "ready", id)
    return
  }
  const status = failed === 0 ? "done" : failed === after.length ? "failed" : "partial"
  run("UPDATE campaigns SET status = ?, finished_at = ? WHERE id = ?", status, Date.now(), id)
}
