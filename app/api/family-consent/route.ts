import { NextRequest } from "next/server"
import { FAMILY_CONSENT_VERSION, normalizeDecisions } from "@/lib/family-consent/config"
import { createFamilyAdminClient, privateResponse, safeEmail, safeText, sha256, validToken } from "@/lib/family-consent/server"

export const runtime = "nodejs"
const PLATFORM = "eduai" as const
const VALID_RELATIONS = new Set(["madre", "padre", "representante_legal", "cuidador_personal"])

async function invitation(token: unknown) {
  if (!validToken(token)) return null
  const db = createFamilyAdminClient()
  const { data, error } = await db.from("family_authorization_requests")
    .select("id,platform,institution_name,guardian_email,document_version,status,expires_at")
    .eq("token_sha256", sha256(token))
    .eq("platform", PLATFORM)
    .maybeSingle()
  if (error || !data || data.document_version !== FAMILY_CONSENT_VERSION) return null
  if (data.status !== "invited" || Date.parse(data.expires_at) < Date.now()) return null
  return data
}

// The invitation is a delivery capability, not proof of adult identity or legal authority.
async function invitationForRevocation(token: unknown) {
  if (!validToken(token)) return null
  const db = createFamilyAdminClient()
  const { data } = await db.from("family_authorization_requests")
    .select("id,guardian_email,guardian_full_name,student_user_id,status,platform")
    .eq("token_sha256", sha256(token)).eq("platform", PLATFORM).maybeSingle()
  return data
}

// The same privately delivered link can be used to withdraw a decision later.
// No token or credentials are persisted in browser storage.
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const row = await invitationForRevocation(body.token)
    const email = safeEmail(body.guardianEmail)
    const name = safeText(body.signatureName, 180)
    if (!row || !email || email !== row.guardian_email || !name ||
        name.toLocaleLowerCase("es-CL") !== String(row.guardian_full_name || "").toLocaleLowerCase("es-CL") ||
        body.confirmRevocation !== true) {
      return privateResponse({ error: "Verifica el enlace privado, correo y nombre del firmante." }, 400)
    }
    if (row.status === "revoked") return privateResponse({ ok: true, status: "revoked" })
    if (!["approved", "submitted"].includes(row.status)) return privateResponse({ error: "La autorización no admite revocación en ese estado." }, 409)
    const db = createFamilyAdminClient()
    const timestamp = new Date().toISOString()
    const { error } = await db.from("family_authorization_requests")
      .update({ status: "revoked", revoked_at: timestamp, updated_at: timestamp, decision_note: "Revocación por enlace privado y confirmación del firmante" })
      .eq("id", row.id).eq("status", row.status)
    if (error) return privateResponse({ error: "No se pudo tramitar la revocación." }, 503)
    await db.from("family_authorization_events").insert({
      request_id: row.id, event_type: "guardian_self_revocation",
      evidence_json: { timestamp, method: "private_invitation_link_and_matching_signer" },
    })
    return privateResponse({ ok: true, status: "revoked", message: "Revocación registrada. Contacta al establecimiento si deseas modificar otras autorizaciones." })
  } catch {
    return privateResponse({ error: "No se pudo completar la revocación." }, 503)
  }
}

export async function GET(request: NextRequest) {
  try {
    const data = await invitation(request.nextUrl.searchParams.get("token"))
    if (!data) return privateResponse({ error: "Invitación inválida, usada o vencida" }, 404)
    return privateResponse({
      platform: PLATFORM,
      institutionName: data.institution_name,
      documentVersion: data.document_version,
      expiresAt: data.expires_at,
      status: "pending_signature",
    })
  } catch {
    return privateResponse({ error: "No fue posible consultar la solicitud" }, 503)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const record = await invitation(body.token)
    if (!record) return privateResponse({ error: "Invitación inválida, usada o vencida" }, 404)

    const guardianName = safeText(body.guardianName, 180)
    const studentName = safeText(body.studentName, 180)
    const signer = safeText(body.signatureName, 180)
    const email = safeEmail(body.guardianEmail)
    const relation = safeText(body.relationship, 40)
    if (!guardianName || guardianName.length < 5 || !studentName || studentName.length < 5 ||
        !email || email !== record.guardian_email || !VALID_RELATIONS.has(relation) ||
        guardianName.toLocaleLowerCase("es-CL") !== signer.toLocaleLowerCase("es-CL") ||
        body.guardianDeclaration !== true || body.acceptsElectronicSignature !== true ||
        body.documentVersion !== record.document_version) {
      return privateResponse({ error: "Completa identidad declarada, vínculo, firma y confirmaciones requeridas." }, 400)
    }
    const decisions = normalizeDecisions(PLATFORM, body.decisions)
    const signedAt = new Date().toISOString()
    const signedDocument = JSON.stringify({
      requestId: record.id, version: record.document_version, platform: PLATFORM,
      institution: record.institution_name, studentName, guardianName,
      guardianEmail: email, relationship: relation, choices: decisions, signedAt,
      declaration: "Declaro actuar como madre, padre, representante legal o titular del cuidado personal y firmar electrónicamente estas elecciones.",
    })
    const signatureHash = sha256(signedDocument)
    const db = createFamilyAdminClient()
    const { data: saved, error } = await db.from("family_authorization_requests")
      .update({
        status: "submitted", submitted_at: signedAt, guardian_full_name: guardianName,
        student_name_declared: studentName, guardian_relationship: relation,
        guardian_declaration: true, signature_name: signer,
        signature_method: "electronic_simple", signature_sha256: signatureHash,
        decisions, updated_at: signedAt,
      })
      .eq("id", record.id).eq("status", "invited")
      .select("id").maybeSingle()
    if (error || !saved) return privateResponse({ error: "La invitación ya fue utilizada. Consulta al administrador." }, 409)
    await db.from("family_authorization_events").insert({
      request_id: saved.id, event_type: "guardian_signed_pending_verification",
      evidence_json: {
        document_version: record.document_version,
        signature_sha256: signatureHash,
        signature_method: "electronic_simple",
        signed_at: signedAt,
        decisions,
        legal_capacity_verified: false,
        note: "Link + electronic signature: identity and representation have not been verified",
      },
    })
    return privateResponse({
      ok: true,
      status: "submitted_pending_identity_and_capacity_verification",
      receipt: saved.id,
      message: "Formulario recibido. La institución verificará identidad y facultades antes de habilitar las autorizaciones.",
    })
  } catch {
    return privateResponse({ error: "No se pudo registrar el formulario. Inténtalo más tarde." }, 500)
  }
}
