import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAudioPipelineConfig, hasExternalAudioPipeline } from "@/lib/audio/server-config"

export const runtime = "nodejs"
export const maxDuration = 15

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 })
  }

  const config = getAudioPipelineConfig()

  if (!hasExternalAudioPipeline()) {
    return NextResponse.json({
      ok: false,
      connected: false,
      provider: config.providerName,
      error: "AUDIO_PIPELINE_URL no está configurada",
    }, { status: 503 })
  }

  const startedAt = Date.now()

  try {
    const response = await fetch(`${config.providerUrl.replace(/\/$/, "")}/health`, {
      headers: config.providerToken
        ? { Authorization: `Bearer ${config.providerToken}` }
        : undefined,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    })

    const text = await response.text()
    let details: unknown = text

    try {
      details = JSON.parse(text)
    } catch {}

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        connected: false,
        provider: config.providerName,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        details,
      }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      provider: config.providerName,
      latencyMs: Date.now() - startedAt,
      details,
    })
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      connected: false,
      provider: config.providerName,
      latencyMs: Date.now() - startedAt,
      error: error?.message || "No se pudo contactar el parser externo",
    }, { status: 502 })
  }
}
