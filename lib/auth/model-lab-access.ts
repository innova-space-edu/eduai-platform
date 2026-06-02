import { createClient } from "@/lib/supabase/server"

export async function getModelLabAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { status: "unauthenticated" as const, user: null, supabase }

  const { data: allowed } = await supabase.rpc("has_model_lab_admin_access")
  if (allowed !== true) return { status: "forbidden" as const, user, supabase }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== "aal2") return { status: "mfa_required" as const, user, supabase }

  const { data: enabled } = await supabase.rpc("is_model_lab_admin")
  if (enabled !== true) return { status: "forbidden" as const, user, supabase }

  return { status: "ok" as const, user, supabase }
}
