// app/api/exam-security/admin/session/[id]/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// GET  → Detalle completo de sesión (sin cambios)
// POST → Acciones de administrador: freeze, block, terminate, clear_state, add_note
// ──────────────────────────────────────────────────────────────────────────────

import { createClient as createAdminClient } from "@supabase/supabase-js"

type SessionRow = {
  id: string
  exam_id: string
  submission_id: string | null
  teacher_id: string | null
  student_name: string | null
  student_course: string | null
  student_rut: string | null
  status: string
  risk_score: number | null
  risk_level: string | null
  warning_count: number | null
  freeze_count: number | null
  block_count: number | null
  last_event_at: string | null
  last_heartbeat_at: string | null
  started_at: string
  ended_at: string | null
  client_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  event_type: string
  event_group: string | null
  severity: string
  score_delta: number | null
  question_index: number | null
  client_time_left: number | null
  visibility_state: string | null
  fullscreen: boolean | null
  window_width: number | null
  window_height: number | null
  user_agent: string | null
  incident_number: number | null
  payload: Record<string, unknown> | null
  created_at: string
}

type ActionRow = {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  action_type: string
  reason: string | null
  duration_seconds: number | null
  applied_by: string
  payload: Record<string, unknown> | null
  created_at: string
}

type NoteRow = {
  id: string
  session_id: string
  submission_id: string | null
  author_id: string
  note: string
  created_at: string
}

// Tipos de acciones que el admin puede ejecutar
type AdminAction =
  | "freeze"
  | "block"
  | "terminate"
  | "clear_state"
  | "add_note"
  | "warn"
  | "flag_review"
  | "reopen"

// Mapeo de acción admin → status de sesión
const ACTION_TO_STATUS: Partial<Record<AdminAction, string>> = {
  freeze:      "frozen",
  block:       "blocked",
  terminate:   "terminated",
  warn:        "warned",
  flag_review: "flagged",
  reopen:      "active",
}

