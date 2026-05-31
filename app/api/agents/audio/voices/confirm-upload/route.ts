import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { valid, supabase } = await validateVoiceSecuritySession()
  if (!valid) return NextResponse.json({ error: "Sesión protegida vencida" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const profileId = typeof body?.profileId === "string" ? body.profileId : ""
    const filePath = typeof body?.filePath === "string" ? body.filePath : ""

    if (!profileId || !filePath) {
      return NextResponse.json({ error: "profileId y filePath son requeridos" }, { status: 400 })
    }

    if (!filePath.startsWith(`${user.id}/${profileId}/`)) {
      return NextResponse.json({ error: "Ruta de muestra inválida" }, { status: 403 })
    }

    const { data: stored } = await supabase.storage
      .from("voice-clones")
      .list(`${user.id}/${profileId}`, { limit: 100 })

    const expectedName = filePath.split("/").pop()
    if (!stored?.some((item) => item.name === expectedName)) {
      return NextResponse.json({ error: "La muestra todavía no está disponible en Storage" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("audio_voice_profiles")
      .update({ sample_path: filePath, status: "draft", updated_at: new Date().toISOString() })
      .eq("id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id, display_name, source_kind, status, sample_path, internal_use_enabled, default_voice, created_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("audio_voice_events").insert({
      user_id: user.id,
      voice_profile_id: profileId,
      event_type: "sample_uploaded",
      metadata: { sample_path: filePath },
    })

    return NextResponse.json({ ok: true, profile: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo confirmar la muestra" }, { status: 500 })
  }
}
