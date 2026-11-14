import { connection } from "next/server"
import { AccountCard } from "@/components/account-card"
import { connectStatuses, metaFlow } from "@/lib/connect"
import { appUrl } from "@/lib/connections"
import { ffmpegBin, ffmpegVersion } from "@/lib/media/ffmpeg"
import { isDryRun, platformStatuses } from "@/lib/platforms"

type Search = { account?: string; connected?: string; error?: string; pick?: string }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await connection()
  const sp = await searchParams
  const version = await ffmpegVersion()
  const platforms = platformStatuses()
  // Ready from .env alone (no Connect used): every platform of that account has its keys.
  const accounts = connectStatuses((id) => platforms.filter((p) => p.connection === id).every((p) => p.missing.length === 0))
  const ready = platforms.filter((p) => p.missing.length === 0).length

  return (
    <>
      <div className="page-head">
        <h1>Accounts</h1>
        <p className="muted" style={{ margin: 0 }}>
          {ready}/{platforms.length} platforms ready. Each platform needs a free developer app of yours; its keys go in <code>.env</code>,
          then <b>Connect</b> logs in to your account. Restart the app after editing <code>.env</code>.
        </p>
      </div>

      {sp.connected && <div className="banner ok-banner">Connected: {sp.connected}</div>}
      {sp.error && <div className="banner bad-banner">{sp.error}</div>}

      <div className="stack">
        <div className="panel stack" style={{ gap: 8 }}>
          <h2>System</h2>
          <div className="row"><b style={{ width: 120 }}>Dry run</b>{isDryRun()
            ? <span className="badge warn">on — nothing is really posted (set DRY_RUN=0 to go live)</span>
            : <span className="badge ok">off — posts go live</span>}</div>
          <div className="row"><b style={{ width: 120 }}>App address</b><code>{appUrl()}</code>
            <span className="muted small">(APP_URL — login redirect URLs below are built from it)</span></div>
          <div className="row"><b style={{ width: 120 }}>ffmpeg</b>{version
            ? <span className="badge ok">{version.replace(/Copyright.*/, "")}</span>
            : <span className="badge bad">not found at “{ffmpegBin()}” — install ffmpeg or set FFMPEG_PATH (needed for videos)</span>}</div>
        </div>

        {accounts.map((a) => (
          <AccountCard key={a.id} a={a} pages={a.id === "meta" && sp.pick ? metaFlow.pendingPages() : []} highlight={sp.account === a.id} />
        ))}
      </div>
    </>
  )
}