// Mapeo de acción admin → action_type en la tabla exam_security_actions
const ACTION_TO_TYPE: Record<AdminAction, string> = {
  freeze:      "freeze",
  block:       "block",
  terminate:   "terminate_attempt",
  clear_state: "clear_state",
  add_note:    "teacher_override",
  warn:        "warn",
  flag_review: "flag_review",
  reopen:      "teacher_override",
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada")
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")

  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = getAdmin()
    const { id } = await ctx.params
    const sessionId = String(id || "").trim()

    if (!sessionId) {
      return Response.json({ success: false, error: "Falta el id de la sesión." }, { status: 400 })
    }

    const [
      { data: session, error: sessionError },
      { data: events,  error: eventsError  },
      { data: actions, error: actionsError },
      { data: notes,   error: notesError   },
    ] = await Promise.all([
      admin
        .from("exam_security_sessions")
        .select(
          `id, exam_id, submission_id, teacher_id, student_name, student_course,
           student_rut, status, risk_score, risk_level, warning_count, freeze_count,
           block_count, last_event_at, last_heartbeat_at, started_at, ended_at,
           client_metadata, created_at, updated_at`
        )
        .eq("id", sessionId)
        .maybeSingle<SessionRow>(),

      admin
        .from("exam_security_events")
        .select(
          `id, session_id, exam_id, submission_id, event_type, event_group, severity,
           score_delta, question_index, client_time_left, visibility_state, fullscreen,
           window_width, window_height, user_agent, incident_number, payload, created_at`
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .returns<EventRow[]>(),

      admin
        .from("exam_security_actions")
        .select(
          `id, session_id, exam_id, submission_id, action_type, reason,
           duration_seconds, applied_by, payload, created_at`
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .returns<ActionRow[]>(),

      admin
        .from("exam_security_admin_notes")
        .select(`id, session_id, submission_id, author_id, note, created_at`)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .returns<NoteRow[]>(),
    ])

    if (sessionError) {
      console.error("[exam-security/admin/session:GET:session]", sessionError.message)
      return Response.json({ success: false, error: "No se pudo obtener la sesión." }, { status: 500 })
    }

    if (!session) {
      return Response.json({ success: false, error: "La sesión no existe." }, { status: 404 })
    }

    if (eventsError)  console.error("[exam-security/admin/session:GET:events]",  eventsError.message)
    if (actionsError) console.error("[exam-security/admin/session:GET:actions]", actionsError.message)
    if (notesError)   console.error("[exam-security/admin/session:GET:notes]",   notesError.message)

    return Response.json(
      {
        success: true,
        data: {
          session,
          events:  events  ?? [],
          actions: actions ?? [],
          notes:   notes   ?? [],
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[exam-security/admin/session/[id]:GET]", error)
    return Response.json({ success: false, error: "No se pudo cargar el detalle de la sesión." }, { status: 500 })
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────
// Body esperado:
// {
//   "action":   "freeze" | "block" | "terminate" | "clear_state" | "add_note" | "warn" | "flag_review" | "reopen",
//   "reason":   "Motivo (opcional para la mayoría, requerido para terminate)",
//   "note":     "Texto de la nota (solo para add_note)",
//   "adminId":  "email o id del administrador que ejecuta la acción"
// }

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = getAdmin()
    const { id } = await ctx.params
    const sessionId = String(id || "").trim()

    if (!sessionId) {
      return Response.json({ success: false, error: "Falta el id de la sesión." }, { status: 400 })
    }

    let body: {
      action?: string
      reason?: string
      note?: string
      adminId?: string
    }

    try {
      body = await req.json()
    } catch {
      return Response.json({ success: false, error: "Cuerpo de la solicitud inválido." }, { status: 400 })
    }

    const action  = (body.action  ?? "").trim() as AdminAction
    const reason  = (body.reason  ?? "").trim() || null
    const noteText= (body.note    ?? "").trim()
    const adminId = (body.adminId ?? "admin").trim()

    const validActions: AdminAction[] = [
      "freeze", "block", "terminate", "clear_state",
      "add_note", "warn", "flag_review", "reopen",
    ]

    if (!validActions.includes(action)) {
      return Response.json(
        { success: false, error: `Acción inválida: "${action}". Válidas: ${validActions.join(", ")}.` },
        { status: 400 }
      )
    }

    if (action === "add_note" && !noteText) {
      return Response.json({ success: false, error: "El texto de la nota no puede estar vacío." }, { status: 400 })
    }

    // 1. Obtener sesión actual
    const { data: session, error: sessionError } = await admin
      .from("exam_security_sessions")
      .select("id, exam_id, submission_id, status")
      .eq("id", sessionId)
      .maybeSingle()

    if (sessionError) {
      console.error("[exam-security/admin/session:POST:getSession]", sessionError.message)
      return Response.json({ success: false, error: "No se pudo obtener la sesión." }, { status: 500 })
    }

    if (!session) {
      return Response.json({ success: false, error: "La sesión no existe." }, { status: 404 })
    }

    const now = new Date().toISOString()

    // 2. Ejecutar acción
    if (action === "add_note") {
      // Solo insertar nota
      const { error: noteError } = await admin
        .from("exam_security_admin_notes")
        .insert({
          session_id:    sessionId,
          submission_id: session.submission_id,
          author_id:     adminId,
          note:          noteText,
          created_at:    now,
        })

      if (noteError) {
        console.error("[exam-security/admin/session:POST:addNote]", noteError.message)
        return Response.json({ success: false, error: "No se pudo guardar la nota." }, { status: 500 })
      }

      return Response.json({ success: true, message: "Nota agregada correctamente." }, { status: 200 })
    }

    if (action === "clear_state") {
      // Resetear contadores y volver a active
      const { error: updateError } = await admin
        .from("exam_security_sessions")
        .update({
          status:        "active",
          risk_score:    0,
          risk_level:    "clean",
          warning_count: 0,
          freeze_count:  0,
          block_count:   0,
          updated_at:    now,
        })
        .eq("id", sessionId)

      if (updateError) {
        console.error("[exam-security/admin/session:POST:clearState]", updateError.message)
        return Response.json({ success: false, error: "No se pudo limpiar el estado." }, { status: 500 })
      }

      // Registrar la acción
      await admin.from("exam_security_actions").insert({
        session_id:    sessionId,
        exam_id:       session.exam_id,
        submission_id: session.submission_id,
        action_type:   "clear_state",
        reason:        reason ?? "Limpieza de estado por administrador",
        applied_by:    adminId,
        payload:       { admin_action: true, previous_status: session.status },
        created_at:    now,
      })

      return Response.json({ success: true, message: "Estado limpiado. Sesión volvió a 'active'." }, { status: 200 })
    }

    // Para el resto de acciones (freeze, block, terminate, warn, flag_review, reopen)
    const newStatus = ACTION_TO_STATUS[action]
    if (!newStatus) {
      return Response.json({ success: false, error: `La acción "${action}" no tiene estado asociado.` }, { status: 500 })
    }

    const sessionUpdate: Record<string, unknown> = {
      status:     newStatus,
      updated_at: now,
    }

    // Para terminate, también registrar ended_at
    if (action === "terminate") {
      sessionUpdate.ended_at = now
    }

    const { error: updateError } = await admin
      .from("exam_security_sessions")
      .update(sessionUpdate)
      .eq("id", sessionId)

    if (updateError) {
      console.error(`[exam-security/admin/session:POST:${action}]`, updateError.message)
      return Response.json({ success: false, error: `No se pudo ejecutar la acción "${action}".` }, { status: 500 })
    }

    // Registrar la acción en exam_security_actions
    const { error: actionError } = await admin.from("exam_security_actions").insert({
      session_id:    sessionId,
      exam_id:       session.exam_id,
      submission_id: session.submission_id,
      action_type:   ACTION_TO_TYPE[action],
      reason:        reason ?? `Acción manual: ${action} por administrador`,
      applied_by:    adminId,
      payload: {
        admin_action:    true,
        previous_status: session.status,
        new_status:      newStatus,
      },
      created_at: now,
    })

    if (actionError) {
      // No es fatal — la sesión ya fue actualizada, solo loguear
      console.warn("[exam-security/admin/session:POST:insertAction]", actionError.message)
    }

    return Response.json(
      {
        success: true,
        message: `Sesión ${newStatus}. Acción "${action}" registrada.`,
        data: { sessionId, newStatus, action },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[exam-security/admin/session/[id]:POST]", error)
    return Response.json({ success: false, error: "No se pudo ejecutar la acción." }, { status: 500 })
  }
}
