import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export const VOICE_SECURITY_COOKIE = "eduai_voice_cloning_session"
export const VOICE_SECURITY_TTL_SECONDS = 30 * 24 * 60 * 60

export async function getVoiceSecurityToken() {
  const cookieStore = await cookies()
  return cookieStore.get(VOICE_SECURITY_COOKIE)?.value || ""
}

export async function validateVoiceSecuritySession() {
  const supabase = await createClient()
  const token = await getVoiceSecurityToken()
  if (!token) return { valid: false, token: "", supabase }

  const { data, error } = await supabase.rpc("validate_voice_security_session", {
    p_session_token: token,
  })

  return {
    valid: !error && data === true,
    token,
    supabase,
    error: error?.message || "",
  }
}

export async function touchVoiceSecuritySession() {
  const supabase = await createClient()
  const token = await getVoiceSecurityToken()
  if (!token) return { valid: false, expiresAt: null as string | null }

  const { data, error } = await supabase.rpc("touch_voice_security_session", {
    p_session_token: token,
  })

  const row = Array.isArray(data) ? data[0] : null
  return {
    valid: !error && row?.valid === true,
    expiresAt: row?.expires_at || null,
    error: error?.message || "",
  }
}
