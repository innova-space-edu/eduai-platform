import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import {
  VOICE_SECURITY_COOKIE,
  VOICE_SECURITY_TTL_SECONDS,
  getVoiceSecurityToken,
  touchVoiceSecuritySession,
  validateVoiceSecuritySession,
} from "@/lib/audio/voice-security"

export const runtime = "nodejs"

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: VOICE_SECURITY_TTL_SECONDS,
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, authenticated: false }, { status: 401 })

  const { valid } = await validateVoiceSecuritySession()
  const { data: profile } = await supabase
    .from("profiles")
    .select("birth_date, rut, voice_cloning_terms_accepted_at, voice_cloning_terms_version")
    .eq("id", user.id)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    authenticated: true,
    unlocked: valid,
    profile: profile || null,
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await supabase.rpc("open_voice_security_session")
  const row = Array.isArray(data) ? data[0] : null

  if (error || !row?.session_token) {
    return NextResponse.json({ error: error?.message || "No se pudo abrir la sesión protegida" }, { status: 403 })
  }

  const response = NextResponse.json({ ok: true, unlocked: true, expiresAt: row.expires_at })
  response.cookies.set(VOICE_SECURITY_COOKIE, row.session_token, cookieOptions())
  return response
}

export async function PATCH() {
  const result = await touchVoiceSecuritySession()
  if (!result.valid) {
    const response = NextResponse.json({ ok: false, unlocked: false }, { status: 401 })
    response.cookies.delete(VOICE_SECURITY_COOKIE)
    return response
  }

  const token = await getVoiceSecurityToken()
  const response = NextResponse.json({ ok: true, unlocked: true, expiresAt: result.expiresAt })
  if (token) response.cookies.set(VOICE_SECURITY_COOKIE, token, cookieOptions())
  return response
}

export async function DELETE() {
  const supabase = await createClient()
  const token = await getVoiceSecurityToken()
  if (token) {
    await supabase.rpc("revoke_voice_security_session", { p_session_token: token })
  }

  const response = NextResponse.json({ ok: true, unlocked: false })
  response.cookies.delete(VOICE_SECURITY_COOKIE)
  return response
}
