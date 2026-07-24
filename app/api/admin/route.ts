// app/api/admin/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { ANALYTICS_MODULES } from "@/lib/admin/analytics-catalog"

export const runtime = "nodejs"
export const maxDuration = 60

// Cliente con service_role para operaciones que requieren acceso total
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Verifica que el usuario autenticado es admin
async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: "No autenticado" }

  const { data: isAdmin } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  if (!isAdmin) return { user: null, error: "Acceso denegado" }
  return { user, error: null }
}

type UsageEvent = {
  module_key: string
  module_name: string | null
  module_category: string | null
  agent_key: string | null
  agent_name: string | null
  event_type: string
  user_id: string | null
  success: boolean | null
  latency_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  estimated_cost: number | string | null
  path: string | null
  error_code: string | null
  created_at: string
}

type SourceCount = {
  table: string
  label: string
  count: number
  available: boolean
  error?: string
}

function parsePeriod(raw: string | null) {
  if (raw === "all") return { key: "all", days: null as number | null, label: "Todo el historial" }
  const value = Number(raw || 30)
  const days = [7, 30, 90, 365].includes(value) ? value : 30
  return { key: String(days), days, label: `Últimos ${days} días` }
}

function toNumber(value: unknown) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
}

async function safeCount(
  admin: ReturnType<typeof getAdminClient>,
  table: string,
  since: string | null,
  dateColumn = "created_at",
): Promise<SourceCount> {
  try {
    let query = admin.from(table).select("*", { count: "exact", head: true })
    if (since) query = query.gte(dateColumn, since)
    const { count, error } = await query
    if (error) return { table, label: table, count: 0, available: false, error: error.message }
    return { table, label: table, count: count || 0, available: true }
  } catch (error) {
    return {
      table,
      label: table,
      count: 0,
      available: false,
      error: error instanceof Error ? error.message : "No disponible",
    }
  }
}

