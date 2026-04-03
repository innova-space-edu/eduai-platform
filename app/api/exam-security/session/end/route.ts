// app/api/exam-security/session/end/route.ts

import { NextRequest } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

import { getSecuritySessionById, finishSecuritySession } from "@/lib/exam-security/session"
import type {
  SecurityApiResponse,
  SecuritySessionRecord,
  SecuritySessionStatus,
} from "@/lib/exam-security/types"

type SessionEndInput = {
  sessionId?: string
  examId?: string
  submissionId?: string | null
  status?: "finished" | "terminated"
  reason?: string
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

async function saveEndAction(params: {
  sessionId: string
  examId: string
  submissionId?: string | null
  status: Extract<SecuritySessionStatus, "finished" | "terminated">
  reason?: string
}) {
  const admin = getAdmin()

  const actionType =
    params.status === "terminated" ? "terminate_attempt" : "clear_state"

  const { error } = await admin.from("exam_security_actions").insert({
    session_id: params.sessionId,
    exam_id: params.examId,
    submission_id: params.submissionId ?? null,
    action_type: actionType,
    reason: params.reason ?? null,
    duration_seconds: null,
    applied_by: "system",
    payload: {
      ended_status: params.status,
      reason: params.reason ?? null,
    },
  })

  if (error) {
    console.error("[exam-security/session/end:saveEndAction]", error.message)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SessionEndInput

    const sessionId = String(body.sessionId || "").trim()
    const examId = String(body.examId || "").trim()
    const submissionId = body.submissionId
      ? String(body.submissionId).trim()
      : null
    const status: Extract<SecuritySessionStatus, "finished" | "terminated"> =
      body.status === "terminated" ? "terminated" : "finished"
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : undefined

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

    const updated = await finishSecuritySession({
      sessionId,
      status,
    })

    if (!updated) {
      return Response.json(
        {
          success: false,
          error: "No se pudo cerrar la sesión.",
        } satisfies SecurityApiResponse,
        { status: 500 }
      )
    }

    await saveEndAction({
      sessionId,
      examId,
      submissionId,
      status,
      reason,
    })

    return Response.json(
      {
        success: true,
        data: {
          session: updated,
        },
      } satisfies SecurityApiResponse<{
        session: SecuritySessionRecord
      }>,
      { status: 200 }
    )
  } catch (error) {
    console.error("[exam-security/session/end:POST]", error)

    return Response.json(
      {
        success: false,
        error: "No se pudo cerrar la sesión de seguridad.",
      } satisfies SecurityApiResponse,
      { status: 500 }
    )
  }
}
