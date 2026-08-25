const CACHE_NAME = "eduai-litert-models-v1"
const CACHE_ANALYTICS_KEY = "eduai_litert_cache_analytics_v1"

export type CachedModelSource = {
  url: string
  cacheHit: boolean
  byteLength: number | null
  source: "cache" | "network" | "direct"
  cleanup: () => void
}

export type LiteRTCacheAnalytics = {
  requests: number
  hits: number
  misses: number
  networkBytes: number
  lastSource: "cache" | "network" | "direct" | null
  lastAccessAt: string | null
  hitRate: number
}

function emptyAnalytics(): LiteRTCacheAnalytics {
  return { requests: 0, hits: 0, misses: 0, networkBytes: 0, lastSource: null, lastAccessAt: null, hitRate: 0 }
}

function readAnalyticsRaw() {
  if (typeof window === "undefined") return emptyAnalytics()
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_ANALYTICS_KEY) || "null") as Partial<LiteRTCacheAnalytics> | null
    if (!parsed) return emptyAnalytics()
    const requests = Number(parsed.requests || 0)
    const hits = Number(parsed.hits || 0)
    const misses = Number(parsed.misses || 0)
    return {
      requests,
      hits,
      misses,
      networkBytes: Number(parsed.networkBytes || 0),
      lastSource: parsed.lastSource || null,
      lastAccessAt: parsed.lastAccessAt || null,
      hitRate: requests > 0 ? (hits / requests) * 100 : 0,
    }
  } catch {
    return emptyAnalytics()
  }
}

function recordCacheAccess(source: "cache" | "network" | "direct", byteLength: number | null) {
  if (typeof window === "undefined") return
  const current = readAnalyticsRaw()
  const requests = current.requests + 1
  const hits = current.hits + (source === "cache" ? 1 : 0)
  const misses = current.misses + (source === "cache" ? 0 : 1)
  const next: LiteRTCacheAnalytics = {
    requests,
    hits,
    misses,
    networkBytes: current.networkBytes + (source === "network" ? Number(byteLength || 0) : 0),
    lastSource: source,
    lastAccessAt: new Date().toISOString(),
    hitRate: requests > 0 ? (hits / requests) * 100 : 0,
  }
  localStorage.setItem(CACHE_ANALYTICS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent("eduai:litert-cache-analytics", { detail: next }))
}

export async function getCachedModelSource(modelUrl: string): Promise<CachedModelSource> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return { url: modelUrl, cacheHit: false, byteLength: null, source: "direct", cleanup: () => undefined }
  }

  try {
    const cache = await caches.open(CACHE_NAME)
    let response = await cache.match(modelUrl)
    let cacheHit = Boolean(response)

    if (!response) {
      const fetched = await fetch(modelUrl, { mode: "cors", cache: "no-cache" })
      if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`)
      await cache.put(modelUrl, fetched.clone())
      response = fetched
      cacheHit = false
    }

    const blob = await response.blob()
    if (!blob.size) {
      recordCacheAccess("direct", null)
      return { url: modelUrl, cacheHit, byteLength: null, source: "direct", cleanup: () => undefined }
    }

    const source = cacheHit ? "cache" : "network"
    recordCacheAccess(source, blob.size)
    const objectUrl = URL.createObjectURL(blob)
    return {
      url: objectUrl,
      cacheHit,
      byteLength: blob.size,
      source,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    }
  } catch {
    recordCacheAccess("direct", null)
    return { url: modelUrl, cacheHit: false, byteLength: null, source: "direct", cleanup: () => undefined }
  }
}

export async function precacheLiteRTModel(modelUrl: string) {
  const source = await getCachedModelSource(modelUrl)
  const result = { source: source.source, cacheHit: source.cacheHit, byteLength: source.byteLength }
  source.cleanup()
  return result
}

export async function clearLiteRTModelCache() {
  if (typeof window === "undefined" || !("caches" in window)) return false
  const deleted = await caches.delete(CACHE_NAME)
  localStorage.removeItem(CACHE_ANALYTICS_KEY)
  window.dispatchEvent(new CustomEvent("eduai:litert-cache-analytics", { detail: emptyAnalytics() }))
  return deleted
}

export function getLiteRTModelCacheAnalytics() {
  return readAnalyticsRaw()
}

export async function getLiteRTModelCacheSize() {
  if (typeof window === "undefined" || !("caches" in window)) return { entries: 0, bytes: 0 }
  try {
    const cache = await caches.open(CACHE_NAME)
    const requests = await cache.keys()
    let bytes = 0
    for (const request of requests) {
      const response = await cache.match(request)
      if (!response) continue
      const blob = await response.clone().blob()
      bytes += blob.size
    }
    return { entries: requests.length, bytes }
  } catch {
    return { entries: 0, bytes: 0 }
  }
}
