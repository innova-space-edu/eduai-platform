import { NextRequest, NextResponse } from "next/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const { valid, supabase } = await validateVoiceSecuritySession()
  if (!valid) return NextResponse.json({ error: "Sesión protegida requerida" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const profileId = req.nextUrl.searchParams.get("profileId") || ""
  if (!profileId) return NextResponse.json({ error: "profileId requerido" }, { status: 400 })

  const { data, error } = await supabase
    .from("audio_voice_profiles")
    .select("id, display_name, status, sample_path, model_provider, provider_voice_id, internal_use_enabled, processing_error, processed_at, updated_at")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Perfil vocal no encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true, profile: data })
}
