// lib/exam-security/result-utils.ts

export type ResultIncident = {
  id: string
  exam_id?: string
  submission_id?: string | null
  event_type: string
  severity: string
  question_index?: number | null
  client_time_left?: number | null
  created_at: string
  incident_number?: number | null
  metadata?: Record<string, unknown> | null
}

export type IncidentSeverityCount = {
  low: number
  medium: number
  high: number
  critical: number
}

export type IncidentActionSummary = {
  hasWarn: boolean
  hasFreeze: boolean
  hasBlock: boolean
  hasFlagReview: boolean
  hasTerminate: boolean
}

export type IncidentSummary = {
  total: number
  severity: IncidentSeverityCount
  estimatedRiskScore: number
  topSeverity: "clean" | "low" | "medium" | "high" | "critical"
  topAction: "none" | "warn" | "freeze" | "block" | "flag_review" | "terminate_attempt"
  byEventType: Record<string, number>
}

const EVENT_SCORE_MAP: Record<string, number> = {
  security_session_start: 0,
  security_session_end: 0,

  fullscreen_exit: 15,
  fullscreen_reenter: 0,

  window_blur: 8,
  window_focus_return: 0,

  tab_hidden: 10,
  visibility_return: 0,

  copy_attempt: 18,
  paste_attempt: 15,
  cut_attempt: 15,

  contextmenu_attempt: 10,
  blocked_shortcut: 12,
  print_attempt: 20,
  reload_attempt: 18,
  drag_attempt: 8,

  heartbeat_missed: 12,
  reconnect_attempt: 10,
  network_offline: 4,
  network_online: 0,

  exam_submit: 0,
}

export function getEstimatedEventScore(eventType: string): number {
  return EVENT_SCORE_MAP[eventType] ?? 0
}

export function getRiskLevelFromScore(score: number): "clean" | "low" | "medium" | "high" {
  if (score >= 70) return "high"
  if (score >= 40) return "medium"
  if (score >= 20) return "low"
  return "clean"
}

export function emptySeverityCount(): IncidentSeverityCount {
  return {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }
}

export function normalizeSeverity(value?: string | null): "low" | "medium" | "high" | "critical" {
  const normalized = String(value || "low").toLowerCase()

  if (normalized === "critical") return "critical"
  if (normalized === "high") return "high"
  if (normalized === "medium") return "medium"
  return "low"
}

export function severityPriority(
  value: "clean" | "low" | "medium" | "high" | "critical"
): number {
  switch (value) {
    case "critical":
      return 4
    case "high":
      return 3
    case "medium":
      return 2
    case "low":
      return 1
    default:
      return 0
  }
}

export function getTopSeverity(
  counts: IncidentSeverityCount
): "clean" | "low" | "medium" | "high" | "critical" {
  if (counts.critical > 0) return "critical"
  if (counts.high > 0) return "high"
  if (counts.medium > 0) return "medium"
  if (counts.low > 0) return "low"
  return "clean"
}

export function inferTopActionFromIncidents(
  incidents: ResultIncident[]
): "none" | "warn" | "freeze" | "block" | "flag_review" | "terminate_attempt" {
  let hasWarn = false
  let hasFreeze = false
  let hasBlock = false
  let hasFlagReview = false
  let hasTerminate = false

  for (const incident of incidents) {
    const type = String(incident.event_type || "")

    if (type === "print_attempt") {
      hasTerminate = true
      continue
    }

    if (type === "copy_attempt" || type === "reload_attempt") {
      hasFreeze = true
      continue
    }

    if (type === "fullscreen_exit" || type === "tab_hidden") {
      hasWarn = true
      continue
    }

    if (type === "heartbeat_missed") {
      hasFlagReview = true
      continue
    }

    if (type === "blocked_shortcut" && normalizeSeverity(incident.severity) === "high") {
      hasBlock = true
    }
  }

  if (hasTerminate) return "terminate_attempt"
  if (hasBlock) return "block"
  if (hasFlagReview) return "flag_review"
  if (hasFreeze) return "freeze"
  if (hasWarn) return "warn"
  return "none"
}

export function summarizeIncidents(incidents: ResultIncident[]): IncidentSummary {
  const severity = emptySeverityCount()
  const byEventType: Record<string, number> = {}
  let estimatedRiskScore = 0

  for (const incident of incidents) {
    const normalizedSeverity = normalizeSeverity(incident.severity)
    severity[normalizedSeverity] += 1

    const eventType = String(incident.event_type || "unknown")
    byEventType[eventType] = (byEventType[eventType] ?? 0) + 1

    estimatedRiskScore += getEstimatedEventScore(eventType)
  }

  return {
    total: incidents.length,
    severity,
    estimatedRiskScore,
    topSeverity: getTopSeverity(severity),
    topAction: inferTopActionFromIncidents(incidents),
    byEventType,
  }
}

export function getTopIncidentTypes(
  incidents: ResultIncident[],
  limit = 4
): Array<{ eventType: string; count: number }> {
  const summary = summarizeIncidents(incidents)

  return Object.entries(summary.byEventType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([eventType, count]) => ({
      eventType,
      count,
    }))
}

export function getRiskBadgeTone(
  level: "clean" | "low" | "medium" | "high" | "critical"
): string {
  switch (level) {
    case "critical":
      return "bg-red-500/15 text-red-300 border-red-400/30"
    case "high":
      return "bg-orange-500/15 text-orange-300 border-orange-400/30"
    case "medium":
      return "bg-yellow-500/15 text-yellow-300 border-yellow-400/30"
    case "low":
      return "bg-sky-500/15 text-sky-300 border-sky-400/30"
    default:
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
  }
}

export function getActionBadgeTone(
  action: "none" | "warn" | "freeze" | "block" | "flag_review" | "terminate_attempt"
): string {
  switch (action) {
    case "terminate_attempt":
      return "bg-red-600/15 text-red-200 border-red-400/30"
    case "block":
      return "bg-red-500/15 text-red-300 border-red-400/30"
    case "flag_review":
      return "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30"
    case "freeze":
      return "bg-orange-500/15 text-orange-300 border-orange-400/30"
    case "warn":
      return "bg-yellow-500/15 text-yellow-300 border-yellow-400/30"
    default:
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
  }
}

export function getActionLabel(
  action: "none" | "warn" | "freeze" | "block" | "flag_review" | "terminate_attempt"
): string {
  switch (action) {
    case "warn":
      return "Advertencia"
    case "freeze":
      return "Bloqueo temporal"
    case "block":
      return "Bloqueo"
    case "flag_review":
      return "Revisión obligatoria"
    case "terminate_attempt":
      return "Intento terminado"
    default:
      return "Sin acción grave"
  }
}
