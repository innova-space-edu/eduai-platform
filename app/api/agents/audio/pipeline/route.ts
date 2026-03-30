import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runAudioPipeline } from "@/lib/audio/pipeline"
import { AudioPipelineRequest } from "@/lib/audio/types"

export const runtime = "nodejs"
export const maxDuration = 120

const VALID_MIMES = [
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/mp4",
  "audio/webm", "audio/m4a", "audio/ogg",
  "video/mp4",  "video/webm",
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  let body: AudioPipelineRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!body?.audioBase64 || !body?.mimeType) {
    return NextResponse.json({ error: "Faltan audioBase64 y mimeType" }, { status: 400 })
  }

  if (!VALID_MIMES.includes(body.mimeType)) {
    return NextResponse.json({ error: `Formato no soportado: ${body.mimeType}` }, { status: 400 })
  }

  try {
    const result = await runAudioPipeline({ userId: user.id, request: body })
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo procesar el audio" }, { status: 500 })
  }
}
