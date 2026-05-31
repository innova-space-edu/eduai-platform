import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const birthDate = typeof body?.birthDate === "string" ? body.birthDate : ""
    const rut = typeof body?.rut === "string" ? body.rut : null
    const accepted = body?.accepted === true

    if (!accepted) {
      return NextResponse.json({ error: "Debes aceptar los términos específicos de clonación de voz" }, { status: 400 })
    }
    if (!birthDate) {
      return NextResponse.json({ error: "Debes registrar tu fecha de nacimiento" }, { status: 400 })
    }

    const { error } = await supabase.rpc("accept_voice_cloning_terms", {
      p_terms_version: "voice-cloning-v1",
      p_birth_date: birthDate,
      p_rut: rut,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo registrar el consentimiento" }, { status: 500 })
  }
}
