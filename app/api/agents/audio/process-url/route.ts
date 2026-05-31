import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAudioPipelineConfig, hasExternalAudioPipeline } from "@/lib/audio/server-config"

export const runtime = "nodejs"
export const maxDuration = 120

const BUCKET = "audio-lab"

function getString(value: unknown) {
  return typeof value === "string" ? value : ""
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  if (!hasExternalAudioPipeline()) {
    return NextResponse.json({ error: "AUDIO_PIPELINE_URL no está configurada" }, { status: 503 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const filePath = getString(body?.filePath).trim()
    const fileName = getString(body?.fileName).trim() || "audio.mp3"
    const mimeType = getString(body?.mimeType).trim() || "audio/mpeg"
    const fileSizeBytes = Number(body?.fileSizeBytes || 0)
    const options = typeof body?.options === "object" && body.options ? body.options : {}

    if (!filePath || !filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Ruta de audio inválida" }, { status: 403 })
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 10 * 60)

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: signedError?.message || "No se pudo firmar el audio" }, { status: 500 })
    }

    const config = getAudioPipelineConfig()
    const response = await fetch(`${config.providerUrl.replace(/\/$/, "")}/pipeline-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.providerToken ? { Authorization: `Bearer ${config.providerToken}` } : {}),
      },
      body: JSON.stringify({
        audioUrl: signed.signedUrl,
        mimeType,
        fileName,
        fileSizeBytes,
        options,
      }),
      signal: AbortSignal.timeout(110_000),
    })

    const text = await response.text()
    let data: any = null
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }

    if (!response.ok) {
      return NextResponse.json({ error: data?.detail || data?.error || `Parser externo respondió ${response.status}` }, { status: 502 })
    }

    return NextResponse.json({ ok: true, ...data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo procesar el audio" }, { status: 500 })
  }
}
