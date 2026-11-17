import { NextResponse } from "next/server"
import { z } from "zod"
import { bioLink, saveBioLink } from "@/lib/bio"

const Body = z.object({ url: z.string().trim().max(500).nullable() })

// Save (or clear, with null) the address the user put in their TikTok / Instagram / YouTube profile.
export async function POST(req: Request) {
  try {
    const { url } = Body.parse(await req.json())
    saveBioLink(url || null)
    return NextResponse.json(bioLink())
  } catch (e) {
    return NextResponse.json({ error: e instanceof z.ZodError ? "Enter a web address" : (e as Error).message }, { status: 400 })
  }
}
