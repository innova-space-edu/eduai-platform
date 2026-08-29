import type { BrainAITrace, BrainAITraceSummary } from "@/lib/brain-ai/types"

const STORAGE_KEY = "eduai_brain_ai_shadow_traces_v1"
const MAX_TRACES = 40

export type BrainAIPersistenceStatus = "saved" | "migration-required" | "unavailable"

type StoredTrace = Pick<BrainAITrace,
  | "traceId"
  | "createdAt"
  | "modalities"
  | "intent"
  | "route"
  | "complexity"
  | "confidence"
  | "productionStage"
  | "estimatedLocality"
  | "expectedLatencyClass"
> & {
  planLength: number
  gatePassRate: number
}

function browserStorage() {
  return typeof window !== "undefined" ? window.localStorage : null
}

function readRaw(): StoredTrace[] {
  const storage = browserStorage()
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]")
    return Array.isArray(parsed) ? parsed.slice(0, MAX_TRACES) as StoredTrace[] : []
  } catch {
    return []
  }
}

export function recordBrainAITrace(trace: BrainAITrace) {
  const storage = browserStorage()
  if (!storage) return
  const passed = trace.gates.filter(gate => gate.passed).length
  const record: StoredTrace = {
    traceId: trace.traceId,
    createdAt: trace.createdAt,
    modalities: trace.modalities,
    intent: trace.intent,
    route: trace.route,
    complexity: trace.complexity,
    confidence: trace.confidence,
    productionStage: trace.productionStage,
    estimatedLocality: trace.estimatedLocality,
    expectedLatencyClass: trace.expectedLatencyClass,
    planLength: trace.plan.length,
    gatePassRate: trace.gates.length ? passed / trace.gates.length : 0,
  }
  const next = [record, ...readRaw().filter(item => item.traceId !== record.traceId)].slice(0, MAX_TRACES)
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent("eduai:brain-ai-shadow-trace", { detail: record }))
}

export async function persistBrainAITrace(trace: BrainAITrace): Promise<BrainAIPersistenceStatus> {
  if (typeof window === "undefined") return "unavailable"
  try {
    const response = await fetch("/api/admin/brain-ai/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trace }),
    })
    const body = await response.json().catch(() => ({})) as { migrationRequired?: boolean }
    if (body.migrationRequired) return "migration-required"
    return response.ok ? "saved" : "unavailable"
  } catch {
    return "unavailable"
  }
}

export function getBrainAITraceSummary(): BrainAITraceSummary {
  const traces = readRaw()
  const first = traces[0]
  return {
    total: traces.length,
    fastMemory: traces.filter(item => item.route === "FAST_MEMORY").length,
    standardReasoning: traces.filter(item => item.route === "STANDARD_REASONING").length,
    deepCognition: traces.filter(item => item.route === "DEEP_COGNITION").length,
    multimodal: traces.filter(item => item.modalities.length > 1 || item.intent === "multimodal_reasoning").length,
    lastIntent: first?.intent || null,
    lastRoute: first?.route || null,
    lastRunAt: first?.createdAt || null,
  }
}

export function clearBrainAITraceTelemetry() {
  const storage = browserStorage()
  if (!storage) return
  storage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent("eduai:brain-ai-shadow-trace", { detail: null }))
}

export async function clearRemoteBrainAITraceTelemetry() {
  if (typeof window === "undefined") return false
  try {
    const response = await fetch("/api/admin/brain-ai/trace", { method: "DELETE" })
    return response.ok
  } catch {
    return false
  }
}
