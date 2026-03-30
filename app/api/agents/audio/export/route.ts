import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildExportPayload } from "@/lib/audio/exporters"
import { AudioExportFormat, AudioSegment } from "@/lib/audio/types"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  let body: {
    format?: AudioExportFormat
    text?: string
    fileName?: string
    segments?: AudioSegment[]
    metadata?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!body.format || !body.text) {
    return NextResponse.json({ error: "Faltan format y text" }, { status: 400 })
  }

  const payload = buildExportPayload({
    format: body.format,
    text: body.text,
    fileName: body.fileName,
    segments: body.segments,
    metadata: body.metadata,
  })

  return new NextResponse(payload.content, {
    status: 200,
    headers: {
      "Content-Type": payload.mimeType,
      "Content-Disposition": `attachment; filename=\"${payload.fileName}\"`,
    },
  })
}
