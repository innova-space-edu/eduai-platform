import { NextResponse } from "next/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_WAV_BYTES = 8 * 1024 * 1024
const BUCKET = "generated-voice-audio"

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "private, no-store" } })
}

function validWav(bytes: Uint8Array) {
  return bytes.length >= 44 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WAVE"
}

async function session() {
  const result = await validateVoiceSecuritySession()
  if (!result.valid) return { ...result, user: null as null | { id: string } }
  const { data: { user } } = await result.supabase.auth.getUser()
  if (!user) return { ...result, valid: false, user: null }
  const { data: mfa, error: mfaError } = await result.supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (mfaError || mfa?.currentLevel !== "aal2") return { ...result, valid: false, user: null }
  return { ...result, user: { id: user.id } }
}

/** Manually import a Kaggle-generated WAV. No Kaggle API keys, tunnels or worker credentials.
 * Do not mark the voice profile "ready": this does not deploy persistent inference.
 */
export async function importKaggleWav(req: Request) {
  const origin = req.headers.get("origin")
  if (origin && origin !== new URL(req.url).origin) return fail("Origen no permitido", 403)
  if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) return fail("Envía el archivo WAV", 415)
  const ctx = await session()
  if (!ctx.valid || !ctx.user) return fail(ctx.error || "Requiere administrador adulto, MFA y zona protegida", 403)
  const form = await req.formData().catch(() => null)
  const profileId = form?.get("profileId")
  const file = form?.get("audio")
  if (typeof profileId !== "string" || !UUID.test(profileId)) return fail("Perfil inválido", 400)
  if (!(file instanceof File) || file.size < 44 || file.size > MAX_WAV_BYTES) return fail("Carga un WAV de 44 bytes a 8 MB", 413)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!validWav(bytes)) return fail("El archivo no es un WAV válido", 400)

  const { data: profile, error: profileError } = await ctx.supabase
    .from("audio_voice_profiles")
    .select("id,sample_path,consent_audio_path,consent_confirmed,authorization_confirmed")
    .eq("id", profileId).eq("user_id", ctx.user.id).is("deleted_at", null).maybeSingle()
  if (profileError) return fail("No fue posible verificar el perfil", 503)
  if (!profile) return fail("Perfil no encontrado", 404)
  if (!profile.sample_path || !profile.consent_audio_path || !profile.consent_confirmed || !profile.authorization_confirmed)
    return fail("Se requiere una muestra propia y consentimiento vocal registrado", 403)

  const audioPath = `${ctx.user.id}/${profileId}/kaggle-${crypto.randomUUID()}.wav`
  const { error: storageError } = await ctx.supabase.storage.from(BUCKET).upload(
    audioPath, bytes, { contentType: "audio/wav", upsert: false },
  )
  if (storageError) return fail("No se pudo guardar el WAV en la biblioteca privada", 503)

  const { data: record, error: recordError } = await ctx.supabase.from("audio_voice_render_jobs").insert({
    user_id: ctx.user.id,
    voice_profile_id: profileId,
    text: "Generación manual en Kaggle (el texto no se envió a EDUAI)",
    status: "completed",
    progress: 100,
    stage: "manual_import",
    provider: "kaggle-manual",
    engine: "chatterbox-multilingual-v3",
    audio_bucket: BUCKET,
    audio_path: audioPath,
    metadata: { imported_manually: true, verified_by_user: true },
    completed_at: new Date().toISOString(),
  }).select("id,created_at").single()

  if (recordError || !record) {
    await ctx.supabase.storage.from(BUCKET).remove([audioPath])
    return fail("No se pudo registrar el audio en la biblioteca", 503)
  }

  const { data: signed } = await ctx.supabase.storage.from(BUCKET).createSignedUrl(audioPath, 600)
  return NextResponse.json({
    ok: true,
    id: record.id,
    created_at: record.created_at,
    audio_url: signed?.signedUrl || null,
    message: "WAV de Kaggle guardado en tu biblioteca privada. El perfil continúa pendiente de motor permanente.",
  }, { headers: { "Cache-Control": "private, no-store" } })
}

export async function listKaggleWavs() {
  const ctx = await session()
  if (!ctx.valid || !ctx.user) return fail(ctx.error || "Requiere administrador adulto, MFA y zona protegida", 403)
  const { data: rows, error } = await ctx.supabase.from("audio_voice_render_jobs")
    .select("id,voice_profile_id,audio_bucket,audio_path,created_at")
    .eq("user_id", ctx.user.id).eq("provider", "kaggle-manual")
    .eq("status", "completed")
    .order("created_at", { ascending: false }).limit(20)
  if (error) return fail("No se pudo consultar la biblioteca de Kaggle", 503)
  const outputs = await Promise.all((rows || []).map(async row => {
    if (!row.audio_path || row.audio_bucket !== BUCKET) return null
    const { data } = await ctx.supabase.storage.from(BUCKET).createSignedUrl(row.audio_path, 600)
    if (!data?.signedUrl) return null
    return { id: row.id, profile_id: row.voice_profile_id, created_at: row.created_at, audio_url: data.signedUrl }
  }))
  return NextResponse.json({ ok: true, audios: outputs.filter(Boolean) }, {
    headers: { "Cache-Control": "private, no-store" },
  })
}
