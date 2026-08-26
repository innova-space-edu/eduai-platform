import {
  LiteRTBackendUnsupportedError,
  isDeterministicLiteRTCompatibilityError,
  readLiteRTNegativeCapability,
  rememberLiteRTNegativeCapability,
} from "@/lib/ai/local/litert-negative-cache"
import type { LiteRTBackend } from "@/lib/ai/local/litert-router"

export type LiteRTCompiledModelPoolEntry = {
  key: string
  accelerator: string
  modelId: string | null
  sourceUrl: string
  createdAt: number
  lastUsedAt: number
  reuseCount: number
  rawModel: any
}

export type LiteRTCompiledModelPoolStatus = {
  entries: number
  reuses: number
  keys: string[]
  models: Array<{ modelId: string | null; accelerator: string; reuseCount: number }>
}

const MAX_MODELS = 8
const TTL_MS = 20 * 60 * 1000
const pool = new Map<string, LiteRTCompiledModelPoolEntry>()
const pending = new Map<string, Promise<LiteRTCompiledModelPoolEntry>>()

function keyFor(sourceUrl: string, accelerator: string, modelId?: string | null) {
  return `${modelId || sourceUrl}|${accelerator}`
}

function disposeEntry(entry: LiteRTCompiledModelPoolEntry) {
  try { entry.rawModel?.delete?.() } catch { /* best effort */ }
}

function pruneExpired() {
  const now = Date.now()
  for (const [key, entry] of pool.entries()) {
    if (now - entry.lastUsedAt <= TTL_MS) continue
    pool.delete(key)
    disposeEntry(entry)
  }
}

function trimLRU() {
  if (pool.size <= MAX_MODELS) return
  const candidates = [...pool.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt)
  while (pool.size > MAX_MODELS && candidates.length) {
    const [key, entry] = candidates.shift()!
    if (!pool.has(key)) continue
    pool.delete(key)
    disposeEntry(entry)
  }
}

function lease(entry: LiteRTCompiledModelPoolEntry, reused: boolean) {
  entry.lastUsedAt = Date.now()
  if (reused) entry.reuseCount += 1
  return new Proxy(entry.rawModel, {
    get(target, property, receiver) {
      if (property === "__eduaiPoolReused") return reused
      if (property === "__eduaiPoolKey") return entry.key
      if (property === "__eduaiPoolReuseCount") return entry.reuseCount
      if (property === "__eduaiPoolModelId") return entry.modelId
      // El pool posee el ciclo de vida real del modelo. Los leases conservan
      // delete()/dispose() como no-op para no destruir una instancia compartida.
      if (property === "delete" || property === "dispose") return () => undefined
      const value = Reflect.get(target, property, receiver)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

export async function acquireLiteRTCompiledModel(
  nativeLoadAndCompile: (source: any, options?: any) => Promise<any>,
  source: any,
  options: any = {},
) {
  const modelId = typeof options?.__eduaiModelId === "string" ? options.__eduaiModelId : null
  const accelerator = String(options?.accelerator || "default")
  const nativeOptions = { ...options }
  delete nativeOptions.__eduaiModelId
  delete nativeOptions.__eduaiPrewarm

  if (modelId && ["webgpu", "webnn", "wasm"].includes(accelerator)) {
    const blocked = readLiteRTNegativeCapability(modelId, accelerator as LiteRTBackend)
    if (blocked) throw new LiteRTBackendUnsupportedError(modelId, accelerator as LiteRTBackend, blocked.reason)
  }

  if (typeof source !== "string") {
    try {
      return await nativeLoadAndCompile(source, nativeOptions)
    } catch (error) {
      if (modelId && ["webgpu", "webnn", "wasm"].includes(accelerator) && isDeterministicLiteRTCompatibilityError(error)) {
        const blocked = rememberLiteRTNegativeCapability({ modelId, backend: accelerator as LiteRTBackend, error })
        throw new LiteRTBackendUnsupportedError(modelId, accelerator as LiteRTBackend, blocked?.reason || "Backend no compatible con este modelo.")
      }
      throw error
    }
  }

  pruneExpired()
  const key = keyFor(source, accelerator, modelId)
  const existing = pool.get(key)
  if (existing) return lease(existing, true)

  let inFlight = pending.get(key)
  if (!inFlight) {
    inFlight = nativeLoadAndCompile(source, nativeOptions).then(rawModel => {
      const entry: LiteRTCompiledModelPoolEntry = {
        key,
        accelerator,
        modelId,
        sourceUrl: source,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        reuseCount: 0,
        rawModel,
      }
      pool.set(key, entry)
      pending.delete(key)
      trimLRU()
      return entry
    }).catch(error => {
      pending.delete(key)
      if (modelId && ["webgpu", "webnn", "wasm"].includes(accelerator) && isDeterministicLiteRTCompatibilityError(error)) {
        const blocked = rememberLiteRTNegativeCapability({ modelId, backend: accelerator as LiteRTBackend, error })
        throw new LiteRTBackendUnsupportedError(modelId, accelerator as LiteRTBackend, blocked?.reason || "Backend no compatible con este modelo.")
      }
      throw error
    })
    pending.set(key, inFlight)
  }

  const entry = await inFlight
  const reused = pool.has(key) && entry.reuseCount > 0
  return lease(entry, reused)
}

export function getLiteRTCompiledModelPoolStatus(): LiteRTCompiledModelPoolStatus {
  pruneExpired()
  const entries = [...pool.values()]
  return {
    entries: entries.length,
    reuses: entries.reduce((sum, entry) => sum + entry.reuseCount, 0),
    keys: entries.map(entry => entry.key),
    models: entries.map(entry => ({ modelId: entry.modelId, accelerator: entry.accelerator, reuseCount: entry.reuseCount })),
  }
}

export function clearLiteRTCompiledModelPool() {
  for (const entry of pool.values()) disposeEntry(entry)
  pool.clear()
  pending.clear()
}
