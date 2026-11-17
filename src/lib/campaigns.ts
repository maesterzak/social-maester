import { z } from "zod"
import { all, db, get, run } from "./db"
import { digestLink, shareLink } from "./caption"
import { getOpportunities } from "./opportunities"
import { getTrack, getUpload } from "./library"
import { isDryRun, platformStatuses, type PlatformId } from "./platforms"

export const MAX_PER_CAMPAIGN = 3
export const MAX_PER_DIGEST = 5

const platformIds = ["x", "facebook", "linkedin", "telegram", "whatsapp", "instagram", "tiktok", "youtube"] as const

export const CampaignInput = z.object({
  /** auto = post through the APIs; manual = make the media, then the user shares from prepared tabs. */
  mode: z.enum(["auto", "manual"]).default("auto"),
  platforms: z.array(z.enum(platformIds)).min(1, "Pick at least one platform"),
  items: z.array(z.object({
    opportunityId: z.string().min(1),
    extraUploadIds: z.array(z.number().int()).max(8).default([]),
    // Empty for a digest: its one caption per platform is in `digest.captions`.
    captions: z.record(z.string(), z.string().min(1, "Caption can't be empty").max(5000)).default({}),
  })).min(1, "Select at least one job or scholarship").max(MAX_PER_DIGEST, `At most ${MAX_PER_DIGEST} at once`),
  /** Present = a Top 5 digest: one post per platform listing every item. */
  digest: z.object({
    title: z.string().trim().min(3, "Give the digest a title").max(120),
    captions: z.record(z.string(), z.string().min(1, "Caption can't be empty").max(5000)),
  }).optional(),
  music: z.object({ id: z.number().int(), start: z.number().min(0), volume: z.number().min(0).max(1.5) }).nullable(),
  slideSeconds: z.number().min(2).max(15).default(4),
})
export type CampaignInput = z.infer<typeof CampaignInput>

export type Post = {
  id: number; item_id: number; opportunity_id: string; platform: PlatformId; caption: string; status: string
  external_id: string | null; url: string | null; error: string | null; dry_run: number; updated_at: number
}
export type Item = {
  id: number; campaign_id: number; opportunity_id: string; title: string; extra_upload_ids: string
  image_file: string | null; video_file: string | null; error: string | null
}
export type Campaign = {
  id: number; status: string; music_id: number | null; music_start: number; music_volume: number
  slide_seconds: number; created_at: number; finished_at: number | null; mode: "auto" | "manual"
  kind: "single" | "digest"; title: string | null
}

export async function createCampaign(input: CampaignInput): Promise<number> {
  const usable = new Map(platformStatuses().map((p) => [p.id, p]))
  if (input.mode === "auto") for (const p of input.platforms) {
    const s = usable.get(p)!
    if (s.manualOnly) throw new Error(`${s.name} can only be shared manually`)
    if (!s.usable) throw new Error(`${s.name} isn't set up yet (missing ${s.missing.join(", ")})`)
  }
  const digest = input.digest
  if (digest && input.items.length < 2) throw new Error("A digest needs at least 2 opportunities")
  if (!digest && input.items.length > MAX_PER_CAMPAIGN) throw new Error(`At most ${MAX_PER_CAMPAIGN} posts at once`)
  if (digest) for (const p of input.platforms) if (!digest.captions[p]?.trim()) throw new Error(`Missing ${p} caption for the digest`)
  if (input.music && !getTrack(input.music.id)) throw new Error("That music track no longer exists")
  // Looked up before the SQLite transaction (the source may be PathMaester's database).
  const opps = await getOpportunities(input.items.map((it) => it.opportunityId))
  const ids = new Set<string>()
  for (const it of input.items) {
    if (ids.has(it.opportunityId)) throw new Error("The same job was selected twice")
    ids.add(it.opportunityId)
    if (!opps.has(it.opportunityId)) throw new Error(`Job/scholarship ${it.opportunityId} not found (or no longer public)`)
    for (const u of it.extraUploadIds) if (!getUpload(u)) throw new Error("An uploaded picture is missing — upload it again")
    if (!digest) for (const p of input.platforms) if (!it.captions[p]?.trim()) throw new Error(`Missing ${p} caption`)
  }

  const d = db()
  const now = Date.now()
  const dry = input.mode === "auto" && isDryRun() ? 1 : 0
  d.exec("BEGIN")
  try {
    const c = run("INSERT INTO campaigns(status, mode, music_id, music_start, music_volume, slide_seconds, created_at, kind, title) VALUES('queued',?,?,?,?,?,?,?,?)",
      input.mode, input.music?.id ?? null, input.music?.start ?? 0, input.music?.volume ?? 0.8, input.slideSeconds, now, digest ? "digest" : "single", digest?.title ?? null)
    const campaignId = Number(c.lastInsertRowid)
    for (const [n, it] of input.items.entries()) {
      const o = opps.get(it.opportunityId)!
      const item = run("INSERT INTO campaign_items(campaign_id, opportunity_id, title, extra_upload_ids) VALUES(?,?,?,?)",
        campaignId, o.id, o.title, JSON.stringify(it.extraUploadIds))
      // A digest is posted once per platform, from its first item (which also holds the digest's picture and video).
      if (digest && n > 0) continue
      for (const p of input.platforms) {
        run("INSERT INTO posts(item_id, opportunity_id, platform, caption, status, dry_run, updated_at) VALUES(?,?,?,?, 'queued', ?, ?)",
          Number(item.lastInsertRowid), o.id, p, (digest ? digest.captions[p] : it.captions[p]).trim(), dry, now)
      }
    }
    d.exec("COMMIT")
    return campaignId
  } catch (e) {
    d.exec("ROLLBACK")
    throw e
  }
}

