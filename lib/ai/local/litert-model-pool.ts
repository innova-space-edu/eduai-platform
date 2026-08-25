export type LiteRTCompiledModelPoolEntry = {
  key: string
  accelerator: string
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
}

const MAX_MODELS = 8
const TTL_MS = 20 * 60 * 1000
const pool = new Map<string, LiteRTCompiledModelPoolEntry>()
const pending = new Map<string, Promise<LiteRTCompiledModelPoolEntry>>()

function keyFor(sourceUrl: string, accelerator: string) {
  return `${accelerator}|${sourceUrl}`
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
      // Components historically call delete() after each local experiment. The
      // pool owns the real lifetime, so leases intentionally make delete a no-op.
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
  if (typeof source !== "string") {
    const model = await nativeLoadAndCompile(source, options)
    return model
  }

  pruneExpired()
  const accelerator = String(options?.accelerator || "default")
  const key = keyFor(source, accelerator)
  const existing = pool.get(key)
  if (existing) return lease(existing, true)

  let inFlight = pending.get(key)
  if (!inFlight) {
    inFlight = nativeLoadAndCompile(source, options).then(rawModel => {
      const entry: LiteRTCompiledModelPoolEntry = {
        key,
        accelerator,
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
  }
}

export function clearLiteRTCompiledModelPool() {
  for (const entry of pool.values()) disposeEntry(entry)
  pool.clear()
  pending.clear()
}
