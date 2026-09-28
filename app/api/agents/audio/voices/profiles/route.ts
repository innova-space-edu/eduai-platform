import { NextResponse } from "next/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"
import { EDUAI_AUDIO_ENGINE_URL } from "@/lib/audio/cloud-run-client"

export const runtime = "nodejs"

export async function GET() {
  const { valid, supabase, error: securityError } = await validateVoiceSecuritySession()
  if (securityError) return NextResponse.json({ error: "No se pudo validar la zona protegida. Reintenta en unos segundos." }, { status: 503 })
  if (!valid) return NextResponse.json({ error: "Sesión protegida vencida" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await supabase
    .from("audio_voice_profiles")
    .select("id, display_name, source_kind, status, sample_path, consent_audio_path, consent_audio_mime, consent_language, canonical_audio_path, canonical_audio_mime, canonical_sample_rate, canonical_duration_seconds, model_provider, provider_voice_id, provider_voice_expires_at, internal_use_enabled, default_voice, processing_error, processing_progress, processing_stage, processed_at, adult_confirmed, consent_confirmed, authorization_confirmed, consented_at, created_at, updated_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profiles: data || [] })
}

export async function POST(req: Request) {
  const { valid, supabase, error: securityError } = await validateVoiceSecuritySession()
  if (securityError) return NextResponse.json({ error: "No se pudo validar la zona protegida. Reintenta en unos segundos." }, { status: 503 })
  if (!valid) return NextResponse.json({ error: "Sesión protegida vencida" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : ""
    const sourceKind = body?.sourceKind === "authorized_third_party" ? "authorized_third_party" : "self"
    const adultConfirmed = body?.adultConfirmed === true
    const consentConfirmed = body?.consentConfirmed === true
    const authorizationConfirmed = sourceKind === "self" ? true : body?.authorizationConfirmed === true

    if (!displayName) return NextResponse.json({ error: "Escribe un nombre para la voz" }, { status: 400 })
    if (!adultConfirmed) return NextResponse.json({ error: "Debes confirmar que eres mayor de edad" }, { status: 400 })
    if (!consentConfirmed) return NextResponse.json({ error: "Debes aceptar el consentimiento específico" }, { status: 400 })
    if (!authorizationConfirmed) return NextResponse.json({ error: "Debes confirmar la autorización expresa de la persona titular" }, { status: 400 })

    const { data, error } = await supabase
      .from("audio_voice_profiles")
      .insert({
        user_id: user.id,
        display_name: displayName,
        source_kind: sourceKind,
        status: "draft",
        adult_confirmed: adultConfirmed,
        consent_confirmed: consentConfirmed,
        authorization_confirmed: authorizationConfirmed,
        consent_language: "es-US",
        consented_at: new Date().toISOString(),
      })
      .select("id, display_name, source_kind, status, sample_path, consent_audio_path, internal_use_enabled, default_voice, created_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("audio_voice_events").insert([
      { user_id: user.id, voice_profile_id: data.id, event_type: "created", metadata: { source_kind: sourceKind } },
      { user_id: user.id, voice_profile_id: data.id, event_type: "consent_recorded", metadata: { version: "voice-replication-v2", source_kind: sourceKind, consent_language: "es-US" } },
    ])

    return NextResponse.json({ ok: true, profile: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo crear el perfil vocal" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { valid, supabase, error: securityError } = await validateVoiceSecuritySession()
  if (securityError) return NextResponse.json({ error: "No se pudo validar la zona protegida. Reintenta en unos segundos." }, { status: 503 })
  if (!valid) return NextResponse.json({ error: "Sesión protegida vencida" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const profileId = typeof body?.profileId === "string" ? body.profileId : ""
    if (!profileId) return NextResponse.json({ error: "profileId requerido" }, { status: 400 })

    const { data: profile } = await supabase
      .from("audio_voice_profiles")
      .select("id, sample_path, consent_audio_path, canonical_audio_path, provider_voice_id")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: "Perfil vocal no encontrado" }, { status: 404 })

    if (profile.provider_voice_id) {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) return NextResponse.json({ error: "La sesión de voz venció. Vuelve a desbloquear la zona protegida." }, { status: 401 })

      const providerResponse = await fetch(`${EDUAI_AUDIO_ENGINE_URL}/v1/voice/delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profile_id: profileId }),
      })

      if (!providerResponse.ok) {
        const providerBody = await providerResponse.json().catch(() => ({}))
        return NextResponse.json(
          { error: providerBody?.detail || providerBody?.error || "No se pudo eliminar la voz del proveedor externo" },
          { status: 502 },
        )
      }
    }

    const { data: assets } = await supabase
      .from("audio_voice_model_assets")
      .select("storage_bucket, storage_path")
      .eq("voice_profile_id", profileId)
      .eq("user_id", user.id)

    const { data: renders } = await supabase
      .from("audio_voice_render_jobs")
      .select("audio_bucket, audio_path")
      .eq("voice_profile_id", profileId)
      .eq("user_id", user.id)

    const voicePaths = [profile.sample_path, profile.consent_audio_path, profile.canonical_audio_path].filter(
      (path, index, all): path is string => Boolean(path) && all.indexOf(path) === index
    )
    if (voicePaths.length) await supabase.storage.from("voice-clones").remove(voicePaths)

    const assetsByBucket = new Map<string, string[]>()
    for (const asset of assets || []) {
      if (!asset.storage_path) continue
      const paths = assetsByBucket.get(asset.storage_bucket) || []
      paths.push(asset.storage_path)
      assetsByBucket.set(asset.storage_bucket, paths)
    }
    for (const [bucket, paths] of assetsByBucket) {
      await supabase.storage.from(bucket).remove(paths)
    }

    const rendersByBucket = new Map<string, string[]>()
    for (const render of renders || []) {
      if (!render.audio_path) continue
      const paths = rendersByBucket.get(render.audio_bucket) || []
      paths.push(render.audio_path)
      rendersByBucket.set(render.audio_bucket, paths)
    }
    for (const [bucket, paths] of rendersByBucket) {
      await supabase.storage.from(bucket).remove(paths)
    }

    await supabase.from("audio_voice_model_assets").delete().eq("voice_profile_id", profileId).eq("user_id", user.id)
    await supabase.from("audio_voice_render_jobs").delete().eq("voice_profile_id", profileId).eq("user_id", user.id)

    const { error } = await supabase
      .from("audio_voice_profiles")
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
        internal_use_enabled: false,
        default_voice: false,
        provider_voice_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("audio_voice_events").insert({
      user_id: user.id,
      voice_profile_id: profileId,
      event_type: "deleted",
      metadata: {
        sample_removed: !!profile.sample_path,
        consent_audio_removed: !!profile.consent_audio_path,
        canonical_removed: !!profile.canonical_audio_path,
        model_assets_removed: (assets || []).length,
        provider_voice_removed: !!profile.provider_voice_id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo eliminar el perfil vocal" }, { status: 500 })
  }
}
