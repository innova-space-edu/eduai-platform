import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { ANALYTICS_MODULES } from "@/lib/admin/analytics-catalog"

export const runtime = "nodejs"
export const maxDuration = 60

type UsageEvent = {
  user_id: string | null
  module_key: string
  module_name: string | null
  agent_key: string | null
  agent_name: string | null
  event_type: string
  success: boolean | null
  latency_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  estimated_cost: number | string | null
  error_code: string | null
  created_at: string
}

type AnonymousStudentAccumulator = {
  userId: string
  events: number
  pageViews: number
  actions: number
  generations: number
  exports: number
  errors: number
  successes: number
  latencyTotal: number
  latencyCount: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  modules: Set<string>
  agents: Set<string>
  firstActivity: string | null
  lastActivity: string | null
  examSubmissions: number
  examScoreTotal: number
  examScoreCount: number
  examScoreMin: number | null
  examScoreMax: number | null
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase administrativo no está configurado")
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: "No autenticado" }

  const { data: admin, error } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  if (error || !admin) return { user: null, error: "Acceso denegado" }
  return { user, error: null }
}

function parsePeriod(value: string | null) {
  if (value === "all") return { key: "all", days: null as number | null, label: "Todo el historial" }
  const parsed = Number(value || 30)
  const days = [7, 30, 90, 365].includes(parsed) ? parsed : 30
  return { key: String(days), days, label: `Últimos ${days} días` }
}

function toNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function getSubmissionUserId(row: Record<string, unknown>) {
  const candidates = [row.student_id, row.user_id, row.profile_id, row.student_user_id]
  return candidates.find(value => typeof value === "string" && value.length > 10) as string | undefined
}

