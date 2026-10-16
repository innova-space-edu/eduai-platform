import { NextResponse } from "next/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"
import { EDUAI_AUDIO_ENGINE_URL } from "@/lib/audio/cloud-run-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 20

/** Diagnóstico de solo lectura. Nunca devuelve tokens ni claves del proveedor. */
export async function GET() {
  const { valid, error } = await validateVoiceSecuritySession()
  if (!valid) {
    return NextResponse.json(
      { ok: false, error: error || "Requiere administración adulta y zona protegida desbloqueada" },
      { status: error ? 403 : 401, headers: { "Cache-Control": "no-store" } },
    )
  }
  try {
    const res = await fetch(`${EDUAI_AUDIO_ENGINE_URL}/diagnostics/voice`, {
      cache: "no-store", signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      return NextResponse.json({
        ok: false, provider: "Google Gemini Voice Replication",
        message: "El gateway de audio respondió, pero el diagnóstico no estuvo disponible",
        httpStatus: res.status,
      }, { status: 503, headers: { "Cache-Control": "no-store" } })
    }
    const result = await res.json().catch(() => ({}))
    const available = result?.ok === true
    const provider = result?.provider === "chatterbox-self-hosted"
      ? "Chatterbox Multilingual V3 · GPU ScientificBrain"
      : "Google Gemini Voice Replication"
    const isChatterbox = result?.provider === "chatterbox-self-hosted"
    return NextResponse.json({
      ok: available,
      provider,
      model: typeof result?.model === "string" ? result.model : "",
      httpStatus: typeof result?.status === "number" ? result.status : null,
      message: available
        ? (isChatterbox ? "Chatterbox GPU activo; voz local sin Gemini ni Hugging Face" : "Google Voices API disponible")
        : (isChatterbox
            ? "Motor Chatterbox pendiente: comprueba los pesos verificados, la cuota GPU y el acceso privado de Cloud Run."
            : "Gemini Voice Replication requiere Paid Quota Tier 1; configura Chatterbox antes de replicar."),
    }, { status: available ? 200 : 503, headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({
      ok: false, provider: "Google Gemini Voice Replication",
      message: "No se pudo contactar con el servicio de audio de Cloud Run",
    }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
