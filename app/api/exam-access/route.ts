import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const admin = createClient(supabaseUrl, serviceKey || anonKey, {
  auth: { persistSession: false },
})

function respond(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

function requireServiceRole() {
  if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor")
}

function normalizeCode(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
}

function normalizeRutClean(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^0-9K]/g, "").slice(0, 9)
}

function hashCode(value: unknown) {
  return createHash("sha256")
    .update("eduai-exam-access:")
    .update(process.env.EXAM_ACCESS_CODE_SECRET || serviceKey || anonKey || "fallback")
    .update(":")
    .update(normalizeCode(value))
    .digest("hex")
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(8)
  let code = ""
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length]
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

function maskRut(value: unknown) {
  const clean = normalizeRutClean(value)
  if (clean.length < 4) return "••••"
  return `••.•••.${clean.slice(-4, -1)}-${clean.slice(-1)}`
}

function isStillValid(expiresAt: unknown) {
  return new Date(String(expiresAt || "")).getTime() > Date.now()
}

function secondsLeft(expiresAt: unknown) {
  const ms = new Date(String(expiresAt || "")).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / 1000))
}

async function getUser(req: NextRequest) {
  const header = req.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token) return null

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

async function proxyToExamRoute(req: NextRequest, payload: any) {
  const target = new URL("/api/agents/examen-docente", req.url)
  return fetch(target.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

async function expireElapsedCodes(examId?: string, studentId?: string) {
  const now = new Date().toISOString()
  let query = admin
    .from("exam_access_codes")
    .update({ status: "expired", code_value: null })
    .in("status", ["active", "used"])
    .lt("expires_at", now)

  if (examId) query = query.eq("exam_id", examId)
  if (studentId) query = query.eq("student_id", studentId)

  const { error } = await query
  if (error) throw error
}

function codeForTeacher(row: any) {
  const valid = isStillValid(row?.expires_at)
  const status = valid ? row.status : "expired"
  const canReveal = valid && ["active", "used"].includes(String(row.status)) && Boolean(row.code_value)
  const { code_value, ...safeRow } = row

  return {
    ...safeRow,
    status,
    code: canReveal ? code_value : null,
    remainingSeconds: valid ? secondsLeft(row.expires_at) : 0,
    expired: !valid,
  }
}

async function getAccessRow(examId: string, accessCode: string) {
  const { data: row, error } = await admin
    .from("exam_access_codes")
    .select("id, exam_id, student_id, course, student_name, status, expires_at, used_at, used_client_attempt_id, code_value")
    .eq("exam_id", examId)
    .eq("code_hash", hashCode(accessCode))
    .maybeSingle()

  if (error) throw error
  if (!row) return { error: "Código inválido o no corresponde a este examen", status: 404 as const }

  if (row.status === "revoked" || row.status === "expired") {
    return { error: "Este código ya no está activo", status: 403 as const }
  }

  if (!isStillValid(row.expires_at)) {
    await admin.from("exam_access_codes").update({ status: "expired", code_value: null }).eq("id", row.id)
    return { error: "Este código venció. Solicita uno nuevo al docente", status: 403 as const }
  }

  const { data: participant, error: participantError } = await admin
    .from("student_roster")
    .select("id, student_name, course, rut, rut_clean, active")
    .eq("id", row.student_id)
    .maybeSingle()

  if (participantError) throw participantError
  if (!participant || participant.active !== true) {
    return { error: "El estudiante asociado no está activo en el listado", status: 403 as const }
  }

  return { row, participant }
}

export async function POST(req: NextRequest) {
  try {
    requireServiceRole()
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "")

    if (["list_exams", "list_roster", "generate_code", "list_codes", "revoke_code"].includes(action)) {
      const user = await getUser(req)
      if (!user) return respond({ success: false, error: "Sesión docente requerida" }, 401)

      if (action === "list_exams") {
        const { data, error } = await admin
          .from("teacher_exams")
          .select("id, title, topic, code, status, created_at")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100)
        if (error) throw error
        return respond({ success: true, exams: data || [] })
      }

      if (action === "list_roster") {
        const course = String(body.course || "1° Medio A").trim()
        const { data, error } = await admin
          .from("student_roster")
          .select("id, student_name, course, rut")
          .eq("school_year", String(body.schoolYear || "2026"))
          .eq("course", course)
          .eq("active", true)
          .order("student_name")
          .limit(100)
        if (error) throw error
        return respond({
          success: true,
          students: (data || []).map((item: any) => ({
            id: item.id,
            studentName: item.student_name,
            course: item.course,
            rutMasked: maskRut(item.rut),
          })),
        })
      }

      if (action === "generate_code") {
        const examId = String(body.examId || "")
        const studentId = String(body.studentId || "")
        const expiresMinutes = Math.min(180, Math.max(10, Number(body.expiresMinutes || 45)))
        if (!examId || !studentId) return respond({ success: false, error: "Falta examen o estudiante" }, 400)

        await expireElapsedCodes(examId, studentId)

        const { data: exam, error: examError } = await admin
          .from("teacher_exams")
          .select("id, teacher_id, title, status")
          .eq("id", examId)
          .maybeSingle()
        if (examError) throw examError
        if (!exam || exam.teacher_id !== user.id) return respond({ success: false, error: "No autorizado" }, 403)

        const { data: participant, error: participantError } = await admin
          .from("student_roster")
          .select("id, student_name, course, rut, active")
          .eq("id", studentId)
          .maybeSingle()
        if (participantError) throw participantError
        if (!participant || participant.active !== true) return respond({ success: false, error: "Estudiante no disponible" }, 404)

        const { data: reusable, error: reusableError } = await admin
          .from("exam_access_codes")
          .select("id, code_value, code_hint, status, expires_at, used_at, created_at")
          .eq("exam_id", examId)
          .eq("student_id", studentId)
          .in("status", ["active", "used"])
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (reusableError) throw reusableError

        if (reusable?.code_value) {
          await admin.from("exam_access_code_audit").insert({
            exam_id: examId,
            student_id: studentId,
            access_code_id: reusable.id,
            event_type: "viewed_existing",
            event_detail: { status: reusable.status, remainingSeconds: secondsLeft(reusable.expires_at) },
            created_by: user.id,
          })

          return respond({
            success: true,
            reused: true,
            code: reusable.code_value,
            expiresAt: reusable.expires_at,
            remainingSeconds: secondsLeft(reusable.expires_at),
            status: reusable.status,
            student: {
              id: participant.id,
              studentName: participant.student_name,
              course: participant.course,
              rutMasked: maskRut(participant.rut),
            },
          })
        }

        await admin
          .from("exam_access_codes")
          .update({ status: "revoked", code_value: null })
          .eq("exam_id", examId)
          .eq("student_id", studentId)
          .eq("status", "active")

        let code = makeCode()
        let codeHash = hashCode(code)
        for (let i = 0; i < 5; i++) {
          const { data: existing } = await admin
            .from("exam_access_codes")
            .select("id")
            .eq("code_hash", codeHash)
            .maybeSingle()
          if (!existing) break
          code = makeCode()
          codeHash = hashCode(code)
        }

        const expiresAt = new Date(Date.now() + expiresMinutes * 60_000).toISOString()
        const { data: created, error: createError } = await admin
          .from("exam_access_codes")
          .insert({
            exam_id: examId,
            student_id: studentId,
            course: participant.course,
            student_name: participant.student_name,
            code_hash: codeHash,
            code_value: code,
            code_hint: code.slice(-4),
            expires_at: expiresAt,
            created_by: user.id,
          })
          .select("id, expires_at")
          .single()
        if (createError) throw createError

        await admin.from("exam_access_code_audit").insert({
          exam_id: examId,
          student_id: studentId,
          access_code_id: created.id,
          event_type: "generated",
          event_detail: { minutes: expiresMinutes },
          created_by: user.id,
        })

        return respond({
          success: true,
          reused: false,
          code,
          expiresAt: created.expires_at,
          remainingSeconds: secondsLeft(created.expires_at),
          status: "active",
          student: {
            id: participant.id,
            studentName: participant.student_name,
            course: participant.course,
            rutMasked: maskRut(participant.rut),
          },
        })
      }

      if (action === "list_codes") {
        const examId = String(body.examId || "")
        const { data: exam, error: examError } = await admin
          .from("teacher_exams")
          .select("id, teacher_id")
          .eq("id", examId)
          .maybeSingle()
        if (examError) throw examError
        if (!exam || exam.teacher_id !== user.id) return respond({ success: false, error: "No autorizado" }, 403)

        await expireElapsedCodes(examId)

        const { data, error } = await admin
          .from("exam_access_codes")
          .select("id, student_name, course, code_hint, code_value, status, expires_at, used_at, created_at")
          .eq("exam_id", examId)
          .order("created_at", { ascending: false })
          .limit(50)
        if (error) throw error
        return respond({ success: true, codes: (data || []).map(codeForTeacher) })
      }

      if (action === "revoke_code") {
        const codeId = String(body.codeId || "")
        if (!codeId) return respond({ success: false, error: "Falta código" }, 400)
        await admin.from("exam_access_codes").update({ status: "revoked", code_value: null }).eq("id", codeId)
        return respond({ success: true })
      }
    }

    if (action === "start_with_code") {
      const examId = String(body.examId || body.innerBody?.examId || "")
      const accessCode = normalizeCode(body.accessCode)
      if (!examId || !accessCode) return respond({ success: false, error: "Falta código de acceso" }, 400)

      const loaded = await getAccessRow(examId, accessCode)
      if ("error" in loaded) return respond({ success: false, error: loaded.error }, loaded.status)
      const { row, participant } = loaded

      const proxyBody = {
        ...(body.innerBody || {}),
        action: "start_or_resume_attempt",
        examId,
        studentName: participant.student_name,
        studentCourse: participant.course,
        studentRut: participant.rut_clean,
      }

      const proxy = await proxyToExamRoute(req, proxyBody)
      const data = await proxy.json().catch(() => ({}))
      if (!proxy.ok || !data?.success) return respond(data, proxy.status || 400)

      const attemptId = String(data?.attempt?.clientAttemptId || "")
      await admin
        .from("exam_access_codes")
        .update({ status: "used", used_at: row.used_at || new Date().toISOString(), used_client_attempt_id: attemptId })
        .eq("id", row.id)

      await admin.from("exam_access_code_audit").insert({
        exam_id: examId,
        student_id: participant.id,
        access_code_id: row.id,
        event_type: row.used_at ? "resumed_with_code" : "used",
      })

      return respond({
        ...data,
        accessMode: "code",
        student: { studentName: participant.student_name, course: participant.course },
      })
    }

    if (action === "proxy_attempt_with_code") {
      const examId = String(body.examId || body.innerBody?.examId || "")
      const accessCode = normalizeCode(body.accessCode)
      if (!examId || !accessCode) return respond({ success: false, error: "Falta código de acceso" }, 400)

      const loaded = await getAccessRow(examId, accessCode)
      if ("error" in loaded) return respond({ success: false, error: loaded.error }, loaded.status)
      const { row, participant } = loaded
      const inner = body.innerBody || {}

      if (row.used_client_attempt_id && inner.clientAttemptId && String(inner.clientAttemptId) !== String(row.used_client_attempt_id)) {
        return respond({ success: false, error: "Este código pertenece a otro intento iniciado" }, 403)
      }

      const proxyBody = {
        ...inner,
        studentName: participant.student_name,
        studentCourse: participant.course,
        studentRut: participant.rut_clean,
      }

      const proxy = await proxyToExamRoute(req, proxyBody)
      const data = await proxy.json().catch(() => ({}))

      if (data?.success && inner.action === "submit") {
        await admin.from("exam_access_code_audit").insert({
          exam_id: examId,
          student_id: participant.id,
          access_code_id: row.id,
          event_type: "submitted_with_code",
        })
      }

      return respond(data, proxy.status || 200)
    }

    return respond({ success: false, error: "Acción no soportada" }, 400)
  } catch (error: any) {
    console.error("[exam-access]", error)
    return respond({ success: false, error: error?.message || "Error interno" }, 500)
  }
}
