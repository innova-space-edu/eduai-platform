import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"

export const runtime = "nodejs"

const BUCKET = "voice-clones"
const MAX_MB = 15
const MAX_BYTES = MAX_MB * 1024 * 1024
const EXTENSIONS = new Set(["mp3", "wav", "m4a", "webm", "ogg"])

function safeFilename(value: string) {
  return String(value || "muestra.wav")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120) || "muestra.wav"
}

export async function POST(req: Request) {
  const { valid, supabase } = await validateVoiceSecuritySession()
  if (!valid) return NextResponse.json({ error: "Sesión protegida vencida" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const profileId = typeof body?.profileId === "string" ? body.profileId : ""
    const filename = safeFilename(String(body?.filename || "muestra.wav"))
    const size = Number(body?.size || 0)
    const extension = filename.split(".").pop()?.toLowerCase() || ""

    if (!profileId) return NextResponse.json({ error: "profileId requerido" }, { status: 400 })
    if (!EXTENSIONS.has(extension)) return NextResponse.json({ error: "Usa MP3, WAV, M4A, WEBM u OGG" }, { status: 400 })
    if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "Archivo vacío o inválido" }, { status: 400 })
    if (size > MAX_BYTES) return NextResponse.json({ error: `La muestra supera ${MAX_MB} MB` }, { status: 413 })

    const { data: profile } = await supabase
      .from("audio_voice_profiles")
      .select("id")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: "Perfil vocal no encontrado" }, { status: 404 })

    const filePath = `${user.id}/${profileId}/${Date.now()}-${filename}`
    return NextResponse.json({ ok: true, bucket: BUCKET, filePath, filename, maxSizeMB: MAX_MB })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo preparar la muestra" }, { status: 500 })
  }
}
