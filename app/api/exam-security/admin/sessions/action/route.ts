// app/api/exam-security/admin/sessions/action/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// Acciones masivas/individuales para estudiantes conectados al examen.
// Permite desbloquear, enviar notificaciones y enviar mensajes desde Admin.
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

type AdminBulkAction = "unlock" | "notify" | "message"

type SessionRow = {
  id: string
  exam_id: string
  submission_id: string | null
  student_name: string | null
  student_course: string | null
  student_rut: string | null
  status: string
}

type Body = {
  action?: string
  sessionIds?: string[]
  target?: "selected" | "all"
  examId?: string
  hours?: number
  message?: string
  title?: string
  reason?: string
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada")
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")

  return createAdminClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, error: "No autenticado" }

  const { data: isAdmin } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  if (!isAdmin) return { user: null, error: "Acceso denegado" }

  return { user, error: null }
}

function hoursAgoToIso(hours: number) {
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 24
  return new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString()
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  )
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function getTargetSessions(params: {
  admin: ReturnType<typeof getAdmin>
  sessionIds: string[]
  target: "selected" | "all"
  examId?: string
  hours: number
}) {
  const { admin, sessionIds, target, examId, hours } = params

  let query = admin
    .from("exam_security_sessions")
    .select("id, exam_id, submission_id, student_name, student_course, student_rut, status")
    .gte("created_at", hoursAgoToIso(hours))
    .order("created_at", { ascending: false })

  if (target === "selected") {
    if (sessionIds.length === 0) return [] as SessionRow[]
    query = query.in("id", sessionIds)
  } else {
    query = query.in("status", [
      "active",
      "warned",
      "frozen",
      "blocked",
      "flagged",
      "offline_grace",
    ])
  }

  if (examId) {
    query = query.eq("exam_id", examId)
  }

  const { data, error } = await query.returns<SessionRow[]>()

  if (error) {
    console.error("[exam-security/admin/sessions/action:getTargetSessions]", error.message)
    throw new Error("No se pudieron cargar las sesiones objetivo.")
  }

  return data ?? []
}

async function insertActionRows(params: {
  admin: ReturnType<typeof getAdmin>
  sessions: SessionRow[]
  appliedBy: string
  action: AdminBulkAction
  title: string
  message: string
  reason: string
}) {
  const { admin, sessions, appliedBy, action, title, message, reason } = params
  const now = new Date().toISOString()
  const rows = sessions.map((session) => ({
    session_id: session.id,
    exam_id: session.exam_id,
    submission_id: session.submission_id,
    action_type: "teacher_override",
    reason,
    applied_by: appliedBy,
    payload: {
      admin_action: true,
      action,
      title,
      message,
      message_channel: "exam_admin_message",
      message_kind: action === "notify" ? "notification" : "message",
      target_session_id: session.id,
      sent_at: now,
    },
    created_at: now,
  }))

  for (const part of chunk(rows, 100)) {
    const { error } = await admin.from("exam_security_actions").insert(part)
    if (error) {
      console.error("[exam-security/admin/sessions/action:insertActionRows]", error.message)
      throw new Error("No se pudieron registrar las acciones de comunicación.")
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAdmin()
    if (!user) {
      return Response.json(
        { success: false, error },
        { status: error === "No autenticado" ? 401 : 403 }
      )
    }

    let body: Body
    try {
      body = (await req.json()) as Body
    } catch {
      return Response.json(
        { success: false, error: "Cuerpo de solicitud inválido." },
        { status: 400 }
      )
    }

    const action = String(body.action || "").trim() as AdminBulkAction
    const validActions: AdminBulkAction[] = ["unlock", "notify", "message"]

    if (!validActions.includes(action)) {
      return Response.json(
        { success: false, error: `Acción inválida. Usa: ${validActions.join(", ")}.` },
        { status: 400 }
      )
    }

    const target = body.target === "all" ? "all" : "selected"
    const sessionIds = normalizeIdList(body.sessionIds)
    const examId = String(body.examId || "").trim() || undefined
    const hours = Number(body.hours || 24)
    const title = String(body.title || (action === "notify" ? "Notificación del docente" : "Mensaje del docente")).trim()
    const message = String(body.message || "").trim()
    const reason = String(body.reason || "").trim() ||
      (action === "unlock"
        ? "Desbloqueo manual desde control de estudiantes"
        : action === "notify"
          ? "Notificación enviada desde control de estudiantes"
          : "Mensaje enviado desde control de estudiantes")

    if (target === "selected" && sessionIds.length === 0) {
      return Response.json(
        { success: false, error: "Selecciona al menos una sesión." },
        { status: 400 }
      )
    }

    if ((action === "notify" || action === "message") && !message) {
      return Response.json(
        { success: false, error: "Escribe el texto que deseas enviar." },
        { status: 400 }
      )
    }

    const admin = getAdmin()
    const sessions = await getTargetSessions({
      admin,
      sessionIds,
      target,
      examId,
      hours,
    })

    if (sessions.length === 0) {
      return Response.json(
        { success: false, error: "No se encontraron sesiones para ejecutar la acción." },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    const appliedBy = user.email || user.id || "admin"

    if (action === "unlock") {
      const ids = sessions.map((session) => session.id)

      for (const part of chunk(ids, 100)) {
        const { error: updateError } = await admin
          .from("exam_security_sessions")
          .update({
            status: "active",
            risk_score: 0,
            risk_level: "clean",
            warning_count: 0,
            freeze_count: 0,
            block_count: 0,
            ended_at: null,
            updated_at: now,
          })
          .in("id", part)

        if (updateError) {
          console.error("[exam-security/admin/sessions/action:unlock]", updateError.message)
          return Response.json(
            { success: false, error: "No se pudieron desbloquear las sesiones seleccionadas." },
            { status: 500 }
          )
        }
      }

      await insertActionRows({
        admin,
        sessions,
        appliedBy,
        action,
        title: "Sesión desbloqueada",
        message: "Tu sesión fue desbloqueada por el administrador. Puedes continuar el examen.",
        reason,
      })

      return Response.json({
        success: true,
        message: `${sessions.length} usuario(s) desbloqueado(s).`,
        data: { count: sessions.length, action },
      })
    }

    await insertActionRows({
      admin,
      sessions,
      appliedBy,
      action,
      title,
      message,
      reason,
    })

    return Response.json({
      success: true,
      message:
        action === "notify"
          ? `Notificación enviada a ${sessions.length} usuario(s).`
          : `Mensaje enviado a ${sessions.length} usuario(s).`,
      data: { count: sessions.length, action },
    })
  } catch (error) {
    console.error("[exam-security/admin/sessions/action:POST]", error)
    return Response.json(
      { success: false, error: "No se pudo ejecutar la acción solicitada." },
      { status: 500 }
    )
  }
}
