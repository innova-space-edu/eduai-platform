const CACHE_NAME = "eduai-litert-models-v1"

export type CachedModelSource = {
  url: string
  cacheHit: boolean
  byteLength: number | null
  source: "cache" | "network" | "direct"
  cleanup: () => void
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
      return { url: modelUrl, cacheHit, byteLength: null, source: "direct", cleanup: () => undefined }
    }

    const objectUrl = URL.createObjectURL(blob)
    return {
      url: objectUrl,
      cacheHit,
      byteLength: blob.size,
      source: cacheHit ? "cache" : "network",
      cleanup: () => URL.revokeObjectURL(objectUrl),
    }
  } catch {
    return { url: modelUrl, cacheHit: false, byteLength: null, source: "direct", cleanup: () => undefined }
  }
}

export async function clearLiteRTModelCache() {
  if (typeof window === "undefined" || !("caches" in window)) return false
  return caches.delete(CACHE_NAME)
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
