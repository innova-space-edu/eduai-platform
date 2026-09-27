import { NextResponse } from "next/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"
import { prepareVoiceWithOpenVoice } from "@/lib/audio/gradio-openvoice-engine"

export const runtime = "nodejs"
export const maxDuration = 240

export async function POST(req: Request) {
  const { valid, supabase, error: securityError } = await validateVoiceSecuritySession()
  if (securityError) {
    return NextResponse.json(
      { error: "No se pudo validar la zona protegida. Reintenta en unos segundos." },
      { status: 503 },
    )
  }
  if (!valid) return NextResponse.json({ error: "Sesión protegida vencida" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const profileId = typeof body?.profileId === "string" ? body.profileId : ""
  if (!profileId) return NextResponse.json({ error: "profileId es requerido" }, { status: 400 })

  const { data: profile, error: profileError } = await supabase
    .from("audio_voice_profiles")
    .select("id, display_name, sample_bucket, sample_path, consent_confirmed, authorization_confirmed, deleted_at")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: "Perfil vocal no encontrado" }, { status: 404 })
  if (!profile.sample_path) return NextResponse.json({ error: "Sube una muestra vocal antes de procesarla" }, { status: 400 })
  if (!profile.consent_confirmed || !profile.authorization_confirmed) {
    return NextResponse.json({ error: "La muestra no tiene autorización verificable" }, { status: 403 })
  }

  const now = new Date().toISOString()
  await supabase
    .from("audio_voice_profiles")
    .update({ status: "processing", processing_error: null, updated_at: now })
    .eq("id", profileId)
    .eq("user_id", user.id)

  try {
    const { data: signed, error: signedError } = await supabase.storage
      .from(profile.sample_bucket || "voice-clones")
      .createSignedUrl(profile.sample_path, 10 * 60)

    if (signedError || !signed?.signedUrl) {
      throw new Error(signedError?.message || "No se pudo abrir la muestra vocal privada")
    }

    const metadata = await prepareVoiceWithOpenVoice(signed.signedUrl)
    const processedAt = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from("audio_voice_profiles")
      .update({
        status: "ready",
        model_provider: "openvoice-v2-zerogpu",
        provider_voice_id: null,
        internal_use_enabled: true,
        processing_error: null,
        processed_at: processedAt,
        updated_at: processedAt,
      })
      .eq("id", profileId)
      .eq("user_id", user.id)
      .select("id, display_name, status, sample_path, model_provider, internal_use_enabled, processing_error, processed_at")
      .single()

    if (updateError) throw new Error(updateError.message)

    await supabase.from("audio_voice_events").insert({
      user_id: user.id,
      voice_profile_id: profileId,
      event_type: "voice_processed",
      metadata: {
        provider: "openvoice-v2-zerogpu",
        engine: metadata.engine || "OpenVoice V2",
        sample_seconds: metadata.sample_seconds || null,
      },
    })

    return NextResponse.json({ ok: true, profile: updated, metadata })
  } catch (error: any) {
    const message = error?.message || "No se pudo preparar la voz con OpenVoice"

    await supabase
      .from("audio_voice_profiles")
      .update({
        status: "draft",
        internal_use_enabled: false,
        processing_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("user_id", user.id)

    await supabase.from("audio_voice_events").insert({
      user_id: user.id,
      voice_profile_id: profileId,
      event_type: "voice_processing_failed",
      metadata: { provider: "openvoice-v2-zerogpu", error: message.slice(0, 500) },
    })

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
