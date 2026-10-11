import { NextRequest } from "next/server"
import { createClient as createSessionClient } from "@/lib/supabase/server"
import { FAMILY_CONSENT_VERSION } from "@/lib/family-consent/config"
import { createFamilyAdminClient, createInvitationToken, privateResponse, safeEmail, safeText } from "@/lib/family-consent/server"

export const runtime = "nodejs"
const PLATFORM = "eduai" as const

async function authorizedAdmin() {
  const supabase = await createSession()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: matching, error: roleError } = await supabase.from("admin_emails").select("email").eq("email", user.email?.toLowerCase() ?? "").maybeSingle()
  if (roleError || !matching) return null
  return user
}

async function createSession() {
  const supabase = await createSessionClient()
  return supabase
}

export async function GET() {
  try {
    const admin = await authorizedAdmin()
    if (!admin) return privateResponse({ error: "Solo administración institucional autorizada." }, 403)
    const db = createFamilyAdminClient()
    const { data, error } = await db.from("family_authorization_requests")
      .select("id,student_user_id,institution_name,guardian_email,status,issued_at,expires_at,submitted_at,guardian_full_name,guardian_relationship,student_name_declared,decisions,verified_method,reviewed_at")
      .eq("platform", PLATFORM).order("issued_at", { ascending: false }).limit(60)
    if (error) return privateResponse({ error: "No se pudo consultar el registro." }, 503)
    return privateResponse({ requests: data ?? [] })
  } catch {
    return privateResponse({ error: "Servicio de autorizaciones no disponible." }, 503)
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await authorizedAdmin()
    if (!admin) return privateResponse({ error: "Solo administración institucional autorizada." }, 403)
    const body = await request.json().catch(() => ({}))
    const action = safeText(body.action, 20)
    const db = createFamilyAdminClient()
    if (action === "issue") {
      const studentId = safeText(body.studentUserId, 40)
      const guardianEmail = safeEmail(body.guardianEmail)
      const institutionName = safeText(body.institutionName, 140)
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuid.test(studentId) || !guardianEmail || institutionName.length < 3) {
        return privateResponse({ error: "Completa estudiante, institución y correo válido del adulto." }, 400)
      }
      const userData = await db.auth.admin.getUserById(studentId)
      if (userData.error || !userData.data.user) return privateResponse({ error: "Cuenta de estudiante no encontrada" }, 404)
      const birthDate = String(userData.data.user.user_metadata?.birth_date || "")
      const d = new Date(birthDate + "T00:00:00")
      if (!birthDate || Number.isNaN(d.getTime()) || d < new Date(Date.now() - 18*365.25*86400000)) return privateResponse({ error: "Debes confirmar que la cuenta pertenece a un menor de edad antes de emitir la invitación." }, 400)
      const { token, tokenHash } = createInvitationToken()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 7 * 86400000).toISOString()
      const { data: created, error } = await db.from("family_authorization_requests")
        .insert({
          student_user_id: studentId, platform: PLATFORM,
          institution_name: institutionName, guardian_email: guardianEmail,
          token_sha256: tokenHash, document_version: FAMILY_CONSENT_VERSION,
          expires_at: expiresAt, issued_by: admin.id,
        }).select("id").single()
      if (error || !created) return privateResponse({ error: "No se pudo emitir la invitación." }, 500)
      await db.from("family_authorization_events").insert({
        request_id: created.id, event_type: "invitation_issued", performed_by: admin.id,
        evidence_json: { document_version: FAMILY_CONSENT_VERSION, expires_at: expiresAt },
      })
      const origin = new URL(request.url).origin
      const invitationUrl = `${origin}/autorizacion-familiar/${encodeURIComponent(token)}`
      return privateResponse({
        ok: true, requestId: created.id, invitationUrl, expiresAt,
        message: "Enlace privado de un solo uso. Entregar únicamente al adulto responsable; el enlace no acredita identidad ni es una firma.",
      })
    }

    if (action === "approve" || action === "reject" || action === "revoke") {
      const requestId = safeText(body.requestId, 40)
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) return privateResponse({ error: "Solicitud inválida" }, 400)
      const { data: record, error: lookupError } = await db.from("family_authorization_requests")
        .select("id,status,student_user_id,guardian_full_name,signature_sha256,decisions")
        .eq("id", requestId).eq("platform", PLATFORM).maybeSingle()
      if (lookupError || !record) return privateResponse({ error: "Solicitud no encontrada" }, 404)
      if (action === "approve") {
        const evidenceRef = safeText(body.evidenceRef, 180)
        const verifiedMethod = safeText(body.verifiedMethod, 32)
        if (record.status !== "submitted" || body.identityVerified !== true ||
          body.legalCapacityVerified !== true || evidenceRef.length < 5 ||
          !["manual_institution", "qualified_eid_provider"].includes(verifiedMethod)) {
          return privateResponse({ error: "Requiere firma presentada y verificación documentada de identidad, vínculo y facultades." }, 400)
        }
        const { error } = await db.from("family_authorization_requests").update({
          status: "approved", identity_verified_at: new Date().toISOString(),
          legal_capacity_verified_at: new Date().toISOString(), verified_by: admin.id,
          verified_method: verifiedMethod, verified_evidence_ref: evidenceRef,
          reviewed_by: admin.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", record.id).eq("status", "submitted")
        if (error) return privateResponse({ error: "No se pudo aprobar el formulario" }, 500)
      } else {
        if (action === "revoke" && record.status !== "approved") {
          return privateResponse({ error: "Solo una autorización aprobada puede revocarse." }, 400)
        }
        if (action === "reject" && !["invited","submitted"].includes(record.status)) {
          return privateResponse({ error: "La solicitud no puede rechazarse en este estado." }, 400)
        }
        const { error } = await db.from("family_authorization_requests").update({
          status: action === "revoke" ? "revoked" : "rejected",
          revoked_at: action === "revoke" ? new Date().toISOString() : null,
          reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
          decision_note: safeText(body.note, 300), updated_at: new Date().toISOString(),
        }).eq("id", record.id).eq("status", record.status)
        if (error) return privateResponse({ error: "No se pudo cambiar el estado." }, 500)
      }
      await db.from("family_authorization_events").insert({
        request_id: record.id, event_type: action === "approve" ? "identity_and_capacity_approved" : action,
        performed_by: admin.id,
        evidence_json: { verified_method: safeText(body.verifiedMethod, 32), evidence_reference: safeText(body.evidenceRef, 180) },
      })
      return privateResponse({ ok: true, status: action === "approve" ? "approved" : action === "revoke" ? "revoked" : "rejected" })
    }
    return privateResponse({ error: "Operación no admitida." }, 400)
  } catch {
    return privateResponse({ error: "No se pudo procesar la solicitud." }, 500)
  }
}