export const getCampaign = (id: number) => get<Campaign>("SELECT * FROM campaigns WHERE id = ?", id)
export const campaignItems = (id: number) => all<Item>("SELECT * FROM campaign_items WHERE campaign_id = ? ORDER BY id", id)
export const campaignPosts = (id: number) =>
  all<Post>("SELECT p.* FROM posts p JOIN campaign_items i ON i.id = p.item_id WHERE i.campaign_id = ? ORDER BY p.item_id, p.id", id)

export async function campaignDetail(id: number) {
  const c = getCampaign(id)
  if (!c) return null
  const raw = campaignItems(id)
  const opps = await getOpportunities(raw.map((i) => i.opportunity_id))
  // links = what each platform's post points to (see shareLink); null when the job is gone or has no link
  const items = raw.map((i) => {
    const o = opps.get(i.opportunity_id)
    const links: Record<string, string | null> = Object.fromEntries(platformIds.map((p) => [p, o ? shareLink(o, p) : null]))
    return { ...i, links }
  })
  // A digest's posts hang on its first item and point at PathMaester's list page, not one opportunity.
  if (c.kind === "digest" && items[0]) {
    const all = raw.map((i) => opps.get(i.opportunity_id)).filter((o): o is NonNullable<typeof o> => !!o)
    items[0] = { ...items[0], title: c.title ?? items[0].title, links: Object.fromEntries(platformIds.map((p) => [p, all.length ? digestLink(all, p) : null])) }
  }
  return {
    campaign: c, items, posts: campaignPosts(id), track: c.music_id ? getTrack(c.music_id) ?? null : null,
    /** A digest's opportunities in running order (its first item's title is replaced by the digest title). */
    digestTitles: c.kind === "digest" ? raw.map((i) => i.title) : [],
  }
}

export type CampaignSummary = Campaign & { titles: string; total: number; done: number; failed: number; platforms: string }
export function listCampaigns(limit = 50): CampaignSummary[] {
  return all<CampaignSummary>(`
    SELECT c.*,
      COALESCE('🔥 ' || c.title || ' (digest)', (SELECT group_concat(title, ' · ') FROM campaign_items WHERE campaign_id = c.id)) AS titles,
      (SELECT count(*) FROM posts p JOIN campaign_items i ON i.id = p.item_id WHERE i.campaign_id = c.id) AS total,
      (SELECT count(*) FROM posts p JOIN campaign_items i ON i.id = p.item_id WHERE i.campaign_id = c.id AND p.status = 'done') AS done,
      (SELECT count(*) FROM posts p JOIN campaign_items i ON i.id = p.item_id WHERE i.campaign_id = c.id AND p.status = 'failed') AS failed,
      (SELECT group_concat(DISTINCT platform) FROM posts p JOIN campaign_items i ON i.id = p.item_id WHERE i.campaign_id = c.id) AS platforms
    FROM campaigns c ORDER BY c.id DESC LIMIT ?`, limit)
}

