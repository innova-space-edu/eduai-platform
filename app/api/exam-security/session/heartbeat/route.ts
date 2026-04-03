// app/api/exam-security/session/heartbeat/route.ts

import { NextRequest } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

import { getResolvedSecurityPolicy } from "@/lib/exam-security/policy"
import {
  getSecuritySessionById,
  updateSecurityHeartbeat,
  updateSecuritySession,
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

    return Response.json(
      {
        success: true,
        data: {
          session: updatedSession,
          heartbeatAt: updatedSession.last_heartbeat_at,
        },
      } satisfies SecurityApiResponse<{
        session: SecuritySessionRecord
        heartbeatAt: string | null
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
