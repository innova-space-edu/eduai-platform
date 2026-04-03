// app/api/exam-security/admin/dashboard/route.ts

import { NextRequest } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

type SessionRow = {
  id: string
  exam_id: string
  submission_id: string | null
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
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  event_type: string
  severity: string
  incident_number: number | null
  created_at: string
}

type ActionRow = {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  action_type: string
  reason: string | null
  applied_by: string
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

function hoursAgoToIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

export async function GET(req: NextRequest) {
  try {
    const admin = getAdmin()
    const { searchParams } = new URL(req.url)

    const examId = searchParams.get("examId")?.trim() || ""
    const hoursWindow = Number(searchParams.get("hours") || "24")

    let sessionsQuery = admin
      .from("exam_security_sessions")
      .select(
        `
          id,
          exam_id,
          submission_id,
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
          created_at,
          updated_at
        `
      )
      .gte("created_at", hoursAgoToIso(hoursWindow))
      .order("created_at", { ascending: false })

    let eventsQuery = admin
      .from("exam_security_events")
      .select(
        `
          id,
          session_id,
          exam_id,
          submission_id,
          event_type,
          severity,
          incident_number,
          created_at
        `
      )
      .gte("created_at", hoursAgoToIso(hoursWindow))
      .order("created_at", { ascending: false })
      .limit(50)

    let actionsQuery = admin
      .from("exam_security_actions")
      .select(
        `
          id,
          session_id,
          exam_id,
          submission_id,
          action_type,
          reason,
          applied_by,
          created_at
        `
      )
      .gte("created_at", hoursAgoToIso(hoursWindow))
      .order("created_at", { ascending: false })
      .limit(50)

    if (examId) {
      sessionsQuery = sessionsQuery.eq("exam_id", examId)
      eventsQuery = eventsQuery.eq("exam_id", examId)
      actionsQuery = actionsQuery.eq("exam_id", examId)
    }

    const [
      { data: sessions, error: sessionsError },
      { data: events, error: eventsError },
      { data: actions, error: actionsError },
    ] = await Promise.all([
      sessionsQuery.returns<SessionRow[]>(),
      eventsQuery.returns<EventRow[]>(),
      actionsQuery.returns<ActionRow[]>(),
    ])

    if (sessionsError) {
      console.error("[exam-security/admin/dashboard:sessions]", sessionsError.message)
      return Response.json(
        {
          success: false,
          error: "No se pudieron obtener las sesiones de seguridad.",
        },
        { status: 500 }
      )
    }

    if (eventsError) {
      console.error("[exam-security/admin/dashboard:events]", eventsError.message)
      return Response.json(
        {
          success: false,
          error: "No se pudieron obtener los eventos de seguridad.",
        },
        { status: 500 }
      )
    }

    if (actionsError) {
      console.error("[exam-security/admin/dashboard:actions]", actionsError.message)
      return Response.json(
        {
          success: false,
          error: "No se pudieron obtener las acciones de seguridad.",
        },
        { status: 500 }
      )
    }

    const safeSessions = sessions ?? []
    const safeEvents = events ?? []
    const safeActions = actions ?? []

    const activeSessions = safeSessions.filter((s) =>
      ["active", "warned", "frozen", "blocked", "flagged", "offline_grace"].includes(
        s.status
      )
    )

    const frozenSessions = safeSessions.filter((s) => s.status === "frozen")
    const blockedSessions = safeSessions.filter((s) => s.status === "blocked")
    const flaggedSessions = safeSessions.filter((s) => s.status === "flagged")
    const highRiskSessions = safeSessions.filter((s) =>
      ["medium", "high"].includes(String(s.risk_level || ""))
    )

    const incidentsBySeverity = {
      low: safeEvents.filter((e) => e.severity === "low").length,
      medium: safeEvents.filter((e) => e.severity === "medium").length,
      high: safeEvents.filter((e) => e.severity === "high").length,
      critical: safeEvents.filter((e) => e.severity === "critical").length,
    }

    return Response.json(
      {
        success: true,
        data: {
          summary: {
            totalSessions: safeSessions.length,
            activeSessions: activeSessions.length,
            frozenSessions: frozenSessions.length,
            blockedSessions: blockedSessions.length,
            flaggedSessions: flaggedSessions.length,
            highRiskSessions: highRiskSessions.length,
            totalEvents: safeEvents.length,
            totalActions: safeActions.length,
            incidentsBySeverity,
          },
          sessions: safeSessions,
          recentEvents: safeEvents,
          recentActions: safeActions,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[exam-security/admin/dashboard:GET]", error)

    return Response.json(
      {
        success: false,
        error: "No se pudo cargar el dashboard de seguridad.",
      },
      { status: 500 }
    )
  }
}
