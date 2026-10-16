import { NextRequest, NextResponse } from "next/server"
import { EDUAI_AUDIO_ENGINE_URL } from "@/lib/audio/cloud-run-client"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

type VoiceAction = "prepare" | "render" | "delete"
const ACTIONS: Record<VoiceAction, string> = {
  prepare: "/v1/voice/prepare",
  render: "/v1/voice/render",
  delete: "/v1/voice/delete",
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  })
}

/**
 * Same-origin server relay for voice operations, avoiding Cloud Run's browser
 * CORS preflight. Server credentials and tokens never reach untrusted origins.
 *
 * Security is enforced by EDUAI before opening a Cloud Run connection:
 * authenticated admin, adult profile, protected MFA session, verified AAL2
 * and ownership + per-voice consent. Actions and destination are allowlisted.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (origin && origin !== request.nextUrl.origin) {
    return failure("Origen de solicitud no autorizado", 403)
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failure("Se requiere JSON", 415)
  }
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") return failure("Solicitud inválida", 400)
  const action = body.action as VoiceAction
  const profileId = body.profile_id
  if (!Object.hasOwn(ACTIONS, action) || typeof profileId !== "string" || !UUID.test(profileId)) {
    return failure("Operación o identificador vocal inválido", 400)
  }

  const { valid, supabase, error } = await validateVoiceSecuritySession()
  if (!valid) return failure(error || "Desbloquea la zona protegida de voces como administrador adulto", 403)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return failure("Debes iniciar sesión de nuevo", 401)

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assuranceError || assurance?.currentLevel !== "aal2") {
    return failure("Verifica tu aplicación Authenticator para usar voces replicadas", 403)
  }

  const { data: profile, error: profileError } = await supabase
    .from("audio_voice_profiles")
    .select("id,status,sample_path,consent_audio_path,consent_confirmed,authorization_confirmed,internal_use_enabled")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileError) return failure("No se pudo verificar el perfil vocal", 503)
  if (!profile) return failure("Perfil vocal no encontrado o sin autorización", 404)
  if (action !== "delete") {
    if (!profile.consent_confirmed || !profile.authorization_confirmed || !profile.consent_audio_path) {
      return failure("Falta la grabación y autorización del consentimiento vocal", 403)
    }
  }
  if (action === "prepare" && !profile.sample_path) {
    return failure("Falta subir la muestra de referencia", 400)
  }
  if (action === "render" && (profile.status !== "ready" || !profile.internal_use_enabled)) {
    return failure("Esta voz todavía no está lista para reproducirse", 409)
  }

  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (action === "render" && (text.length < 1 || text.length > 1500)) {
    return failure("El texto de prueba debe tener entre 1 y 1500 caracteres", 400)
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.access_token) return failure("La sesión expiró. Vuelve a identificarte", 401)

  const upstreamPayload = action === "render"
    ? { profile_id: profileId, text }
    : { profile_id: profileId }

  try {
    const upstream = await fetch(`${EDUAI_AUDIO_ENGINE_URL}${ACTIONS[action]}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Accept: action === "delete" ? "application/json" : "text/event-stream",
      },
      body: JSON.stringify(upstreamPayload),
      cache: "no-store",
      signal: request.signal,
    })

    if (!upstream.ok) {
      const json = await upstream.json().catch(() => ({}))
      const upstreamMessage = typeof json?.detail === "string" ? json.detail
        : typeof json?.error === "string" ? json.error : ""
      const message = upstream.status === 401 || upstream.status === 403
        ? "Google Cloud Run rechazó la solicitud. Comprueba que el servicio permita invocaciones de EDUAI y esté actualizado."
        : upstream.status === 404
          ? "El gateway de voz aún no tiene publicada esta operación. Actualiza Google Cloud Run."
          : upstreamMessage || `El motor Google Audio respondió HTTP ${upstream.status}`
      console.error("[voice/gateway] Upstream status", upstream.status, "action", action)
      return failure(message, upstream.status >= 500 ? 502 : upstream.status)
    }

    if (action === "delete") {
      const json = await upstream.json().catch(() => ({}))
      return NextResponse.json(json, { headers: { "Cache-Control": "private, no-store" } })
    }

    const type = upstream.headers.get("content-type") || ""
    if (!type.includes("text/event-stream") || !upstream.body) {
      return failure("El motor no entregó un canal de progreso válido", 502)
    }
    // Pass through each SSE chunk as it arrives; never buffer the audio job.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (reason) {
    console.error("[voice/gateway] Cloud Run connection failed:", reason instanceof Error ? reason.name : "unknown")
    return failure(
      "No se pudo contactar Google Cloud Run. Revisa que el gateway de voz esté desplegado y accesible.",
      502,
    )
  }
}
