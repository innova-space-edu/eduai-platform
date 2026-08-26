import { getCachedModelSource } from "@/lib/ai/local/litert-model-cache"
import { getLocalAIModel } from "@/lib/ai/local/litert-models"
import { readLiteRTNegativeCapability } from "@/lib/ai/local/litert-negative-cache"
import { readAllLiteRTRouteProfiles } from "@/lib/ai/local/litert-router"
import { getLiteRTRuntime } from "@/lib/ai/local/litert-runtime"

export type LiteRTModelPrewarmStatus = {
  attempted: boolean
  running: boolean
  completedAt: string | null
  warmed: Array<{ modelId: string; backend: string; acquireMs: number; reused: boolean }>
  skipped: Array<{ modelId: string; backend: string; reason: string }>
  error: string | null
}

let status: LiteRTModelPrewarmStatus = {
  attempted: false,
  running: false,
  completedAt: null,
  warmed: [],
  skipped: [],
  error: null,
}

function publish() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("eduai:litert-model-prewarm", { detail: getLiteRTModelPrewarmStatus() }))
  }
}

export function getLiteRTModelPrewarmStatus(): LiteRTModelPrewarmStatus {
  return {
    ...status,
    warmed: [...status.warmed],
    skipped: [...status.skipped],
  }
}

export async function prewarmCalibratedLiteRTModels(options: { maxModels?: number } = {}) {
  if (typeof window === "undefined" || status.running) return getLiteRTModelPrewarmStatus()
  status = { ...status, attempted: true, running: true, error: null }
  publish()

  try {
    const maxModels = Math.max(1, Math.min(4, options.maxModels ?? 2))
    const candidates = readAllLiteRTRouteProfiles()
      .map(profile => ({ profile, model: getLocalAIModel(profile.modelId) }))
      .filter(item => item.model?.runtime === "litertjs" && item.model?.format === ".tflite" && item.model?.status === "ready")
      .sort((a, b) => (a.model?.sizeMB || 0) - (b.model?.sizeMB || 0))
      .slice(0, maxModels)

    const runtime = await getLiteRTRuntime()
    const warmed: LiteRTModelPrewarmStatus["warmed"] = []
    const skipped: LiteRTModelPrewarmStatus["skipped"] = []

    for (const item of candidates) {
      const model = item.model!
      const backend = item.profile.backend
      const blocked = readLiteRTNegativeCapability(model.id, backend)
      if (blocked) {
        skipped.push({ modelId: model.id, backend, reason: blocked.reason })
        continue
      }

      try {
        const source = await getCachedModelSource(model.modelUrl)
        const started = performance.now()
        const compiled = await runtime.litert.loadAndCompile(source.url, {
          accelerator: backend,
          __eduaiModelId: model.id,
          __eduaiPrewarm: true,
        })
        warmed.push({
          modelId: model.id,
          backend,
          acquireMs: performance.now() - started,
          reused: Boolean(compiled?.__eduaiPoolReused),
        })
        compiled?.delete?.()
      } catch (error) {
        skipped.push({
          modelId: model.id,
          backend,
          reason: error instanceof Error ? error.message : "No fue posible precalentar el modelo.",
        })
      }
    }

    status = {
      attempted: true,
      running: false,
      completedAt: new Date().toISOString(),
      warmed,
      skipped,
      error: null,
    }
    publish()
    return getLiteRTModelPrewarmStatus()
  } catch (error) {
    status = {
      ...status,
      running: false,
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error || "Prewarm de modelos falló"),
    }
    publish()
    return getLiteRTModelPrewarmStatus()
  }
}

export function scheduleLiteRTModelPrewarm(options: { timeoutMs?: number; delayMs?: number; maxModels?: number } = {}) {
  if (typeof window === "undefined") return () => undefined
  const target = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  const timeoutMs = options.timeoutMs ?? 4500
  const delayMs = options.delayMs ?? 1500
  let cancelled = false
  let idleId: number | null = null
  let timerId: ReturnType<typeof setTimeout> | null = null

  const run = () => {
    if (cancelled) return
    void prewarmCalibratedLiteRTModels({ maxModels: options.maxModels })
  }

  if (typeof target.requestIdleCallback === "function") idleId = target.requestIdleCallback(run, { timeout: timeoutMs })
  else timerId = setTimeout(run, delayMs)

  return () => {
    cancelled = true
    if (idleId !== null && typeof target.cancelIdleCallback === "function") target.cancelIdleCallback(idleId)
    if (timerId) clearTimeout(timerId)
  }
}
