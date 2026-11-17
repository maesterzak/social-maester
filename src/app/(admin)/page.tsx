import { connection } from "next/server"
import { Composer } from "@/components/composer"
import { MAX_PER_CAMPAIGN, MAX_PER_DIGEST, postedTo } from "@/lib/campaigns"
import { formatDeadline } from "@/lib/caption"
import { listTracks } from "@/lib/library"
import { missionStats } from "@/lib/mission"
import { listOpportunities, opportunitySource, type Opportunity } from "@/lib/opportunities"
import { isDryRun, platformStatuses } from "@/lib/platforms"
import { WEEK_THEMES, audienceInfo, classify } from "@/lib/segments"

export default async function Home() {
  await connection()
  const posted = postedTo()
  const source = opportunitySource()
  // PathMaester's database is remote: show the problem instead of crashing the page if it can't be reached.
  let list: Opportunity[] = []
  let loadError = ""
  try { list = await listOpportunities() } catch (e) { loadError = (e as Error).message }
  const jobs = list.filter((o) => o.kind === "JOB").length
  // Computed here (not in the browser) so server and client render the same "today".
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const opportunities = list.map((o) => {
    const s = classify(o)
    const due = o.deadline ? new Date(o.deadline) : null
    const daysLeft = due && !Number.isNaN(due.getTime())
      ? Math.round((Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) - today) / 86_400_000) : null
    return {
      id: o.id, kind: o.kind, title: o.title, organization: o.organization, location: o.location,
      deadline: formatDeadline(o.deadline), postedTo: posted.get(o.id) ?? [],
      audiences: s.audiences, primary: s.primary, level: s.level, remote: s.remote, funded: s.funded, study: s.study, badges: s.badges, scope: s.scope, scopeLabel: s.scopeLabel, daysLeft,
    }
  })
  const mission = missionStats(new Map(opportunities.map((o) => [o.id, o.primary])), now)
  const brand = process.env.BRAND_NAME?.trim() || "PathMaester"
  const theme = audienceInfo(WEEK_THEMES[now.getDay()])
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"
  const platforms = platformStatuses().map(({ id, name, media, captionLimit, usable, missing, manualOnly }) => ({ id, name, media, captionLimit, usable, missing, manualOnly: !!manualOnly }))

  return (
    <>
      <div className={`aurora a-${theme.id}`} aria-hidden="true" />
      <div className={`hero a-${theme.id}`}>
        <div className="hero-kicker">{greeting} · {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 className="hero-title">Today is for <em>{theme.emoji} {theme.name}</em></h1>
        <div className="hero-sub muted">
          {source === "pathmaester"
            ? <><b>{jobs}</b> jobs and <b>{list.length - jobs}</b> scholarships live from PathMaester · <b>{opportunities.filter((o) => o.postedTo.length === 0).length}</b> never posted · <b>{opportunities.filter((o) => o.daysLeft !== null && o.daysLeft <= 7).length}</b> closing this week</>
            : <>Showing <b>sample jobs</b>. Set PATHMAESTER_DATABASE_URL in .env to use PathMaester&apos;s.</>}
        </div>
      </div>
      {loadError && <div className="banner bad-banner">Couldn&apos;t load jobs from {source === "pathmaester" ? "PathMaester" : "the database"}: {loadError}</div>}
      {isDryRun() && <div className="banner">Dry run is on (DRY_RUN in .env): Auto-post makes the media but sends nothing. Share myself works normally.</div>}
      <Composer opportunities={opportunities} platforms={platforms} tracks={listTracks()} max={MAX_PER_CAMPAIGN} digestMax={MAX_PER_DIGEST} weekday={now.getDay()} mission={mission} brand={brand} />
    </>
  )
}
