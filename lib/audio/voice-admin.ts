import "server-only"
import { createClient } from "@/lib/supabase/server"

// EDUAI solo permite clonar voces a las cuentas registradas como administradoras.
// El correo proviene del usuario autenticado de Supabase, nunca del navegador.
export async function isVoiceCloningAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
): Promise<boolean> {
  if (!user.id || !user.email) return false
  const { data, error } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email.trim().toLowerCase())
    .maybeSingle()
  return !error && !!data
}
