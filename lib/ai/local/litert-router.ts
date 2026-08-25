import type { LiteRTCapabilitySnapshot } from "@/lib/ai/local/litert-capabilities"
import { EDUAI_LITERT_VERSION } from "@/lib/ai/local/litert-models"

export type LiteRTBackend = "webgpu" | "webnn" | "wasm"

export type LiteRTRouteDecision = {
  production: LiteRTBackend
  experimental: LiteRTBackend
  reason: string
  webnnEligible: boolean
  source?: "benchmark" | "capability"
}

export type LiteRTRouteProfile = {
  version: 2
  signature: string
  backend: "webgpu" | "wasm"
  createdAt: string
  modelId: string
  medianEndToEndMs: number
  p95EndToEndMs: number
  alternativeMedianEndToEndMs: number | null
  runtimeVersion: string
}

const ROUTE_PROFILE_KEY = "eduai_litert_route_profile_v2"

function safeWindow() {
  return typeof window !== "undefined" ? window : null
}

export function getLiteRTDeviceSignature(runtimeVersion = EDUAI_LITERT_VERSION) {
  const target = safeWindow()
  if (!target) return `server|${runtimeVersion}`
  const nav = target.navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } }
  const parts = [
    nav.userAgent,
    nav.userAgentData?.platform || nav.platform || "unknown-platform",
    String(nav.hardwareConcurrency || 0),
    String(nav.deviceMemory || 0),
    "gpu" in nav ? "webgpu" : "no-webgpu",
    runtimeVersion,
  ]
  return parts.join("|")
}

export function readLiteRTRouteProfile(runtimeVersion = EDUAI_LITERT_VERSION): LiteRTRouteProfile | null {
  const target = safeWindow()
  if (!target) return null
  try {
    const parsed = JSON.parse(target.localStorage.getItem(ROUTE_PROFILE_KEY) || "null") as LiteRTRouteProfile | null
    if (!parsed || parsed.version !== 2) return null
    if (parsed.runtimeVersion !== runtimeVersion) return null
    if (parsed.signature !== getLiteRTDeviceSignature(runtimeVersion)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveLiteRTRouteProfile(input: Omit<LiteRTRouteProfile, "version" | "signature" | "createdAt" | "runtimeVersion">, runtimeVersion = EDUAI_LITERT_VERSION) {
  const target = safeWindow()
  if (!target) return null
  const profile: LiteRTRouteProfile = {
    ...input,
    version: 2,
    signature: getLiteRTDeviceSignature(runtimeVersion),
    createdAt: new Date().toISOString(),
    runtimeVersion,
  }
  target.localStorage.setItem(ROUTE_PROFILE_KEY, JSON.stringify(profile))
  target.dispatchEvent(new CustomEvent("eduai:litert-route-profile", { detail: profile }))
  return profile
}

export function clearLiteRTRouteProfile() {
  const target = safeWindow()
  if (!target) return
  target.localStorage.removeItem(ROUTE_PROFILE_KEY)
  target.dispatchEvent(new CustomEvent("eduai:litert-route-profile", { detail: null }))
}

export function selectLiteRTRoute(capabilities: LiteRTCapabilitySnapshot): LiteRTRouteDecision {
  const webnnEligible = capabilities.webnnContext && capabilities.jspi
  const persisted = readLiteRTRouteProfile()

  if (persisted?.backend === "webgpu" && capabilities.webgpu) {
    return {
      production: "webgpu",
      experimental: webnnEligible ? "webnn" : "webgpu",
      webnnEligible,
      source: "benchmark",
      reason: `WebGPU fue validado por Benchmark V4 en este dispositivo (${persisted.medianEndToEndMs.toFixed(1)} ms end-to-end mediana).`,
    }
  }

  if (persisted?.backend === "wasm" && capabilities.wasm) {
    return {
      production: "wasm",
      experimental: webnnEligible ? "webnn" : "wasm",
      webnnEligible,
      source: "benchmark",
      reason: `WASM fue validado por Benchmark V4 como la ruta end-to-end más rápida en este dispositivo (${persisted.medianEndToEndMs.toFixed(1)} ms mediana).`,
    }
  }

  if (capabilities.webgpu) {
    return {
      production: "webgpu",
      experimental: webnnEligible ? "webnn" : "webgpu",
      webnnEligible,
      source: "capability",
      reason: webnnEligible
        ? "WebGPU queda como ruta estable; WebNN está disponible solo para pruebas experimentales."
        : "WebGPU ofrece la mejor ruta estable detectada; WASM queda como fallback hasta completar Benchmark V4.",
    }
  }

  if (webnnEligible) {
    return {
      production: "wasm",
      experimental: "webnn",
      webnnEligible: true,
      source: "capability",
      reason: "WebNN está disponible, pero continúa en preview; producción mantiene WASM como fallback estable.",
    }
  }

  return {
    production: "wasm",
    experimental: "wasm",
    webnnEligible: false,
    source: "capability",
    reason: "No hay acelerador web estable detectado; se usa WASM/XNNPack.",
  }
}
