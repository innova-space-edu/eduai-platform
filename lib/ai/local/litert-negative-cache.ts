import { EDUAI_LITERT_VERSION } from "@/lib/ai/local/litert-models"
import { getLiteRTDeviceSignature, type LiteRTBackend } from "@/lib/ai/local/litert-router"

export type LiteRTNegativeCapability = {
  version: 1
  signature: string
  runtimeVersion: string
  modelId: string
  backend: LiteRTBackend
  reason: string
  failures: number
  firstSeenAt: string
  lastSeenAt: string
  expiresAt: string
}

type Store = {
  version: 1
  signature: string
  runtimeVersion: string
  entries: Record<string, Omit<LiteRTNegativeCapability, "version" | "signature" | "runtimeVersion">>
}

const STORAGE_KEY = "eduai_litert_negative_capabilities_v1"
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

function targetWindow() {
  return typeof window !== "undefined" ? window : null
}

function keyFor(modelId: string, backend: LiteRTBackend) {
  return `${modelId}|${backend}`
}

function friendlyReason(error: unknown, backend: LiteRTBackend) {
  const raw = error instanceof Error ? error.message : String(error || "")
  if (/third_party\/odml|litert_web|compiled_model|delegate|unsupported|not supported|unimplemented/i.test(raw)) {
    return `${backend.toUpperCase()} no es compatible con este modelo en el runtime/dispositivo actual.`
  }
  return `No fue posible preparar este modelo con ${backend.toUpperCase()} en el dispositivo actual.`
}

function readStore(runtimeVersion = EDUAI_LITERT_VERSION): Store {
  const target = targetWindow()
  const signature = getLiteRTDeviceSignature(runtimeVersion)
  const empty: Store = { version: 1, signature, runtimeVersion, entries: {} }
  if (!target) return empty
  try {
    const parsed = JSON.parse(target.localStorage.getItem(STORAGE_KEY) || "null") as Store | null
    if (!parsed || parsed.version !== 1 || parsed.signature !== signature || parsed.runtimeVersion !== runtimeVersion) return empty
    return parsed
  } catch {
    return empty
  }
}

function persist(store: Store) {
  const target = targetWindow()
  if (!target) return
  target.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  target.dispatchEvent(new CustomEvent("eduai:litert-negative-capability", { detail: getAllLiteRTNegativeCapabilities() }))
}

function prune(store: Store) {
  const now = Date.now()
  let changed = false
  const entries = { ...store.entries }
  for (const [key, entry] of Object.entries(entries)) {
    if (new Date(entry.expiresAt).getTime() > now) continue
    delete entries[key]
    changed = true
  }
  const next = changed ? { ...store, entries } : store
  if (changed) persist(next)
  return next
}

export function isDeterministicLiteRTCompatibilityError(error: unknown) {
  const raw = error instanceof Error ? `${error.message}\n${error.stack || ""}` : String(error || "")
  return /third_party\/odml|litert_web|compiled_model|delegate.*(fail|error)|unsupported|not supported|unimplemented|accelerator.*(fail|error)/i.test(raw)
}

export function readLiteRTNegativeCapability(modelId: string, backend: LiteRTBackend) {
  const store = prune(readStore())
  const entry = store.entries[keyFor(modelId, backend)]
  if (!entry) return null
  return { ...entry, version: 1 as const, signature: store.signature, runtimeVersion: store.runtimeVersion }
}

export function getAllLiteRTNegativeCapabilities() {
  const store = prune(readStore())
  return Object.values(store.entries).map(entry => ({ ...entry, version: 1 as const, signature: store.signature, runtimeVersion: store.runtimeVersion }))
}

export function rememberLiteRTNegativeCapability(input: { modelId: string; backend: LiteRTBackend; error: unknown; ttlMs?: number }) {
  const target = targetWindow()
  if (!target) return null
  const store = prune(readStore())
  const key = keyFor(input.modelId, input.backend)
  const previous = store.entries[key]
  const now = new Date()
  const next = {
    modelId: input.modelId,
    backend: input.backend,
    reason: friendlyReason(input.error, input.backend),
    failures: Number(previous?.failures || 0) + 1,
    firstSeenAt: previous?.firstSeenAt || now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString(),
  }
  const updated: Store = { ...store, entries: { ...store.entries, [key]: next } }
  persist(updated)
  return { ...next, version: 1 as const, signature: updated.signature, runtimeVersion: updated.runtimeVersion }
}

export function clearLiteRTNegativeCapability(modelId?: string, backend?: LiteRTBackend) {
  const target = targetWindow()
  if (!target) return
  if (!modelId) {
    target.localStorage.removeItem(STORAGE_KEY)
    target.dispatchEvent(new CustomEvent("eduai:litert-negative-capability", { detail: [] }))
    return
  }
  const store = readStore()
  const entries = { ...store.entries }
  if (backend) delete entries[keyFor(modelId, backend)]
  else for (const key of Object.keys(entries)) if (key.startsWith(`${modelId}|`)) delete entries[key]
  persist({ ...store, entries })
}

export class LiteRTBackendUnsupportedError extends Error {
  code = "EDUAI_LITERT_BACKEND_UNSUPPORTED"
  constructor(public readonly modelId: string, public readonly backend: LiteRTBackend, reason: string) {
    super(reason)
    this.name = "LiteRTBackendUnsupportedError"
  }
}
