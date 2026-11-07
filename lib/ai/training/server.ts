import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
export function trainingAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Credenciales de servidor no disponibles")
  return createClient(url,key,{ auth:{persistSession:false,autoRefreshToken:false} })
}
export async function trainingUser(admin = false) {
  const supabase = await createServerClient()
  const {data:{user}} = await supabase.auth.getUser()
  if (!user) return null
  if (admin) {
    if (!user.email) return null
    const {data} = await supabase.from("admin_emails").select("email").eq("email",user.email).maybeSingle()
    if (!data) return null
  }
  return {user,supabase}
}
export function isAdult(birthDate: unknown, now = new Date()) {
  if (typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false
  const birth = new Date(birthDate+"T00:00:00Z")
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0,10)!==birthDate) return false
  const cutoff = new Date(Date.UTC(now.getUTCFullYear()-18,now.getUTCMonth(),now.getUTCDate()))
  return birth <= cutoff && birth.getUTCFullYear() >= 1900
}
