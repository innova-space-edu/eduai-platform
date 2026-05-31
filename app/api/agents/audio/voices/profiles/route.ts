import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateVoiceSecuritySession } from "@/lib/audio/voice-security"

export const runtime = "nodejs"

export async function GET() {
  const { valid, supabase } = await validateVoiceSecuritySession()
  if (!valid) return NextResponse.json({ error: "Sesión protegida vencida" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await supabase
    .from("audio_voice_profiles")
    .select("id, display_name, source_kind, status, sample_path, model_provider, provider_voice_id, internal_use_enabled, default_voice, adult_confirmed, consent_confirmed, authorization_confirmed, consented_at, created_at, updated_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profiles: data || [] })
}

export async function POST(req: Request) {
  const { valid, supabase } = await validateVoiceSecuritySession()
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
        consented_at: new Date().toISOString(),
      })
      .select("id, display_name, source_kind, status, sample_path, internal_use_enabled, default_voice, created_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("audio_voice_events").insert([
      { user_id: user.id, voice_profile_id: data.id, event_type: "created", metadata: { source_kind: sourceKind } },
      { user_id: user.id, voice_profile_id: data.id, event_type: "consent_recorded", metadata: { version: "voice-cloning-v1", source_kind: sourceKind } },
    ])

    return NextResponse.json({ ok: true, profile: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo crear el perfil vocal" }, { status: 500 })
  }
}
