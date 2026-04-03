// lib/exam-security/session.ts

import { createClient as createAdminClient } from "@supabase/supabase-js"
import type {
  SecurityClientMetadata,
  SecurityHeartbeatInput,
  SecurityRiskLevel,
  SecuritySessionRecord,
  SecuritySessionStartInput,
  SecuritySessionStatus,
} from "./types"

type SecuritySessionRow = {
  id: string
  exam_id: string
  submission_id: string | null
  teacher_id: string | null
  student_name: string | null
  student_course: string | null
  student_rut: string | null
  status: SecuritySessionStatus
  risk_score: number | null
  risk_level: SecurityRiskLevel | null
  warning_count: number | null
  freeze_count: number | null
  block_count: number | null
  last_event_at: string | null
  last_heartbeat_at: string | null
  started_at: string
  ended_at: string | null
  client_metadata: SecurityClientMetadata | null
  created_at: string
  updated_at: string
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

function normalizeSession(row: SecuritySessionRow): SecuritySessionRecord {
  return {
    id: row.id,
    exam_id: row.exam_id,
    submission_id: row.submission_id,
    teacher_id: row.teacher_id,
    student_name: row.student_name,
    student_course: row.student_course,
    student_rut: row.student_rut,
    status: row.status ?? "active",
    risk_score: row.risk_score ?? 0,
    risk_level: row.risk_level ?? "clean",
    warning_count: row.warning_count ?? 0,
    freeze_count: row.freeze_count ?? 0,
    block_count: row.block_count ?? 0,
    last_event_at: row.last_event_at,
    last_heartbeat_at: row.last_heartbeat_at,
    started_at: row.started_at,
    ended_at: row.ended_at,
    client_metadata: row.client_metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mergeMetadata(
  previous?: SecurityClientMetadata | null,
  next?: SecurityClientMetadata | null
): SecurityClientMetadata {
  return {
    ...(previous ?? {}),
    ...(next ?? {}),
  }
}

export async function getSecuritySessionById(
  sessionId: string
): Promise<SecuritySessionRecord | null> {
  const admin = getAdmin()

  const { data, error } = await admin
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
    .maybeSingle<SecuritySessionRow>()

  if (error) {
    console.error("[exam-security/session:getSecuritySessionById]", error.message)
    return null
  }

  if (!data) return null

  return normalizeSession(data)
}

export async function findActiveSession(params: {
  examId: string
  submissionId?: string | null
}): Promise<SecuritySessionRecord | null> {
  const admin = getAdmin()
  const { examId, submissionId } = params

  let query = admin
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
    .eq("exam_id", examId)
    .in("status", ["active", "warned", "frozen", "blocked", "flagged", "offline_grace"])
    .order("created_at", { ascending: false })
    .limit(1)

  if (submissionId) {
    query = query.eq("submission_id", submissionId)
  } else {
    query = query.is("submission_id", null)
  }

  const { data, error } = await query.maybeSingle<SecuritySessionRow>()

  if (error) {
    console.error("[exam-security/session:findActiveSession]", error.message)
    return null
  }

  if (!data) return null

  return normalizeSession(data)
}

export async function createSecuritySession(
  input: SecuritySessionStartInput
): Promise<SecuritySessionRecord> {
  const admin = getAdmin()

  const now = new Date().toISOString()

  const payload = {
    exam_id: input.examId,
    submission_id: input.submissionId ?? null,
    student_name: input.studentName ?? null,
    student_course: input.studentCourse ?? null,
    student_rut: input.studentRut ?? null,
    status: "active" as SecuritySessionStatus,
    risk_score: 0,
    risk_level: "clean" as SecurityRiskLevel,
    warning_count: 0,
    freeze_count: 0,
    block_count: 0,
    last_event_at: now,
    last_heartbeat_at: now,
    started_at: now,
    ended_at: null,
    client_metadata: input.clientMetadata ?? {},
  }

  const { data, error } = await admin
    .from("exam_security_sessions")
    .insert(payload)
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
    .single<SecuritySessionRow>()

  if (error || !data) {
    throw new Error(
      error?.message || "No se pudo crear la sesión de seguridad"
    )
  }

  return normalizeSession(data)
}

export async function startOrReuseSecuritySession(
  input: SecuritySessionStartInput
): Promise<SecuritySessionRecord> {
  const existing = await findActiveSession({
    examId: input.examId,
    submissionId: input.submissionId ?? null,
  })

  if (!existing) {
    return createSecuritySession(input)
  }

  const mergedMetadata = mergeMetadata(
    existing.client_metadata,
    input.clientMetadata ?? {}
  )

  const updated = await updateSecuritySession(existing.id, {
    student_name: input.studentName ?? existing.student_name,
    student_course: input.studentCourse ?? existing.student_course,
    student_rut: input.studentRut ?? existing.student_rut,
    client_metadata: mergedMetadata,
    last_heartbeat_at: new Date().toISOString(),
    status:
      existing.status === "finished" || existing.status === "terminated"
        ? "active"
        : existing.status,
    ended_at: null,
  })

  if (!updated) {
    throw new Error("No se pudo reactivar la sesión existente")
  }

  return updated
}

export async function updateSecuritySession(
  sessionId: string,
  updates: Record<string, unknown>
): Promise<SecuritySessionRecord | null> {
  const admin = getAdmin()

  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from("exam_security_sessions")
    .update(payload)
    .eq("id", sessionId)
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
    .maybeSingle<SecuritySessionRow>()

  if (error) {
    console.error("[exam-security/session:updateSecuritySession]", error.message)
    return null
  }

  if (!data) return null

  return normalizeSession(data)
}

export async function updateSecurityHeartbeat(
  input: SecurityHeartbeatInput
): Promise<SecuritySessionRecord | null> {
  const current = await getSecuritySessionById(input.sessionId)
  if (!current) return null

  const mergedMetadata = mergeMetadata(
    current.client_metadata,
    (input.payload as SecurityClientMetadata | undefined) ?? {}
  )

  return updateSecuritySession(input.sessionId, {
    last_heartbeat_at: new Date().toISOString(),
    client_metadata: mergedMetadata,
    status:
      current.status === "offline_grace"
        ? "active"
        : current.status,
  })
}

export async function finishSecuritySession(params: {
  sessionId: string
  status?: Extract<SecuritySessionStatus, "finished" | "terminated">
}): Promise<SecuritySessionRecord | null> {
  const nextStatus = params.status ?? "finished"

  return updateSecuritySession(params.sessionId, {
    status: nextStatus,
    ended_at: new Date().toISOString(),
  })
}

export async function incrementSecuritySessionCounters(params: {
  session: SecuritySessionRecord
  actionType?: string
}): Promise<SecuritySessionRecord | null> {
  const { session, actionType } = params

  const nextWarningCount =
    session.warning_count + (actionType === "warn" ? 1 : 0)

  const nextFreezeCount =
    session.freeze_count + (actionType === "freeze" ? 1 : 0)

  const nextBlockCount =
    session.block_count + (actionType === "block" ? 1 : 0)

  return updateSecuritySession(session.id, {
    warning_count: nextWarningCount,
    freeze_count: nextFreezeCount,
    block_count: nextBlockCount,
  })
}

export async function setSecuritySessionRisk(params: {
  sessionId: string
  riskScore: number
  riskLevel: SecurityRiskLevel
  status?: SecuritySessionStatus
}): Promise<SecuritySessionRecord | null> {
  return updateSecuritySession(params.sessionId, {
    risk_score: params.riskScore,
    risk_level: params.riskLevel,
    status: params.status,
    last_event_at: new Date().toISOString(),
  })
}
