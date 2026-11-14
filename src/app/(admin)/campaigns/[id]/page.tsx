import { notFound } from "next/navigation"
import { connection } from "next/server"
import { CampaignView } from "@/components/campaign-view"
import { campaignDetail } from "@/lib/campaigns"
import { PLATFORMS } from "@/lib/platforms"

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const detail = await campaignDetail(Number((await params).id))
  if (!detail) notFound()
  const names = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.name]))
  return <CampaignView initial={detail} names={names} />
}
