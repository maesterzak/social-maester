import { connection } from "next/server"
import { Composer } from "@/components/composer"
import { MAX_PER_CAMPAIGN, postedTo } from "@/lib/campaigns"
import { formatDeadline } from "@/lib/caption"
import { listTracks } from "@/lib/library"
import { listOpportunities, opportunitySource, type Opportunity } from "@/lib/opportunities"
import { isDryRun, platformStatuses } from "@/lib/platforms"

export default async function Home() {
  await connection()
  const posted = postedTo()
  const source = opportunitySource()
  // PathMaester's database is remote: show the problem instead of crashing the page if it can't be reached.
  let list: Opportunity[] = []
  let loadError = ""
  try { list = await listOpportunities() } catch (e) { loadError = (e as Error).message }
  const jobs = list.filter((o) => o.kind === "JOB").length
  const opportunities = list.map((o) => ({
    id: o.id, kind: o.kind, title: o.title, organization: o.organization, location: o.location,
    deadline: formatDeadline(o.deadline), postedTo: posted.get(o.id) ?? [],
  }))
  const platforms = platformStatuses().map(({ id, name, media, captionLimit, usable, missing, manualOnly }) => ({ id, name, media, captionLimit, usable, missing, manualOnly: !!manualOnly }))

  return (
    <>
      <div className="page-head">
        <h1>Post jobs & scholarships</h1>
        <p className="muted" style={{ margin: 0 }}>Pick up to {MAX_PER_CAMPAIGN}, choose platforms, add music for the video ones, then share them yourself or auto-post.</p>
        <p className="muted small" style={{ margin: "4px 0 0" }}>
          {source === "pathmaester"
            ? <>Live from <b>PathMaester</b> (read-only): {jobs} open jobs, {list.length - jobs} scholarships. Posts link to their PathMaester pages.</>
            : <>Showing <b>sample jobs</b> — set PATHMAESTER_DATABASE_URL in .env to use PathMaester&apos;s.</>}
        </p>
      </div>
      {loadError && <div className="banner bad-banner">Couldn&apos;t load jobs from {source === "pathmaester" ? "PathMaester" : "the database"}: {loadError}</div>}
      {isDryRun() && <div className="banner">Dry run is on (DRY_RUN in .env): Auto-post makes the media but sends nothing. Share myself works normally.</div>}
      <Composer opportunities={opportunities} platforms={platforms} tracks={listTracks()} max={MAX_PER_CAMPAIGN} />
    </>
  )
}
