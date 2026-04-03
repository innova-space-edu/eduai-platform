// app/api/exam-security/admin/session/[id]/route.ts

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

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada")
  }

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  }

  return createAdminClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = getAdmin()
    const { id } = await ctx.params
    const sessionId = String(id || "").trim()

    if (!sessionId) {
      return Response.json(
        {
          success: false,
          error: "Falta el id de la sesión.",
        },
        { status: 400 }
      )
    }

    const [
      { data: session, error: sessionError },
      { data: events, error: eventsError },
      { data: actions, error: actionsError },
      { data: notes, error: notesError },
    ] = await Promise.all([
      admin
        .from("exam_security_sessions")
        .select(
          `
            id,
            exam_id,
            submission_id,
            teacher_id,
            student_name,
            student_course,
            student_rut,
            status,
            risk_score,
            risk_level,
            warning_count,
            freeze_count,
            block_count,
            last_event_at,
            last_heartbeat_at,
            started_at,
            ended_at,
            client_metadata,
            created_at,
            updated_at
          `
        )
        .eq("id", sessionId)
        .maybeSingle<SessionRow>(),

      admin
        .from("exam_security_events")
        .select(
          `
            id,
            session_id,
            exam_id,
            submission_id,
            event_type,
            event_group,
            severity,
            score_delta,
            question_index,
            client_time_left,
            visibility_state,
            fullscreen,
            window_width,
            window_height,
            user_agent,
            incident_number,
            payload,
            created_at
          `
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .returns<EventRow[]>(),

      admin
        .from("exam_security_actions")
        .select(
          `
            id,
            session_id,
            exam_id,
            submission_id,
            action_type,
            reason,
            duration_seconds,
            applied_by,
            payload,
            created_at
          `
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .returns<ActionRow[]>(),

      admin
        .from("exam_security_admin_notes")
        .select(
          `
            id,
            session_id,
            submission_id,
            author_id,
            note,
            created_at
          `
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .returns<NoteRow[]>(),
    ])

    if (sessionError) {
      console.error("[exam-security/admin/session:getSession]", sessionError.message)
      return Response.json(
        {
          success: false,
          error: "No se pudo obtener la sesión.",
        },
        { status: 500 }
      )
    }

    if (!session) {
      return Response.json(
        {
          success: false,
          error: "La sesión no existe.",
        },
        { status: 404 }
      )
    }

    if (eventsError) {
      console.error("[exam-security/admin/session:getEvents]", eventsError.message)
      return Response.json(
        {
          success: false,
          error: "No se pudieron obtener los eventos.",
        },
        { status: 500 }
      )
    }

    if (actionsError) {
      console.error("[exam-security/admin/session:getActions]", actionsError.message)
      return Response.json(
        {
          success: false,
          error: "No se pudieron obtener las acciones.",
        },
        { status: 500 }
      )
    }

    if (notesError) {
      console.error("[exam-security/admin/session:getNotes]", notesError.message)
      return Response.json(
        {
          success: false,
          error: "No se pudieron obtener las notas administrativas.",
        },
        { status: 500 }
      )
    }

    return Response.json(
      {
        success: true,
        data: {
          session,
          events: events ?? [],
          actions: actions ?? [],
          notes: notes ?? [],
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[exam-security/admin/session/[id]:GET]", error)

    return Response.json(
      {
        success: false,
        error: "No se pudo cargar el detalle de la sesión.",
      },
      { status: 500 }
    )
  }
}
