import { createClient } from "@/lib/supabase/server"
import { createFamilyAdminClient, privateResponse } from "@/lib/family-consent/server"

export const runtime = "nodejs"

export async function GET() {
  try {
    const auth = await createClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user?.email) return privateResponse({ error: "Inicia sesión." }, 401)
    const { data: admin, error: adminError } = await auth.from("admin_emails")
      .select("email").eq("email", user.email.toLowerCase()).maybeSingle()
    if (adminError || !admin) return privateResponse({ error: "Acceso exclusivo para administración." }, 403)

    const db = createFamilyAdminClient()
    const { data, error } = await db.from("eduai_family_approval_acts")
      .select("request_id,folio,student_user_id,student_name,guardian_name,guardian_relationship,institution_name,reviewer_user_id,approved_at,identity_verified_at,legal_capacity_verified_at,verified_method,evidence_reference,document_version,decisions,archived_at")
      .order("approved_at", { ascending: false }).limit(300)
    if (error) return privateResponse({ error: "No fue posible consultar las actas." }, 503)
    const records = data || []
    const adminIds = [...new Set(records.map(item => item.reviewer_user_id))]
    const requestIds = records.map(item => item.request_id)
    const { data: reviewers, error: reviewerError } = adminIds.length
      ? await db.from("profiles").select("id,name,email").in("id", adminIds)
      : { data: [], error: null }
    const { data: requests, error: requestError } = requestIds.length
      ? await db.from("family_authorization_requests").select("id,status,revoked_at").in("id", requestIds)
      : { data: [], error: null }
    if (reviewerError || requestError) return privateResponse({ error: "No se pudieron verificar los responsables y estados." }, 503)
    const byReviewer = new Map((reviewers || []).map(row => [row.id, row.name || row.email || "Administrador"]))
    const byRequest = new Map((requests || []).map(row => [row.id, row]))
    return privateResponse({ acts: records.map(item => ({
      ...item,
      reviewer_name: byReviewer.get(item.reviewer_user_id) || "Administrador registrado",
      authorization_status: byRequest.get(item.request_id)?.status || "sin estado",
      revoked_at: byRequest.get(item.request_id)?.revoked_at || null,
    })), hasMore: records.length === 300 })
  } catch {
    return privateResponse({ error: "No fue posible consultar las actas." }, 503)
  }
}
