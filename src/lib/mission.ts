import { SENT_ITEMS_SQL } from "./campaigns"
import { all } from "./db"

// Your own posting record, for the mission bar: streak, this week's progress and which audiences were served.
// Counts only posts that really went out (auto-posted, or ticked "Shared" after sharing yourself).

export const WEEKLY_GOAL = 7 // one opportunity a day

export type Mission = {
  /** Days in a row with at least one post, counting today or (if nothing yet today) yesterday backwards. */
  streak: number
  postedToday: boolean
  /** Opportunities posted in the last 7 days, and the platform posts that carried them. */
  weekItems: number
  weekPosts: number
  /** Opportunities posted in the last 7 days per audience. */
  byAudience: Record<string, number>
  goal: number
}

const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** audienceOf: opportunity id → primary audience (only for opportunities still listed). */
export function missionStats(audienceOf: Map<string, string>, now = new Date()): Mission {
  const rows = all<{ opportunity_id: string; updated_at: number }>(SENT_ITEMS_SQL)
  const days = new Set(rows.map((r) => dayKey(r.updated_at)))
  const postedToday = days.has(dayKey(now.getTime()))

  let streak = 0
  const d = new Date(now)
  if (!postedToday) d.setDate(d.getDate() - 1)
  while (days.has(dayKey(d.getTime()))) { streak++; d.setDate(d.getDate() - 1) }

  const week = rows.filter((r) => r.updated_at >= now.getTime() - 7 * 86_400_000)
  const items = new Set(week.map((r) => r.opportunity_id))
  const byAudience: Record<string, number> = { DIGITAL: 0, PHYSICAL: 0, STARTER: 0, SCHOLARSHIP: 0 }
  for (const id of items) {
    const a = audienceOf.get(id)
    if (a) byAudience[a] = (byAudience[a] ?? 0) + 1
  }
  return { streak, postedToday, weekItems: items.size, weekPosts: week.length, byAudience, goal: WEEKLY_GOAL }
}
