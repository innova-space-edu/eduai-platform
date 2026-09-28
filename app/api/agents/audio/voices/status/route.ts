import { NextRequest, NextResponse } from "next/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_TEXT_LENGTH = 900

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH)
}

async function securityContext() {
  const { valid, supabase, error: securityError } = await validateVoiceSecuritySession()

  if (securityError) {
    return {
      response: NextResponse.json(
        { error: "No se pudo validar la zona protegida. Reintenta en unos segundos." },
        { status: 503 },
      ),
      supabase,
      user: null,
    }
  }

  if (!valid) {
    return {
      response: NextResponse.json({ error: "Sesión protegida vencida" }, { status: 401 }),
      supabase,
      user: null,
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
      supabase,
      user: null,
    }
  }

  return { response: null, supabase, user }
}

export async function GET(req: NextRequest) {
  const { response, supabase, user } = await securityContext()
  if (response || !user) return response!

  const profileId = req.nextUrl.searchParams.get("profileId") || ""
  if (!profileId) {
    return NextResponse.json({ error: "profileId requerido" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("audio_voice_profiles")
    .select("id, display_name, status, sample_path, consent_audio_path, canonical_audio_path, model_provider, provider_voice_id, internal_use_enabled, processing_error, processing_progress, processing_stage, processed_at, updated_at")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Perfil vocal no encontrado" }, { status: 404 })

  return NextResponse.json({ ok: true, profile: data })
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || ""
  if (action === "process") return prepareVoice(req)
  if (action === "synthesize") return authorizeSynthesis(req)
  return NextResponse.json({ error: "Acción de voz no reconocida" }, { status: 400 })
}

async function prepareVoice(req: NextRequest) {
  const { response, supabase, user } = await securityContext()
  if (response || !user) return response!

  const body = await req.json().catch(() => ({}))
  const profileId = typeof body?.profileId === "string" ? body.profileId : ""
  if (!profileId) return NextResponse.json({ error: "profileId es requerido" }, { status: 400 })

  const { data: profile, error: profileError } = await supabase
    .from("audio_voice_profiles")
    .select("id, sample_path, consent_audio_path, consent_confirmed, authorization_confirmed")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: "Perfil vocal no encontrado" }, { status: 404 })
  if (!profile.sample_path) {
    return NextResponse.json({ error: "Sube una muestra vocal de referencia antes de procesarla" }, { status: 400 })
  }
  if (!profile.consent_audio_path) {
    return NextResponse.json({ error: "Sube la grabación obligatoria de consentimiento antes de procesarla" }, { status: 400 })
  }
  if (!profile.consent_confirmed || !profile.authorization_confirmed) {
    return NextResponse.json({ error: "La voz no tiene autorización verificable" }, { status: 403 })
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from("audio_voice_profiles")
    .update({
      status: "processing",
      model_provider: "google-gemini-voice-replication",
      internal_use_enabled: false,
      processing_error: null,
      processing_progress: 5,
      processing_stage: "request_created",
      processed_at: null,
      updated_at: now,
    })
    .eq("id", profileId)
    .eq("user_id", user.id)
    .select("id, status, processing_progress, processing_stage")
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from("audio_voice_events").insert({
    user_id: user.id,
    voice_profile_id: profileId,
    event_type: "processing_started",
    metadata: {
      provider: "google-gemini",
      engine: "gemini-3.8-flash-tts",
      queued_at: now,
    },
  })

  return NextResponse.json({ ok: true, accepted: true, profile: updated }, { status: 202 })
}

async function authorizeSynthesis(req: NextRequest) {
  const { response, supabase, user } = await securityContext()
  if (response || !user) return response!

  const body = await req.json().catch(() => ({}))
  const profileId = typeof body?.profileId === "string" ? body.profileId : ""
  const text = cleanText(body?.text)

  if (!profileId) return NextResponse.json({ error: "profileId es requerido" }, { status: 400 })
  if (!text) return NextResponse.json({ error: "Escribe un texto para probar la voz" }, { status: 400 })

  const { data: profile, error: profileError } = await supabase
    .from("audio_voice_profiles")
    .select("id, status, canonical_audio_path, provider_voice_id, consent_confirmed, authorization_confirmed, internal_use_enabled")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: "Perfil vocal no encontrado" }, { status: 404 })
  if (profile.status !== "ready" || !profile.internal_use_enabled || !profile.canonical_audio_path || !profile.provider_voice_id) {
    return NextResponse.json({ error: "Procesa esta voz antes de usarla" }, { status: 409 })
  }
  if (!profile.consent_confirmed || !profile.authorization_confirmed) {
    return NextResponse.json({ error: "La voz no tiene autorización verificable" }, { status: 403 })
  }

  return NextResponse.json({
    ok: true,
    accepted: true,
    profileId,
    text,
    engine: "google-gemini-voice-replication",
  }, { status: 202 })
}
