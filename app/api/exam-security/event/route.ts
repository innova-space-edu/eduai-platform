// app/api/exam-security/event/route.ts

import { NextRequest } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

import {
  computeEscalationAction,
  getEventGroup,
  getEventScore,
  getEventSeverity,
  getRiskLevel,
} from "@/lib/exam-security/scoring"
import { getResolvedSecurityPolicy } from "@/lib/exam-security/policy"
import {
  getSecuritySessionById,
  incrementSecuritySessionCounters,
  setSecuritySessionRisk,
  updateSecuritySession,
} from "@/lib/exam-security/session"

import type {
  SecurityActionDecision,
  SecurityActionType,
  SecurityApiResponse,
  SecurityEventInput,
  SecurityEventPayload,
  SecurityEventRecord,
  SecurityEvaluationResult,
  SecurityRiskLevel,
  SecuritySessionStatus,
  SecuritySeverity,
} from "@/lib/exam-security/types"

type LegacyIncidentRow = {
  id: string
  exam_id: string
  submission_id: string | null
  event_type: string
  severity: string
  question_index: number | null
  client_time_left: number | null
  created_at: string
  incident_number: number | null
  metadata: Record<string, unknown> | null
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

function mapActionToSessionStatus(actionType: SecurityActionType): SecuritySessionStatus {
  switch (actionType) {
    case "warn":
      return "warned"
    case "freeze":
      return "frozen"
    case "block":
      return "blocked"
    case "flag_review":
      return "flagged"
    case "terminate_attempt":
      return "terminated"
    default:
      return "active"
  }
}

async function insertSecurityEvent(params: {
  sessionId: string
  examId: string
  submissionId?: string | null
  eventType: SecurityEventInput["eventType"]
  severity: SecuritySeverity
  scoreDelta: number
  questionIndex?: number | null
  clientTimeLeft?: number | null
  payload?: SecurityEventPayload
}): Promise<SecurityEventRecord> {
  const admin = getAdmin()

  const payload = params.payload ?? {}

  const { count } = await admin
    .from("exam_security_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", params.sessionId)

  const incidentNumber = (count ?? 0) + 1

  const insertPayload = {
    session_id: params.sessionId,
    exam_id: params.examId,
    submission_id: params.submissionId ?? null,
    event_type: params.eventType,
    event_group: getEventGroup(params.eventType),
    severity: params.severity,
    score_delta: params.scoreDelta,
    question_index: params.questionIndex ?? null,
    client_time_left: params.clientTimeLeft ?? null,
    visibility_state:
      typeof payload.visibilityState === "string" ? payload.visibilityState : null,
    fullscreen:
      typeof payload.fullscreen === "boolean" ? payload.fullscreen : null,
    window_width:
      typeof payload.windowWidth === "number" ? payload.windowWidth : null,
    window_height:
      typeof payload.windowHeight === "number" ? payload.windowHeight : null,
    user_agent:
      typeof payload.userAgent === "string" ? payload.userAgent : null,
    incident_number: incidentNumber,
    payload,
  }

  const { data, error } = await admin
    .from("exam_security_events")
    .insert(insertPayload)
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
    .single<SecurityEventRecord>()

  if (error || !data) {
    throw new Error(
      error?.message || "No se pudo registrar el evento de seguridad"
    )
  }

  return data
}

async function insertSecurityAction(params: {
  sessionId: string
  examId: string
  submissionId?: string | null
  action: SecurityActionDecision
}) {
  const admin = getAdmin()

  if (!params.action || params.action.type === "none") {
    return
  }

  const { error } = await admin.from("exam_security_actions").insert({
    session_id: params.sessionId,
    exam_id: params.examId,
    submission_id: params.submissionId ?? null,
    action_type: params.action.type,
    reason: params.action.reason ?? null,
    duration_seconds: params.action.durationSeconds ?? null,
    applied_by: "system",
    payload: {
      message: params.action.message ?? null,
    },
  })

  if (error) {
    console.error("[exam-security/event:insertSecurityAction]", error.message)
  }
}

function buildEvaluationResult(params: {
  nextRiskScore: number
  nextRiskLevel: SecurityRiskLevel
  severity: SecuritySeverity
  scoreDelta: number
  action: SecurityActionDecision
}): SecurityEvaluationResult {
  return {
    success: true,
    riskScore: params.nextRiskScore,
    riskLevel: params.nextRiskLevel,
    severity: params.severity,
    scoreDelta: params.scoreDelta,
    action: params.action,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SecurityEventInput

    const sessionId = String(body.sessionId || "").trim()
    const examId = String(body.examId || "").trim()
    const submissionId = body.submissionId ? String(body.submissionId).trim() : null
    const eventType = body.eventType
    const questionIndex =
      typeof body.questionIndex === "number" ? body.questionIndex : null
    const clientTimeLeft =
      typeof body.clientTimeLeft === "number" ? body.clientTimeLeft : null
    const payload =
      body.payload && typeof body.payload === "object" ? body.payload : {}

    if (!sessionId || !examId || !eventType) {
      return Response.json(
        {
          success: false,
          error: "Faltan datos requeridos del evento.",
        },
        { status: 400 }
      )
    }

    const session = await getSecuritySessionById(sessionId)
    if (!session) {
      return Response.json(
        {
          success: false,
          error: "La sesión de seguridad no existe.",
        },
        { status: 404 }
      )
    }

    const policy = await getResolvedSecurityPolicy(examId)

    if (!policy.enabled) {
      return Response.json(
        {
          success: false,
          error: "La política de seguridad está deshabilitada.",
        },
        { status: 403 }
      )
    }

    const scoreDelta = getEventScore(eventType)
    const severity = getEventSeverity(eventType)
    const nextRiskScore = Math.max(0, (session.risk_score ?? 0) + scoreDelta)
    const nextRiskLevel = getRiskLevel(nextRiskScore)

    const action = computeEscalationAction({
      nextRiskScore,
      nextRiskLevel,
      eventType,
      session: {
        warning_count: session.warning_count,
        freeze_count: session.freeze_count,
        block_count: session.block_count,
        status: session.status,
      },
      policy,
    })

    const savedEvent = await insertSecurityEvent({
      sessionId,
      examId,
      submissionId,
      eventType,
      severity,
      scoreDelta,
      questionIndex,
      clientTimeLeft,
      payload,
    })

    const nextStatus = mapActionToSessionStatus(action.type)

    await setSecuritySessionRisk({
      sessionId,
      riskScore: nextRiskScore,
      riskLevel: nextRiskLevel,
      status: nextStatus,
    })

    if (action.type !== "none") {
      await incrementSecuritySessionCounters({
        session,
        actionType: action.type,
      })

      await insertSecurityAction({
        sessionId,
        examId,
        submissionId,
        action,
      })
    }

    if (action.type === "freeze" || action.type === "block") {
      await updateSecuritySession(sessionId, {
        last_event_at: new Date().toISOString(),
      })
    }

    const result = buildEvaluationResult({
      nextRiskScore,
      nextRiskLevel,
      severity,
      scoreDelta,
      action,
    })

    return Response.json(
      {
        success: true,
        data: {
          ...result,
          event: savedEvent,
        },
      } satisfies SecurityApiResponse<{
        event: SecurityEventRecord
      } & SecurityEvaluationResult>,
      { status: 200 }
    )
  } catch (error) {
    console.error("[exam-security/event:POST]", error)

    return Response.json(
      {
        success: false,
        error: "No se pudo procesar el evento de seguridad.",
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = getAdmin()
    const { searchParams } = new URL(req.url)

    const examId = searchParams.get("examId")?.trim() || ""
    const submissionId = searchParams.get("submissionId")?.trim() || ""

    if (!examId) {
      return Response.json(
        {
          success: false,
          error: "Falta examId.",
        },
        { status: 400 }
      )
    }

    let query = admin
      .from("exam_security_events")
      .select(
        `
          id,
          exam_id,
          submission_id,
          event_type,
          severity,
          question_index,
          client_time_left,
          created_at,
          incident_number,
          payload
        `
      )
      .eq("exam_id", examId)
      .order("created_at", { ascending: false })

    if (submissionId) {
      query = query.eq("submission_id", submissionId)
    }

    const { data: newEvents, error: newError } =
      await query.returns<LegacyIncidentRow[]>()

    if (!newError && newEvents) {
      const mapped = newEvents.map((item) => ({
        id: item.id,
        exam_id: item.exam_id,
        submission_id: item.submission_id,
        event_type: item.event_type,
        severity: item.severity,
        question_index: item.question_index,
        client_time_left: item.client_time_left,
        created_at: item.created_at,
        incident_number: item.incident_number,
        metadata: item.payload ?? {},
      }))

      return Response.json(
        {
          success: true,
          incidents: mapped,
        },
        { status: 200 }
      )
    }

    const fallbackQuery = admin
      .from("exam_incidents")
      .select(
        `
          id,
          exam_id,
          submission_id,
          event_type,
          severity,
          question_index,
          client_time_left,
          created_at,
          incident_number,
          metadata
        `
      )
      .eq("exam_id", examId)
      .order("created_at", { ascending: false })

    const finalFallbackQuery = submissionId
      ? fallbackQuery.eq("submission_id", submissionId)
      : fallbackQuery

    const { data: legacyIncidents, error: legacyError } =
      await finalFallbackQuery.returns<LegacyIncidentRow[]>()

    if (legacyError) {
      console.error("[exam-security/event:GET]", legacyError.message)

      return Response.json(
        {
          success: false,
          error: "No se pudieron obtener los incidentes.",
        },
        { status: 500 }
      )
    }

    return Response.json(
      {
        success: true,
        incidents: legacyIncidents ?? [],
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[exam-security/event:GET]", error)

    return Response.json(
      {
        success: false,
        error: "Error al obtener incidentes de seguridad.",
      },
      { status: 500 }
    )
  }
}
