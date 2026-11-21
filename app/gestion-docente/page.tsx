import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export default async function GestionDocenteEntry() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect("/login")
  const { data: access, error: accessError } = await supabase.from("eduai_user_access").select("account_type,age_band,access_tier").eq("user_id", user.id).maybeSingle()
  if (accessError || access?.account_type !== "teacher" || access.age_band !== "adult" || !["standard","teacher","admin"].includes(access.access_tier)) redirect("/dashboard")
  redirect("https://gestion-docente.innova-space-edu.cl")
}
