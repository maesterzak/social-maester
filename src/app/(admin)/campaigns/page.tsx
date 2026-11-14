import Link from "next/link"
import { connection } from "next/server"
import { listCampaigns } from "@/lib/campaigns"
import { platformInfo } from "@/lib/platforms"

export default async function CampaignsPage() {
  await connection()
  const rows = listCampaigns()
  return (
    <>
      <div className="page-head"><h1>History</h1><p className="muted" style={{ margin: 0 }}>Every click on “Post”.</p></div>
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead><tr><th>#</th><th>When</th><th>Posts</th><th>Platforms</th><th>Result</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/campaigns/${c.id}`}>#{c.id}</Link></td>
                <td className="small" style={{ whiteSpace: "nowrap" }}>{new Date(c.created_at).toLocaleString("en-GB")}</td>
                <td><Link href={`/campaigns/${c.id}`}>{c.titles}</Link></td>
                <td className="small">{(c.platforms ?? "").split(",").map((p) => platformInfo(p)?.name ?? p).join(", ")}</td>
                <td><span className={`badge ${c.status}`}>{c.status}</span> <span className="muted small">{c.done}/{c.total} sent{c.failed ? `, ${c.failed} failed` : ""}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="muted">Nothing posted yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
