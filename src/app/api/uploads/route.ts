import { NextResponse } from "next/server"
import { addUpload } from "@/lib/library"

export async function POST(req: Request) {
  try {
    const f = (await req.formData()).get("file")
    if (!(f instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 })
    const u = await addUpload(f)
    return NextResponse.json({ id: u.id, name: u.original_name, url: `/api/files/${u.file}` })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
