import { NextResponse } from "next/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"

export const runtime = "nodejs"

type UploadKind = "reference" | "consent"

function uploadColumn(kind: UploadKind) {
  return kind === "consent" ? "consent_audio_path" : "sample_path"
}

export async function POST(req: Request) {
  const { valid, supabase, error: securityError } = await validateVoiceSecuritySession()
  if (securityError) return NextResponse.json({ error: "No se pudo validar la zona protegida. Reintenta en unos segundos." }, { status: 503 })
  if (!valid) return NextResponse.json({ error: "Sesión protegida vencida" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const profileId = typeof body?.profileId === "string" ? body.profileId : ""
    const filePath = typeof body?.filePath === "string" ? body.filePath : ""
    const kind: UploadKind = body?.kind === "consent" ? "consent" : "reference"

    if (!profileId || !filePath) {
      return NextResponse.json({ error: "profileId y filePath son requeridos" }, { status: 400 })
    }

    const expectedPrefix = `${user.id}/${profileId}/${kind}/`
    if (!filePath.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Ruta de audio inválida" }, { status: 403 })
    }

    const folder = `${user.id}/${profileId}/${kind}`
    const { data: stored, error: listError } = await supabase.storage
      .from("voice-clones")
      .list(folder, { limit: 100 })

    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

    const expectedName = filePath.split("/").pop()
    if (!stored?.some((item) => item.name === expectedName)) {
      return NextResponse.json({ error: "El audio todavía no está disponible en Storage" }, { status: 404 })
    }

    const { data: currentProfile, error: profileError } = await supabase
      .from("audio_voice_profiles")
      .select("id, sample_path, consent_audio_path, canonical_audio_path, provider_voice_id")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
    if (!currentProfile) return NextResponse.json({ error: "Perfil vocal no encontrado" }, { status: 404 })

    const previousPath = currentProfile[uploadColumn(kind) as keyof typeof currentProfile] as string | null
    if (previousPath && previousPath !== filePath) {
      await supabase.storage.from("voice-clones").remove([previousPath])
    }

    if (currentProfile.canonical_audio_path) {
      await supabase.storage.from("voice-clones").remove([currentProfile.canonical_audio_path])
    }

    const { data: assets } = await supabase
      .from("audio_voice_model_assets")
      .select("storage_bucket, storage_path")
      .eq("voice_profile_id", profileId)
      .eq("user_id", user.id)

    for (const asset of assets || []) {
      if (asset.storage_bucket && asset.storage_path) {
        await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path])
      }
    }

    await supabase
      .from("audio_voice_model_assets")
      .delete()
      .eq("voice_profile_id", profileId)
      .eq("user_id", user.id)

    const now = new Date().toISOString()
    const reset = {
      status: "draft",
      model_provider: null,
      internal_use_enabled: false,
      processing_error: null,
      processing_progress: 0,
      processing_stage: null,
      processed_at: null,
      embedding_path: null,
      canonical_audio_path: null,
      canonical_audio_mime: null,
      canonical_sample_rate: null,
      canonical_duration_seconds: null,
      source_sha256: null,
      updated_at: now,
      ...(kind === "consent"
        ? { consent_audio_path: filePath, consent_audio_mime: null }
        : { sample_path: filePath }),
    }

    const { data, error } = await supabase
      .from("audio_voice_profiles")
      .update(reset)
      .eq("id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id, display_name, source_kind, status, sample_path, consent_audio_path, provider_voice_id, internal_use_enabled, default_voice, created_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("audio_voice_events").insert({
      user_id: user.id,
      voice_profile_id: profileId,
      event_type: "sample_uploaded",
      metadata: {
        path: filePath,
        kind,
        provider_voice_pending_cleanup: currentProfile.provider_voice_id || null,
      },
    })

    return NextResponse.json({ ok: true, profile: data, kind })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo confirmar el audio" }, { status: 500 })
  }
}
