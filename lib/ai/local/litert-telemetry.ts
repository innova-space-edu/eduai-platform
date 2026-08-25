export type LocalAIEventKind = "inference" | "benchmark" | "quantization"
export type LocalAIBackend = "webgpu" | "wasm"

export type LocalAIEvent = {
  id: string
  groupId: string
  createdAt: string
  kind: LocalAIEventKind
  backend?: LocalAIBackend
  modelId?: string
  latencyMs?: number
  compileMs?: number
  runCount?: number
  runtimeReused?: boolean
  success: boolean
  note?: string
}

export type LocalAITelemetrySummary = {
  events: number
  inferenceTasks: number
  benchmarkSessions: number
  quantizationSessions: number
  measuredRuns: number
  webgpuRuns: number
  wasmRuns: number
  webgpuShare: number
  medianLatencyMs: number
  runtimeReuseRate: number
}

export const LOCAL_AI_TELEMETRY_STORAGE_KEY = "eduai_local_ai_telemetry_v1"
export const LOCAL_AI_TELEMETRY_EVENT = "eduai:local-ai-telemetry"
const MAX_EVENTS = 250

function safeWindow() {
  return typeof window !== "undefined" ? window : null
}

export function readLocalAIEvents(): LocalAIEvent[] {
  const target = safeWindow()
  if (!target) return []
  try {
    const parsed = JSON.parse(target.localStorage.getItem(LOCAL_AI_TELEMETRY_STORAGE_KEY) || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).slice(0, MAX_EVENTS) as LocalAIEvent[]
  } catch {
    return []
  }
}

export function recordLocalAIEvent(event: Omit<LocalAIEvent, "id" | "createdAt">) {
  const target = safeWindow()
  if (!target) return null
  const nextEvent: LocalAIEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  }
  const next = [nextEvent, ...readLocalAIEvents()].slice(0, MAX_EVENTS)
  target.localStorage.setItem(LOCAL_AI_TELEMETRY_STORAGE_KEY, JSON.stringify(next))
  target.dispatchEvent(new CustomEvent(LOCAL_AI_TELEMETRY_EVENT, { detail: nextEvent }))
  return nextEvent
}

export function clearLocalAIEvents() {
  const target = safeWindow()
  if (!target) return
  target.localStorage.removeItem(LOCAL_AI_TELEMETRY_STORAGE_KEY)
  target.dispatchEvent(new CustomEvent(LOCAL_AI_TELEMETRY_EVENT, { detail: null }))
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function summarizeLocalAIEvents(events: LocalAIEvent[]): LocalAITelemetrySummary {
  const successful = events.filter(event => event.success)
  const benchmarkGroups = new Set(successful.filter(event => event.kind === "benchmark").map(event => event.groupId))
  const quantizationGroups = new Set(successful.filter(event => event.kind === "quantization").map(event => event.groupId))
  const backendEvents = successful.filter(event => event.backend && (event.runCount || 0) > 0)
  const webgpuRuns = backendEvents.filter(event => event.backend === "webgpu").reduce((sum, event) => sum + (event.runCount || 0), 0)
  const wasmRuns = backendEvents.filter(event => event.backend === "wasm").reduce((sum, event) => sum + (event.runCount || 0), 0)
  const measuredRuns = successful.reduce((sum, event) => sum + (event.runCount || 0), 0)
  const latencyValues = successful.map(event => event.latencyMs).filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  const reuseEligible = successful.filter(event => typeof event.runtimeReused === "boolean")
  const runtimeReuseRate = reuseEligible.length
    ? (reuseEligible.filter(event => event.runtimeReused).length / reuseEligible.length) * 100
    : 0

  return {
    events: successful.length,
    inferenceTasks: successful.filter(event => event.kind === "inference").length,
    benchmarkSessions: benchmarkGroups.size,
    quantizationSessions: quantizationGroups.size,
    measuredRuns,
    webgpuRuns,
    wasmRuns,
    webgpuShare: webgpuRuns + wasmRuns > 0 ? (webgpuRuns / (webgpuRuns + wasmRuns)) * 100 : 0,
    medianLatencyMs: median(latencyValues),
    runtimeReuseRate,
  }
}
