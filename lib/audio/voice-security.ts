import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export const VOICE_SECURITY_COOKIE = "eduai_voice_cloning_session"
export const VOICE_SECURITY_TTL_SECONDS = 30 * 24 * 60 * 60

/** Clonación vocal exclusiva para administradores mayores de 18 años.
 * Una sesión MFA válida por sí sola nunca concede este permiso.
 * RPCs security-definer con auth.uid()/auth.email(), sin confiar en claims
 * aportados por el navegador ni en los checkboxes de consentimiento.
 */
export async function checkVoiceAdminEligibility(supabase: Awaited<ReturnType<typeof createClient>>, requireAdult = true) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { allowed: false, error: "No autenticado" }
  const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin")
  if (roleError) return { allowed: false, error: "No se pudo verificar el rol de administración" }
  if (isAdmin !== true) return { allowed: false, error: "La clonación de voz es exclusiva de la administración autorizada" }
  if (requireAdult) {
    const { data: isAdult, error: adultError } = await supabase.rpc("is_adult_profile")
    if (adultError) return { allowed: false, error: "No se pudo verificar la mayoría de edad" }
    if (isAdult !== true) return { allowed: false, error: "La clonación de voz requiere una cuenta administradora mayor de 18 años" }
  }
  return { allowed: true, error: "" }
}

export async function getVoiceSecurityToken() {
  const cookieStore = await cookies()
  return cookieStore.get(VOICE_SECURITY_COOKIE)?.value || ""
}

export async function validateVoiceSecuritySession() {
  const supabase = await createClient()
  const token = await getVoiceSecurityToken()
  if (!token) return { valid: false, token: "", supabase, error: "" }

  const eligibility = await checkVoiceAdminEligibility(supabase)
  if (!eligibility.allowed) return { valid: false, token, supabase, error: eligibility.error }

  let lastError = ""
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase.rpc("validate_voice_security_session", {
      p_session_token: token,
    })

    if (!error) {
      return {
        valid: data === true,
        token,
        supabase,
        error: "",
      }
    }

    lastError = error.message || "No se pudo validar la sesión protegida"
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 180))
    }
  }

  return {
    valid: false,
    token,
    supabase,
    error: lastError,
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
