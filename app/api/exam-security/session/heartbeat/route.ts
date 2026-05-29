// app/api/exam-security/session/heartbeat/route.ts

import { NextRequest } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

import { getResolvedSecurityPolicy } from "@/lib/exam-security/policy"
import {
  getSecuritySessionById,
  updateSecurityHeartbeat,
} from "@/lib/exam-security/session"
import type {
  SecurityApiResponse,
  SecurityHeartbeatInput,
  SecuritySessionRecord,
} from "@/lib/exam-security/types"

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

async function saveHeartbeatAudit(params: {
  sessionId: string
  payload?: Record<string, unknown>
}) {
  const admin = getAdmin()

  const { error } = await admin.from("exam_security_heartbeats").insert({
    session_id: params.sessionId,
    payload: params.payload ?? {},
  })

  if (error) {
    console.error(
      "[exam-security/session/heartbeat:saveHeartbeatAudit]",
      error.message
    )
  }
}

async function getRecentAdminMessages(sessionId: string) {
  const admin = getAdmin()

  const { data, error } = await admin
    .from("exam_security_actions")
    .select("id, action_type, reason, payload, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(12)

  if (error) {
    console.error(
      "[exam-security/session/heartbeat:getRecentAdminMessages]",
      error.message
    )
    return []
  }

  return (data ?? [])
    .filter((row) => {
      const payload = row.payload as Record<string, unknown> | null
      return payload?.message_channel === "exam_admin_message"
    })
    .map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>
      const kind = String(payload.message_kind || "message")
      const action = String(payload.action || "message")

      return {
        id: String(row.id),
        action,
        kind: kind === "notification" ? "notification" : "message",
        title: String(payload.title || (kind === "notification" ? "Notificación del docente" : "Mensaje del docente")),
        message: String(payload.message || row.reason || ""),
        created_at: row.created_at,
      }
    })
    .filter((item) => item.message.trim().length > 0)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SecurityHeartbeatInput

    const sessionId = String(body.sessionId || "").trim()
    const examId = String(body.examId || "").trim()
    const submissionId = body.submissionId
      ? String(body.submissionId).trim()
      : null
    const payload =
      body.payload && typeof body.payload === "object" ? body.payload : {}

    if (!sessionId || !examId) {
      return Response.json(
        {
          success: false,
          error: "Faltan sessionId o examId.",
        } satisfies SecurityApiResponse,
        { status: 400 }
      )
    }

    const session = await getSecuritySessionById(sessionId)

    if (!session) {
      return Response.json(
        {
          success: false,
          error: "La sesión de seguridad no existe.",
        } satisfies SecurityApiResponse,
        { status: 404 }
      )
    }

    if (session.exam_id !== examId) {
      return Response.json(
        {
          success: false,
          error: "El examId no coincide con la sesión.",
        } satisfies SecurityApiResponse,
        { status: 400 }
      )
    }

    if (
      session.submission_id &&
      submissionId &&
      session.submission_id !== submissionId
    ) {
      return Response.json(
        {
          success: false,
          error: "El submissionId no coincide con la sesión.",
        } satisfies SecurityApiResponse,
        { status: 400 }
      )
    }

    const policy = await getResolvedSecurityPolicy(examId)

    if (!policy.enabled) {
      return Response.json(
        {
          success: false,
          error: "La seguridad está deshabilitada para este examen.",
        } satisfies SecurityApiResponse,
        { status: 403 }
      )
    }

    if (session.status === "finished" || session.status === "terminated") {
      return Response.json(
        {
          success: false,
          error: "La sesión ya fue cerrada.",
        } satisfies SecurityApiResponse,
        { status: 409 }
      )
    }

    const updatedSession = await updateSecurityHeartbeat({
      sessionId,
      examId,
      submissionId,
      payload,
    })

    if (!updatedSession) {
      return Response.json(
        {
          success: false,
          error: "No se pudo actualizar el heartbeat.",
        } satisfies SecurityApiResponse,
        { status: 500 }
      )
    }

    await saveHeartbeatAudit({
      sessionId,
      payload,
    })

    const adminMessages = await getRecentAdminMessages(sessionId)

    return Response.json(
      {
        success: true,
        data: {
          session: updatedSession,
          heartbeatAt: updatedSession.last_heartbeat_at,
          adminMessages,
        },
      } satisfies SecurityApiResponse<{
        session: SecuritySessionRecord
        heartbeatAt: string | null
        adminMessages: Array<{
          id: string
          action: string
          kind: "notification" | "message"
          title: string
          message: string
          created_at: string
        }>
      }>,
      { status: 200 }
    )
  } catch (error) {
    console.error("[exam-security/session/heartbeat:POST]", error)

    return Response.json(
      {
        success: false,
        error: "No se pudo procesar el heartbeat.",
      } satisfies SecurityApiResponse,
      { status: 500 }
    )
  }
}