function getSubmissionScore(row: Record<string, unknown>) {
  const candidates = [
    row.percentage,
    row.score_percentage,
    row.final_score,
    row.score,
    row.grade,
    row.nota,
  ]
  for (const value of candidates) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

function getSubmissionDate(row: Record<string, unknown>) {
  const candidates = [row.submitted_at, row.completed_at, row.created_at, row.updated_at]
  const value = candidates.find(item => typeof item === "string")
  return typeof value === "string" ? value : null
}

function createAccumulator(userId: string): AnonymousStudentAccumulator {
  return {
    userId,
    events: 0,
    pageViews: 0,
    actions: 0,
    generations: 0,
    exports: 0,
    errors: 0,
    successes: 0,
    latencyTotal: 0,
    latencyCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    modules: new Set(),
    agents: new Set(),
    firstActivity: null,
    lastActivity: null,
    examSubmissions: 0,
    examScoreTotal: 0,
    examScoreCount: 0,
    examScoreMin: null,
    examScoreMax: null,
  }
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 })

  const period = parsePeriod(new URL(request.url).searchParams.get("period"))
  const since = period.days
    ? new Date(Date.now() - period.days * 24 * 60 * 60 * 1000).toISOString()
    : null
  const admin = getAdminClient()

  try {
    let usageQuery = admin
      .from("eduai_usage_events")
      .select("user_id,module_key,module_name,agent_key,agent_name,event_type,success,latency_ms,input_tokens,output_tokens,estimated_cost,error_code,created_at")
      .order("created_at", { ascending: false })
      .limit(10_000)

    if (since) usageQuery = usageQuery.gte("created_at", since)

    let submissionQuery = admin
      .from("exam_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10_000)

    if (since) submissionQuery = submissionQuery.gte("created_at", since)

    const [usageResult, submissionResult, profilesResult] = await Promise.all([
      usageQuery,
      submissionQuery,
      admin.from("profiles").select("*", { count: "exact", head: true }),
    ])

    const usageEvents = (usageResult.error ? [] : usageResult.data || []) as UsageEvent[]
    const submissions = (submissionResult.error ? [] : submissionResult.data || []) as Record<string, unknown>[]
    const students = new Map<string, AnonymousStudentAccumulator>()

    for (const event of usageEvents) {
      if (!event.user_id) continue
      if (!students.has(event.user_id)) students.set(event.user_id, createAccumulator(event.user_id))
      const row = students.get(event.user_id)!

      row.events += 1
      row.pageViews += event.event_type === "page_view" ? 1 : 0
      row.actions += event.event_type === "page_view" ? 0 : 1
      row.generations += event.event_type === "generation" ? 1 : 0
      row.exports += event.event_type === "export" || event.event_type === "download" ? 1 : 0
      row.errors += event.success === false || event.event_type === "error" ? 1 : 0
      row.successes += event.success === false || event.event_type === "error" ? 0 : 1
      row.inputTokens += toNumber(event.input_tokens)
      row.outputTokens += toNumber(event.output_tokens)
      row.estimatedCost += toNumber(event.estimated_cost)
      if (toNumber(event.latency_ms) > 0) {
        row.latencyTotal += toNumber(event.latency_ms)
        row.latencyCount += 1
      }

      const moduleDefinition = ANALYTICS_MODULES.find(module => module.key === event.module_key)
      row.modules.add(event.module_name || moduleDefinition?.name || event.module_key)
      if (event.agent_name) row.agents.add(event.agent_name)
      if (!row.firstActivity || event.created_at < row.firstActivity) row.firstActivity = event.created_at
      if (!row.lastActivity || event.created_at > row.lastActivity) row.lastActivity = event.created_at
    }

    for (const submission of submissions) {
      const userId = getSubmissionUserId(submission)
      if (!userId) continue
      if (!students.has(userId)) students.set(userId, createAccumulator(userId))
      const row = students.get(userId)!
      const score = getSubmissionScore(submission)
      const date = getSubmissionDate(submission)

      row.examSubmissions += 1
      row.modules.add("Sistema de exámenes")
      row.agents.add("Evaluador IA")
      if (score !== null) {
        row.examScoreTotal += score
        row.examScoreCount += 1
        row.examScoreMin = row.examScoreMin === null ? score : Math.min(row.examScoreMin, score)
        row.examScoreMax = row.examScoreMax === null ? score : Math.max(row.examScoreMax, score)
      }
      if (date && (!row.firstActivity || date < row.firstActivity)) row.firstActivity = date
      if (date && (!row.lastActivity || date > row.lastActivity)) row.lastActivity = date
    }

    const orderedStudents = [...students.values()].sort((a, b) => {
      const byActivity = String(b.lastActivity || "").localeCompare(String(a.lastActivity || ""))
      if (byActivity !== 0) return byActivity
      return (b.events + b.examSubmissions) - (a.events + a.examSubmissions)
    })

    const anonymousStudents = orderedStudents.map((row, index) => ({
      anonymousId: `EST-${String(index + 1).padStart(4, "0")}`,
      events: row.events,
      pageViews: row.pageViews,
      actions: row.actions,
      generations: row.generations,
      exports: row.exports,
      errors: row.errors,
      successes: row.successes,
      successRate: row.events ? Math.round((row.successes / row.events) * 1000) / 10 : 0,
      avgLatencyMs: row.latencyCount ? Math.round(row.latencyTotal / row.latencyCount) : 0,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedCost: Math.round(row.estimatedCost * 1_000_000) / 1_000_000,
      modules: [...row.modules].sort(),
      agents: [...row.agents].sort(),
      firstActivity: row.firstActivity,
      lastActivity: row.lastActivity,
      examSubmissions: row.examSubmissions,
      averageExamScore: row.examScoreCount
        ? Math.round((row.examScoreTotal / row.examScoreCount) * 100) / 100
        : null,
      minimumExamScore: row.examScoreMin,
      maximumExamScore: row.examScoreMax,
    }))

    const anonymousErrors = usageEvents
      .filter(event => event.success === false || event.event_type === "error")
      .slice(0, 250)
      .map(event => ({
        moduleKey: event.module_key,
        moduleName: event.module_name || ANALYTICS_MODULES.find(module => module.key === event.module_key)?.name || event.module_key,
        agentName: event.agent_name,
        errorCode: event.error_code,
        createdAt: event.created_at,
      }))

    const response = NextResponse.json({
      generatedAt: new Date().toISOString(),
      period,
      methodology: {
        anonymization: "Identificadores temporales generados nuevamente para cada exportación",
        excludedFields: [
          "nombre",
          "correo",
          "RUT",
          "UUID",
          "dirección IP",
          "contenido de respuestas",
          "prompts",
          "datos PIE/NEE o salud",
        ],
        caution: "Los resultados se presentan con códigos temporales. No combinar con fuentes externas para intentar reidentificar a estudiantes.",
      },
      overview: {
        registeredProfiles: profilesResult.count || 0,
        anonymousStudents: anonymousStudents.length,
        usageEvents: usageEvents.length,
        examSubmissions: submissions.length,
        errors: anonymousErrors.length,
      },
      students: anonymousStudents,
      errors: anonymousErrors,
      coverage: {
        usageTrackingAvailable: !usageResult.error,
        examSubmissionsAvailable: !submissionResult.error,
        usageError: usageResult.error?.message || null,
        submissionsError: submissionResult.error?.message || null,
        usageLimitReached: usageEvents.length === 10_000,
        submissionLimitReached: submissions.length === 10_000,
      },
    })

    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (reportError) {
    return NextResponse.json(
      { error: reportError instanceof Error ? reportError.message : "No se pudo construir el reporte anónimo" },
      { status: 500 },
    )
  }
}
