export type EduAIEventType =
  | "page_view"
  | "action"
  | "generation"
  | "export"
  | "upload"
  | "download"
  | "error"

export type EduAIAnalyticsMetadata = Record<string, string | number | boolean | null>

export type EduAITrackInput = {
  path?: string
  eventType: EduAIEventType
  success?: boolean
  latencyMs?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
  estimatedCost?: number | null
  errorCode?: string | null
  metadata?: EduAIAnalyticsMetadata
}

const MAX_METADATA_KEYS = 24
const MAX_STRING_LENGTH = 180

function finiteNumber(value: unknown, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.min(parsed, max)
}

export function sanitizeAnalyticsMetadata(
  value: unknown,
): EduAIAnalyticsMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}

  const result: EduAIAnalyticsMetadata = {}
  for (const [key, rawValue] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80)
    if (!safeKey) continue

    if (typeof rawValue === "string") {
      result[safeKey] = rawValue.slice(0, MAX_STRING_LENGTH)
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      result[safeKey] = rawValue
    } else if (typeof rawValue === "boolean" || rawValue === null) {
      result[safeKey] = rawValue
    }
  }

  return result
}

export function trackEduAIEvent(input: EduAITrackInput) {
  if (typeof window === "undefined") return

  const payload = JSON.stringify({
    path: (input.path || window.location.pathname).slice(0, 500),
    eventType: input.eventType,
    success: input.success !== false,
    latencyMs: finiteNumber(input.latencyMs, 3_600_000),
    inputTokens: finiteNumber(input.inputTokens, 10_000_000),
    outputTokens: finiteNumber(input.outputTokens, 10_000_000),
    estimatedCost: finiteNumber(input.estimatedCost, 1_000_000),
    errorCode: typeof input.errorCode === "string"
      ? input.errorCode.slice(0, 120)
      : null,
    metadata: sanitizeAnalyticsMetadata(input.metadata),
  })

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" })
      if (navigator.sendBeacon("/api/analytics/track", blob)) return
    }
  } catch {
    // Si sendBeacon no está disponible se utiliza fetch sin bloquear la interfaz.
  }

  window.fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: payload,
  }).catch(() => {
    // La analítica nunca debe interrumpir una tarea educativa.
  })
}
