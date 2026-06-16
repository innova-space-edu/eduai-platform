import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const admin = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false } })

function res(data: any, status = 200) { return NextResponse.json(data, { status }) }
function codeClean(value: unknown) { return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) }
function rutClean(value: unknown) { return String(value || "").toUpperCase().replace(/[^0-9K]/g, "").slice(0, 9) }
function maskRut(value: unknown) { const c = rutClean(value); return c.length < 4 ? "••••" : `••.•••.${c.slice(-4, -1)}-${c.slice(-1)}` }
function hashCode(value: unknown) {
  return createHash("sha256").update("eduai-exam-access:").update(process.env.EXAM_ACCESS_CODE_SECRET || serviceKey || anonKey || "fallback").update(":").update(codeClean(value)).digest("hex")
}
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(8)
  let out = ""
  for (let i = 0; i < 8; i++) out += chars[bytes[i] % chars.length]
  return `${out.slice(0, 4)}-${out.slice(4)}`
}
async function getUser(req: NextRequest) {
  const header = req.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token || !anonKey) return null
  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
async function proxyExam(req: NextRequest, payload: any) {
  const target = new URL("/api/agents/examen-docente", req.url)
  return fetch(target.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
}
async function accessRow(examId: string, accessCode: string) {
  const { data: row, error } = await admin.from("exam_access_codes").select("id, exam_id, student_id, status, expires_at, used_at, used_client_attempt_id").eq("exam_id", examId).eq("code_hash", hashCode(accessCode)).maybeSingle()
  if (error) throw error
  if (!row) return { error: "Código inválido o no corresponde a este examen", status: 404 as const }
  if (row.status === "revoked" || row.status === "expired") return { error: "Este código ya no está activo", status: 403 as const }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await admin.from("exam_access_codes").update({ status: "expired" }).eq("id", row.id)
    return { error: "Este código venció. Solicita uno nuevo al docente", status: 403 as const }
  }
  const { data: student, error: stError } = await admin.from("student_roster").select("id, student_name, course, rut, rut_clean, active").eq("id", row.student_id).maybeSingle()
  if (stError) throw stError
  if (!student || student.active !== true) return { error: "El estudiante asociado no está activo", status: 403 as const }
  return { row, student }
}

export async function POST(req: NextRequest) {
  try {
    if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor")
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "")

    if (["list_exams", "list_roster", "generate_code", "list_codes"].includes(action)) {
      const user = await getUser(req)
      if (!user) return res({ success: false, error: "Sesión docente requerida" }, 401)
      if (action === "list_exams") {
        const { data, error } = await admin.from("teacher_exams").select("id, title, topic, code, status, created_at").eq("teacher_id", user.id).order("created_at", { ascending: false }).limit(100)
        if (error) throw error
        return res({ success: true, exams: data || [] })
      }
      if (action === "list_roster") {
        const course = String(body.course || "1° Medio A").trim()
        const { data, error } = await admin.from("student_roster").select("id, student_name, course, rut").eq("school_year", String(body.schoolYear || "2026")).eq("course", course).eq("active", true).order("student_name").limit(100)
        if (error) throw error
        return res({ success: true, students: (data || []).map((s: any) => ({ id: s.id, studentName: s.student_name, course: s.course, rutMasked: maskRut(s.rut) })) })
      }
      if (action === "generate_code") {
        const examId = String(body.examId || "")
        const studentId = String(body.studentId || "")
        if (!examId || !studentId) return res({ success: false, error: "Falta examen o estudiante" }, 400)
        const { data: exam, error: examError } = await admin.from("teacher_exams").select("id, teacher_id, title, status").eq("id", examId).maybeSingle()
        if (examError) throw examError
        if (!exam || exam.teacher_id !== user.id) return res({ success: false, error: "No autorizado" }, 403)
        const { data: student, error: stError } = await admin.from("student_roster").select("id, student_name, course, rut, active").eq("id", studentId).maybeSingle()
        if (stError) throw stError
        if (!student || student.active !== true) return res({ success: false, error: "Estudiante no disponible" }, 404)
        await admin.from("exam_access_codes").update({ status: "revoked" }).eq("exam_id", examId).eq("student_id", studentId).eq("status", "active")
        const code = makeCode()
        const expiresMinutes = Math.min(180, Math.max(10, Number(body.expiresMinutes || 45)))
        const expiresAt = new Date(Date.now() + expiresMinutes * 60000).toISOString()
        const { data: created, error: createError } = await admin.from("exam_access_codes").insert({ exam_id: examId, student_id: studentId, course: student.course, student_name: student.student_name, code_hash: hashCode(code), code_hint: code.slice(-4), expires_at: expiresAt, created_by: user.id }).select("id, expires_at").single()
        if (createError) throw createError
        await admin.from("exam_access_code_audit").insert({ exam_id: examId, student_id: studentId, access_code_id: created.id, event_type: "generated", created_by: user.id })
        return res({ success: true, code, expiresAt: created.expires_at, student: { id: student.id, studentName: student.student_name, course: student.course, rutMasked: maskRut(student.rut) } })
      }
      if (action === "list_codes") {
        const examId = String(body.examId || "")
        const { data, error } = await admin.from("exam_access_codes").select("id, student_name, course, code_hint, status, expires_at, used_at, created_at").eq("exam_id", examId).order("created_at", { ascending: false }).limit(50)
        if (error) throw error
        return res({ success: true, codes: data || [] })
      }
    }

    if (action === "start_with_code" || action === "proxy_attempt_with_code") {
      const examId = String(body.examId || body.innerBody?.examId || "")
      const accessCode = codeClean(body.accessCode)
      if (!examId || !accessCode) return res({ success: false, error: "Falta código de acceso" }, 400)
      const loaded = await accessRow(examId, accessCode)
      if ("error" in loaded) return res({ success: false, error: loaded.error }, loaded.status)
      const { row, student } = loaded
      const inner = body.innerBody || {}
      if (action === "proxy_attempt_with_code" && row.used_client_attempt_id && inner.clientAttemptId && String(inner.clientAttemptId) !== String(row.used_client_attempt_id)) return res({ success: false, error: "Este código pertenece a otro intento iniciado" }, 403)
      const proxyBody = { ...inner, action: action === "start_with_code" ? "start_or_resume_attempt" : inner.action, examId, studentName: student.student_name, studentCourse: student.course, studentRut: student.rut_clean }
      const proxy = await proxyExam(req, proxyBody)
      const data = await proxy.json().catch(() => ({}))
      if (!proxy.ok || !data?.success) return res(data, proxy.status || 400)
      if (action === "start_with_code") {
        const attemptId = String(data?.attempt?.clientAttemptId || "")
        await admin.from("exam_access_codes").update({ status: "used", used_at: row.used_at || new Date().toISOString(), used_client_attempt_id: attemptId }).eq("id", row.id)
        await admin.from("exam_access_code_audit").insert({ exam_id: examId, student_id: student.id, access_code_id: row.id, event_type: row.used_at ? "resumed_with_code" : "used" })
      }
      if (inner.action === "submit") await admin.from("exam_access_code_audit").insert({ exam_id: examId, student_id: student.id, access_code_id: row.id, event_type: "submitted_with_code" })
      return res({ ...data, accessMode: "code", student: { studentName: student.student_name, course: student.course } }, proxy.status || 200)
    }

    return res({ success: false, error: "Acción no soportada" }, 400)
  } catch (error: any) {
    console.error("[exam-access]", error)
    return res({ success: false, error: error?.message || "Error interno" }, 500)
  }
}