async function buildAnalyticsReport(
  admin: ReturnType<typeof getAdminClient>,
  periodRaw: string | null,
) {
  const period = parsePeriod(periodRaw)
  const since = period.days
    ? new Date(Date.now() - period.days * 24 * 60 * 60 * 1000).toISOString()
    : null

  let eventQuery = admin
    .from("eduai_usage_events")
    .select("module_key,module_name,module_category,agent_key,agent_name,event_type,user_id,success,latency_ms,input_tokens,output_tokens,estimated_cost,path,error_code,created_at")
    .order("created_at", { ascending: false })
    .limit(10_000)

  if (since) eventQuery = eventQuery.gte("created_at", since)

  const { data: rawEvents, error: eventsError } = await eventQuery
  const events = (eventsError ? [] : rawEvents || []) as UsageEvent[]
  const trackingEnabled = !eventsError

  const sourceDefinitions = new Map<string, { table: string; label: string; dateColumn?: string }>()
  for (const module of ANALYTICS_MODULES) {
    for (const source of module.sources || []) {
      if (!sourceDefinitions.has(source.table)) sourceDefinitions.set(source.table, source)
    }
  }

  const sourceResults = await Promise.all(
    [...sourceDefinitions.values()].map(async source => {
      const result = await safeCount(admin, source.table, since, source.dateColumn || "created_at")
      return { ...result, label: source.label }
    }),
  )
  const sourceByTable = new Map(sourceResults.map(source => [source.table, source]))

  const moduleRows = ANALYTICS_MODULES.map(module => {
    const moduleEvents = events.filter(event => event.module_key === module.key)
    const userIds = new Set(moduleEvents.map(event => event.user_id).filter(Boolean))
    const successes = moduleEvents.filter(event => event.success !== false).length
    const errors = moduleEvents.filter(event => event.success === false || event.event_type === "error").length
    const latencyEvents = moduleEvents.filter(event => toNumber(event.latency_ms) > 0)
    const sourceBreakdown = (module.sources || []).map(source => {
      const stored = sourceByTable.get(source.table)
      return {
        table: source.table,
        label: source.label,
        count: stored?.count || 0,
        available: stored?.available ?? false,
      }
    })
    const lastActivity = moduleEvents[0]?.created_at || null

    return {
      key: module.key,
      name: module.name,
      category: module.category,
      href: module.href,
      icon: module.icon,
      description: module.description,
      agentKey: module.agentKey || null,
      agentName: module.agentName || null,
      events: moduleEvents.length,
      pageViews: moduleEvents.filter(event => event.event_type === "page_view").length,
      actions: moduleEvents.filter(event => event.event_type !== "page_view").length,
      uniqueUsers: userIds.size,
      successes,
      errors,
      successRate: percent(successes, moduleEvents.length),
      avgLatencyMs: latencyEvents.length
        ? Math.round(latencyEvents.reduce((total, event) => total + toNumber(event.latency_ms), 0) / latencyEvents.length)
        : 0,
      inputTokens: moduleEvents.reduce((total, event) => total + toNumber(event.input_tokens), 0),
      outputTokens: moduleEvents.reduce((total, event) => total + toNumber(event.output_tokens), 0),
      estimatedCost: Math.round(moduleEvents.reduce((total, event) => total + toNumber(event.estimated_cost), 0) * 1_000_000) / 1_000_000,
      storedRecords: sourceBreakdown.reduce((total, source) => total + source.count, 0),
      sourceBreakdown,
      lastActivity,
      status: moduleEvents.length > 0 ? "active" : sourceBreakdown.some(source => source.count > 0) ? "stored-data" : "no-data",
    }
  }).sort((a, b) => (b.events + b.storedRecords) - (a.events + a.storedRecords))

  const agentMap = new Map<string, {
    key: string
    name: string
    modules: Set<string>
    events: number
    pageViews: number
    actions: number
    users: Set<string>
    successes: number
    errors: number
    latencyTotal: number
    latencyCount: number
    inputTokens: number
    outputTokens: number
    estimatedCost: number
    storedRecords: number
    lastActivity: string | null
  }>()

  for (const module of moduleRows) {
    if (!module.agentKey || !module.agentName) continue
    if (!agentMap.has(module.agentKey)) {
      agentMap.set(module.agentKey, {
        key: module.agentKey,
        name: module.agentName,
        modules: new Set(),
        events: 0,
        pageViews: 0,
        actions: 0,
        users: new Set(),
        successes: 0,
        errors: 0,
        latencyTotal: 0,
        latencyCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
        storedRecords: 0,
        lastActivity: null,
      })
    }
    const row = agentMap.get(module.agentKey)!
    row.modules.add(module.name)
    row.events += module.events
    row.pageViews += module.pageViews
    row.actions += module.actions
    row.successes += module.successes
    row.errors += module.errors
    row.inputTokens += module.inputTokens
    row.outputTokens += module.outputTokens
    row.estimatedCost += module.estimatedCost
    row.storedRecords += module.storedRecords
    if (module.avgLatencyMs > 0 && module.events > 0) {
      row.latencyTotal += module.avgLatencyMs * module.events
      row.latencyCount += module.events
    }
    for (const event of events.filter(event => event.agent_key === module.agentKey)) {
      if (event.user_id) row.users.add(event.user_id)
    }
    if (module.lastActivity && (!row.lastActivity || module.lastActivity > row.lastActivity)) {
      row.lastActivity = module.lastActivity
    }
  }

  const agentRows = [...agentMap.values()].map(agent => ({
    key: agent.key,
    name: agent.name,
    modules: [...agent.modules],
    events: agent.events,
    pageViews: agent.pageViews,
    actions: agent.actions,
    uniqueUsers: agent.users.size,
    successes: agent.successes,
    errors: agent.errors,
    successRate: percent(agent.successes, agent.events),
    avgLatencyMs: agent.latencyCount ? Math.round(agent.latencyTotal / agent.latencyCount) : 0,
    inputTokens: agent.inputTokens,
    outputTokens: agent.outputTokens,
    estimatedCost: Math.round(agent.estimatedCost * 1_000_000) / 1_000_000,
    storedRecords: agent.storedRecords,
    lastActivity: agent.lastActivity,
  })).sort((a, b) => (b.events + b.storedRecords) - (a.events + a.storedRecords))

  const activeUserIds = new Set(events.map(event => event.user_id).filter(Boolean) as string[])
  const successCount = events.filter(event => event.success !== false).length
  const errorEvents = events.filter(event => event.success === false || event.event_type === "error")
  const latencyEvents = events.filter(event => toNumber(event.latency_ms) > 0)
  const totalStoredRecords = sourceResults.reduce((total, source) => total + source.count, 0)

  const topUserCounts = new Map<string, number>()
  for (const event of events) {
    if (!event.user_id) continue
    topUserCounts.set(event.user_id, (topUserCounts.get(event.user_id) || 0) + 1)
  }
  const topUserIds = [...topUserCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  let profileById = new Map<string, { id: string; name: string | null; email: string | null }>()
  if (topUserIds.length) {
    const { data: profiles } = await admin.from("profiles").select("id,name,email").in("id", topUserIds)
    profileById = new Map((profiles || []).map(profile => [profile.id, profile]))
  }

  const topUsers = topUserIds.map(id => ({
    id,
    name: profileById.get(id)?.name || "Usuario",
    email: profileById.get(id)?.email || "",
    events: topUserCounts.get(id) || 0,
  }))

  const chartDays = period.days ? Math.min(period.days, 30) : 30
  const activityMap = new Map<string, { date: string; events: number; users: Set<string>; errors: number }>()
  for (let offset = chartDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    activityMap.set(date, { date, events: 0, users: new Set(), errors: 0 })
  }
  for (const event of events) {
    const date = event.created_at.slice(0, 10)
    const day = activityMap.get(date)
    if (!day) continue
    day.events += 1
    if (event.user_id) day.users.add(event.user_id)
    if (event.success === false || event.event_type === "error") day.errors += 1
  }
  const activityByDay = [...activityMap.values()].map(day => ({
    date: day.date,
    events: day.events,
    uniqueUsers: day.users.size,
    errors: day.errors,
  }))

  const eventTypes = [...events.reduce((map, event) => {
    map.set(event.event_type, (map.get(event.event_type) || 0) + 1)
    return map
  }, new Map<string, number>()).entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  const { count: totalUsers } = await admin.from("profiles").select("*", { count: "exact", head: true })

  return {
    generatedAt: new Date().toISOString(),
    period,
    overview: {
      totalUsers: totalUsers || 0,
      activeUsers: activeUserIds.size,
      totalEvents: events.length,
      activeModules: moduleRows.filter(module => module.events > 0 || module.storedRecords > 0).length,
      totalModules: moduleRows.length,
      activeAgents: agentRows.filter(agent => agent.events > 0 || agent.storedRecords > 0).length,
      totalAgents: agentRows.length,
      successes: successCount,
      errors: errorEvents.length,
      successRate: percent(successCount, events.length),
      avgLatencyMs: latencyEvents.length
        ? Math.round(latencyEvents.reduce((total, event) => total + toNumber(event.latency_ms), 0) / latencyEvents.length)
        : 0,
      inputTokens: events.reduce((total, event) => total + toNumber(event.input_tokens), 0),
      outputTokens: events.reduce((total, event) => total + toNumber(event.output_tokens), 0),
      estimatedCost: Math.round(events.reduce((total, event) => total + toNumber(event.estimated_cost), 0) * 1_000_000) / 1_000_000,
      totalStoredRecords,
    },
    moduleRows,
    agentRows,
    activityByDay,
    eventTypes,
    topUsers,
    recentErrors: errorEvents.slice(0, 20).map(event => ({
      moduleKey: event.module_key,
      moduleName: event.module_name || event.module_key,
      agentName: event.agent_name,
      eventType: event.event_type,
      path: event.path,
      errorCode: event.error_code,
      createdAt: event.created_at,
    })),
    coverage: {
      trackingEnabled,
      trackingError: eventsError?.message || null,
      eventLimitReached: events.length >= 10_000,
      availableSources: sourceResults.filter(source => source.available).length,
      totalSources: sourceResults.length,
      missingSources: sourceResults
        .filter(source => !source.available)
        .map(source => ({ table: source.table, label: source.label, error: source.error })),
    },
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 })

  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")
  const userId = searchParams.get("userId")
  const admin = getAdminClient()

  try {
    // ── Listar todos los usuarios ─────────────────────────────────────────
    if (action === "users") {
      const page = parseInt(searchParams.get("page") || "1")
      const limit = 30
      const from = (page - 1) * limit
      const search = searchParams.get("search") || ""

      let query = admin
        .from("profiles")
        .select("id, name, email, xp, level, streak_days, created_at, user_code", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1)

      if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)

      const { data: profiles, count, error: err } = await query
      if (err) throw err

      return NextResponse.json({ users: profiles || [], total: count || 0, page, limit })
    }

    // ── Detalle de un usuario ─────────────────────────────────────────────
    if (action === "user" && userId) {
      const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single()
      const { data: sessions } = await admin
        .from("study_sessions")
        .select("id, topic, status, score, created_at, study_mode")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)
      const { data: reports } = await admin
        .from("admin_reports")
        .select("id, subject, status, category, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      const { count: examCount } = await admin
        .from("exam_submissions")
        .select("*", { count: "exact", head: true })
        .eq("student_id", userId)

      return NextResponse.json({ profile, sessions: sessions || [], reports: reports || [], examCount: examCount || 0 })
    }

    // ── Listar todos los reportes de soporte ──────────────────────────────
    if (action === "reports") {
      const status = searchParams.get("status") || ""
      const page = parseInt(searchParams.get("page") || "1")
      const limit = 20
      const from = (page - 1) * limit

      let query = admin
        .from("admin_reports")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1)

      if (status) query = query.eq("status", status)
      const { data, count } = await query
      return NextResponse.json({ reports: data || [], total: count || 0, page, limit })
    }

    // ── Reporte completo por módulo y agente ──────────────────────────────
    if (action === "analytics") {
      const report = await buildAnalyticsReport(admin, searchParams.get("period"))
      return NextResponse.json(report)
    }

    // ── Estadísticas globales rápidas ─────────────────────────────────────
    if (action === "stats") {
      const { count: totalUsers } = await admin.from("profiles").select("*", { count: "exact", head: true })
      const { count: totalSessions } = await admin.from("study_sessions").select("*", { count: "exact", head: true })
      const { count: openReports } = await admin.from("admin_reports").select("*", { count: "exact", head: true }).eq("status", "abierto")
      const { count: totalExams } = await admin.from("teacher_exams").select("*", { count: "exact", head: true })
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: activeToday } = await admin.from("study_sessions").select("*", { count: "exact", head: true }).gte("created_at", since)

      return NextResponse.json({ totalUsers, totalSessions, openReports, totalExams, activeToday })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 })

  const body = await request.json()
  const { action } = body
  const admin = getAdminClient()

  try {
    // ── Editar perfil de usuario ──────────────────────────────────────────
    if (action === "edit_user") {
      const { userId, name, xp, level, streak_days } = body
      if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 })

      const patch: Record<string, unknown> = {}
      if (name !== undefined) patch.name = String(name).trim()
      if (xp !== undefined) patch.xp = Math.max(0, Number(xp))
      if (level !== undefined) patch.level = Math.min(6, Math.max(1, Number(level)))
      if (streak_days !== undefined) patch.streak_days = Math.max(0, Number(streak_days))

      const { error: err } = await admin.from("profiles").update(patch).eq("id", userId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Resetear XP de usuario ────────────────────────────────────────────
    if (action === "reset_xp") {
      const { userId } = body
      const { error: err } = await admin.from("profiles").update({ xp: 0, level: 1, streak_days: 0 }).eq("id", userId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Eliminar todas las sesiones de un usuario ─────────────────────────
    if (action === "clear_sessions") {
      const { userId } = body
      const { error: err } = await admin.from("study_sessions").delete().eq("user_id", userId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Responder a un reporte ────────────────────────────────────────────
    if (action === "reply_report") {
      const { reportId, reply, newStatus } = body
      if (!reportId || !reply) return NextResponse.json({ error: "reportId y reply requeridos" }, { status: 400 })

      const patch: Record<string, unknown> = {
        admin_reply: reply,
        admin_id: user.id,
        status: newStatus || "resuelto",
      }
      if (newStatus === "resuelto" || newStatus === "cerrado") patch.resolved_at = new Date().toISOString()

      const { error: err } = await admin.from("admin_reports").update(patch).eq("id", reportId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Cambiar estado de reporte ─────────────────────────────────────────
    if (action === "update_report_status") {
      const { reportId, status: newStatus } = body
      const patch: Record<string, unknown> = { status: newStatus }
      if (newStatus === "resuelto" || newStatus === "cerrado") patch.resolved_at = new Date().toISOString()
      const { error: err } = await admin.from("admin_reports").update(patch).eq("id", reportId)
      if (err) throw err
      return NextResponse.json({ success: true })
    }

    // ── Agregar / quitar admin ────────────────────────────────────────────
    if (action === "add_admin") {
      const { email } = body
      if (!email) return NextResponse.json({ error: "email requerido" }, { status: 400 })
      await admin.from("admin_emails").upsert({ email }, { onConflict: "email" })
      return NextResponse.json({ success: true })
    }

    if (action === "remove_admin") {
      const { email } = body
      if (!email) return NextResponse.json({ error: "email requerido" }, { status: 400 })
      if (["admin@colprovidencia.cl", "emorales@colprovidencia.cl"].includes(email)) {
        return NextResponse.json({ error: "No se pueden remover los admins fundadores" }, { status: 403 })
      }
      await admin.from("admin_emails").delete().eq("email", email)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 })
  }
}
