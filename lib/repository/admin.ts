import "server-only"

import { createClient as createServerClient } from "@/lib/supabase/server"
import { getRepositoryAdminClient } from "@/lib/repository/public-access"

export async function requireRepositoryAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { user: null, admin: null, error: "No autenticado" }

  const admin = getRepositoryAdminClient()
  const { data, error } = await admin
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  if (error || !data) return { user: null, admin: null, error: "Acceso denegado" }
  return { user, admin, error: null }
}
