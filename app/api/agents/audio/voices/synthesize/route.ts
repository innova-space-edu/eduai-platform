import { NextResponse } from "next/server"
import { EdgeTTS, Constants } from "@andresaya/edge-tts"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"
import { convertVoiceWithOpenVoice } from "@/lib/audio/gradio-openvoice-engine"

export const runtime = "nodejs"
export const maxDuration = 300

const OPENVOICE_BASE_TTS_VOICE = process.env.OPENVOICE_BASE_TTS_VOICE || "es-CL-CatalinaNeural"
const MAX_TEXT_LENGTH = 900

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH)
}

async function buildBaseSpeech(text: string) {
  const tts = new EdgeTTS()
  await tts.synthesize(text, OPENVOICE_BASE_TTS_VOICE, {
    outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    rate: "+0%",
    pitch: "+0Hz",
    volume: "100%",
  })
  const buffer = tts.toBuffer()
  if (!buffer || buffer.length < 500) throw new Error("No se pudo generar la voz base para OpenVoice")
  return new Uint8Array(buffer)
}

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
  const text = cleanText(body?.text)

  if (!profileId) return NextResponse.json({ error: "profileId es requerido" }, { status: 400 })
  if (!text) return NextResponse.json({ error: "Escribe un texto para probar la voz" }, { status: 400 })

  const { data: profile, error: profileError } = await supabase
    .from("audio_voice_profiles")
    .select("id, display_name, status, sample_bucket, sample_path, consent_confirmed, authorization_confirmed, internal_use_enabled")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: "Perfil vocal no encontrado" }, { status: 404 })
  if (profile.status !== "ready" || !profile.internal_use_enabled || !profile.sample_path) {
    return NextResponse.json({ error: "Procesa esta voz antes de usarla" }, { status: 409 })
  }
  if (!profile.consent_confirmed || !profile.authorization_confirmed) {
    return NextResponse.json({ error: "La voz no tiene autorización verificable" }, { status: 403 })
  }

  try {
    const [{ data: signed, error: signedError }, sourceBytes] = await Promise.all([
      supabase.storage
        .from(profile.sample_bucket || "voice-clones")
        .createSignedUrl(profile.sample_path, 10 * 60),
      buildBaseSpeech(text),
    ])

    if (signedError || !signed?.signedUrl) {
      throw new Error(signedError?.message || "No se pudo abrir la muestra vocal privada")
    }

    const converted = await convertVoiceWithOpenVoice({
      referenceAudioUrl: signed.signedUrl,
      sourceBytes,
      sourceMime: "audio/mpeg",
    })

    const usedAt = new Date().toISOString()
    await supabase
      .from("audio_voice_profiles")
      .update({ last_used_at: usedAt, updated_at: usedAt })
      .eq("id", profileId)
      .eq("user_id", user.id)

    await supabase.from("audio_voice_events").insert({
      user_id: user.id,
      voice_profile_id: profileId,
      event_type: "voice_synthesized",
      metadata: {
        provider: "openvoice-v2-zerogpu",
        base_voice: OPENVOICE_BASE_TTS_VOICE,
        text_chars: text.length,
      },
    })

    return new NextResponse(Buffer.from(converted.bytes), {
      status: 200,
      headers: {
        "Content-Type": converted.mime || "audio/wav",
        "Cache-Control": "no-store, private",
        "X-Voice-Provider": "openvoice-v2-zerogpu",
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo generar la voz clonada" },
      { status: 502 },
    )
  }
}