/** opportunity id → platforms it was really (not dry-run) posted to. */
/** Every opportunity a sent post carried: its own item, or every item of a digest. */
export const SENT_ITEMS_SQL = `
  SELECT i.opportunity_id, p.platform, p.updated_at FROM posts p
  JOIN campaign_items pi ON pi.id = p.item_id
  JOIN campaigns c ON c.id = pi.campaign_id
  JOIN campaign_items i ON i.campaign_id = c.id AND (c.kind = 'digest' OR i.id = pi.id)
  WHERE p.status = 'done' AND p.dry_run = 0`

export function postedTo(): Map<string, string[]> {
  const rows = all<{ opportunity_id: string; platforms: string }>(
    `SELECT opportunity_id, group_concat(DISTINCT platform) AS platforms FROM (${SENT_ITEMS_SQL}) GROUP BY opportunity_id`)
  return new Map(rows.map((r) => [r.opportunity_id, r.platforms.split(",")]))
}

/** Put a failed post back in the queue; its campaign is picked up again by the worker. */
export function retryPost(postId: number): number {
  const p = get<Post & { campaign_id: number }>(
    "SELECT p.*, i.campaign_id FROM posts p JOIN campaign_items i ON i.id = p.item_id WHERE p.id = ?", postId)
  if (!p) throw new Error("Post not found")
  if (p.status !== "failed") throw new Error("Only failed posts can be retried")
  run("UPDATE posts SET status = 'queued', error = NULL, dry_run = ?, updated_at = ? WHERE id = ?", isDryRun() ? 1 : 0, Date.now(), postId)
  run("UPDATE campaigns SET status = 'queued', finished_at = NULL WHERE id = ?", p.campaign_id)
  return p.campaign_id
}

/** Manual mode: the user says whether they shared a post. Campaign is done once every post is. */
export function markPost(postId: number, shared: boolean): number {
  const p = get<Post & { campaign_id: number; mode: string }>(
    "SELECT p.*, i.campaign_id, c.mode FROM posts p JOIN campaign_items i ON i.id = p.item_id JOIN campaigns c ON c.id = i.campaign_id WHERE p.id = ?", postId)
  if (!p) throw new Error("Post not found")
  if (p.mode !== "manual") throw new Error("Only manually shared posts can be marked")
  if (!["ready", "done"].includes(p.status)) throw new Error("The picture/video isn't ready yet")
  run("UPDATE posts SET status = ?, updated_at = ? WHERE id = ?", shared ? "done" : "ready", Date.now(), postId)
  const left = get<{ n: number }>(
    "SELECT count(*) AS n FROM posts p JOIN campaign_items i ON i.id = p.item_id WHERE i.campaign_id = ? AND p.status != 'done'", p.campaign_id)!.n
  run("UPDATE campaigns SET status = ?, finished_at = ? WHERE id = ?", left ? "ready" : "done", left ? null : Date.now(), p.campaign_id)
  return p.campaign_id
}

/** What the public /bio page lists: opportunities from campaigns shared or posted in the last `days` days, newest
 *  first. Dry runs don't count; a digest stays together under its title. */
export function recentlyShared(days = 45): { campaignId: number; kind: "single" | "digest"; title: string | null; createdAt: number; ids: string[] }[] {
  const rows = all<{ campaign_id: number; kind: "single" | "digest"; title: string | null; created_at: number; opportunity_id: string }>(`
    SELECT c.id AS campaign_id, c.kind, c.title, c.created_at, i.opportunity_id
    FROM campaigns c JOIN campaign_items i ON i.campaign_id = c.id
    WHERE c.created_at >= ? AND EXISTS (
      SELECT 1 FROM posts p JOIN campaign_items pi ON pi.id = p.item_id
      WHERE pi.campaign_id = c.id AND p.status IN ('ready', 'done') AND p.dry_run = 0)
    ORDER BY c.created_at DESC, i.id`, Date.now() - days * 86_400_000)
  const groups = new Map<number, { campaignId: number; kind: "single" | "digest"; title: string | null; createdAt: number; ids: string[] }>()
  const seen = new Set<string>()
  for (const r of rows) {
    if (seen.has(r.opportunity_id)) continue
    seen.add(r.opportunity_id)
    const g = groups.get(r.campaign_id) ?? { campaignId: r.campaign_id, kind: r.kind, title: r.title, createdAt: r.created_at, ids: [] }
    g.ids.push(r.opportunity_id)
    groups.set(r.campaign_id, g)
  }
  return [...groups.values()]
}
