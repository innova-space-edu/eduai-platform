import type { LiteRTCapabilitySnapshot } from "@/lib/ai/local/litert-capabilities"
import { DEFAULT_LITERT_PROBE_MODEL_ID, EDUAI_LITERT_VERSION } from "@/lib/ai/local/litert-models"

export type LiteRTBackend = "webgpu" | "webnn" | "wasm"

export type LiteRTRouteDecision = {
  production: LiteRTBackend
  experimental: LiteRTBackend
  reason: string
  webnnEligible: boolean
  source?: "benchmark" | "capability"
  modelId?: string
}

export type LiteRTRouteProfile = {
  version: 3
  signature: string
  backend: "webgpu" | "wasm"
  createdAt: string
  modelId: string
  medianEndToEndMs: number
  p95EndToEndMs: number
  alternativeMedianEndToEndMs: number | null
  runtimeVersion: string
}

type StoredRouteProfilesV3 = {
  version: 3
  signature: string
  runtimeVersion: string
  profiles: Record<string, Omit<LiteRTRouteProfile, "version" | "signature" | "runtimeVersion">>
}

type LegacyRouteProfileV2 = {
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

const ROUTE_PROFILES_KEY = "eduai_litert_route_profiles_v3"
const LEGACY_ROUTE_PROFILE_KEY = "eduai_litert_route_profile_v2"

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

function readStore(runtimeVersion = EDUAI_LITERT_VERSION): StoredRouteProfilesV3 | null {
  const target = safeWindow()
  if (!target) return null
  const signature = getLiteRTDeviceSignature(runtimeVersion)
  try {
    const parsed = JSON.parse(target.localStorage.getItem(ROUTE_PROFILES_KEY) || "null") as StoredRouteProfilesV3 | null
    if (parsed?.version === 3 && parsed.runtimeVersion === runtimeVersion && parsed.signature === signature) return parsed
  } catch { /* ignore corrupt local profile */ }

  // One-time compatibility path for the V2 profile already calibrated in users' browsers.
  try {
    const legacy = JSON.parse(target.localStorage.getItem(LEGACY_ROUTE_PROFILE_KEY) || "null") as LegacyRouteProfileV2 | null
    if (!legacy || legacy.version !== 2 || legacy.runtimeVersion !== runtimeVersion || legacy.signature !== signature) return null
    const migrated: StoredRouteProfilesV3 = {
      version: 3,
      signature,
      runtimeVersion,
      profiles: {
        [legacy.modelId]: {
          backend: legacy.backend,
          createdAt: legacy.createdAt,
          modelId: legacy.modelId,
          medianEndToEndMs: legacy.medianEndToEndMs,
          p95EndToEndMs: legacy.p95EndToEndMs,
          alternativeMedianEndToEndMs: legacy.alternativeMedianEndToEndMs,
        },
      },
    }
    target.localStorage.setItem(ROUTE_PROFILES_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    return null
  }
}

export function readLiteRTRouteProfile(runtimeVersion = EDUAI_LITERT_VERSION, modelId = DEFAULT_LITERT_PROBE_MODEL_ID): LiteRTRouteProfile | null {
  const store = readStore(runtimeVersion)
  const profile = store?.profiles?.[modelId]
  if (!store || !profile) return null
  return { ...profile, version: 3, signature: store.signature, runtimeVersion: store.runtimeVersion }
}

export function readAllLiteRTRouteProfiles(runtimeVersion = EDUAI_LITERT_VERSION): LiteRTRouteProfile[] {
  const store = readStore(runtimeVersion)
  if (!store) return []
  return Object.values(store.profiles).map(profile => ({ ...profile, version: 3, signature: store.signature, runtimeVersion: store.runtimeVersion }))
}

export function saveLiteRTRouteProfile(input: Omit<LiteRTRouteProfile, "version" | "signature" | "createdAt" | "runtimeVersion">, runtimeVersion = EDUAI_LITERT_VERSION) {
  const target = safeWindow()
  if (!target) return null
  const signature = getLiteRTDeviceSignature(runtimeVersion)
  const current = readStore(runtimeVersion)
  const createdAt = new Date().toISOString()
  const profile = { ...input, createdAt }
  const store: StoredRouteProfilesV3 = {
    version: 3,
    signature,
    runtimeVersion,
    profiles: { ...(current?.profiles || {}), [input.modelId]: profile },
  }
  target.localStorage.setItem(ROUTE_PROFILES_KEY, JSON.stringify(store))
  target.localStorage.removeItem(LEGACY_ROUTE_PROFILE_KEY)
  const expanded: LiteRTRouteProfile = { ...profile, version: 3, signature, runtimeVersion }
  target.dispatchEvent(new CustomEvent("eduai:litert-route-profile", { detail: expanded }))
  return expanded
}

export function clearLiteRTRouteProfile(modelId?: string) {
  const target = safeWindow()
  if (!target) return
  if (!modelId) {
    target.localStorage.removeItem(ROUTE_PROFILES_KEY)
    target.localStorage.removeItem(LEGACY_ROUTE_PROFILE_KEY)
    target.dispatchEvent(new CustomEvent("eduai:litert-route-profile", { detail: null }))
    return
  }
  const store = readStore()
  if (!store) return
  const profiles = { ...store.profiles }
  delete profiles[modelId]
  target.localStorage.setItem(ROUTE_PROFILES_KEY, JSON.stringify({ ...store, profiles }))
  target.dispatchEvent(new CustomEvent("eduai:litert-route-profile", { detail: { modelId, deleted: true } }))
}

function resolveLiteRTRoute(capabilities: LiteRTCapabilitySnapshot, modelId: string): LiteRTRouteDecision {
  const webnnEligible = capabilities.webnnContext && capabilities.jspi
  const persisted = readLiteRTRouteProfile(EDUAI_LITERT_VERSION, modelId)

  if (persisted?.backend === "webgpu" && capabilities.webgpu) {
    return {
      production: "webgpu",
      experimental: webnnEligible ? "webnn" : "webgpu",
      webnnEligible,
      source: "benchmark",
      modelId,
      reason: `WebGPU fue validado para ${modelId} (${persisted.medianEndToEndMs.toFixed(1)} ms E2E mediana).`,
    }
  }

  if (persisted?.backend === "wasm" && capabilities.wasm) {
    return {
      production: "wasm",
      experimental: webnnEligible ? "webnn" : "wasm",
      webnnEligible,
      source: "benchmark",
      modelId,
      reason: `WASM fue validado para ${modelId} como la ruta E2E más rápida (${persisted.medianEndToEndMs.toFixed(1)} ms mediana).`,
    }
  }

  if (capabilities.webgpu) {
    return {
      production: "webgpu",
      experimental: webnnEligible ? "webnn" : "webgpu",
      webnnEligible,
      source: "capability",
      modelId,
      reason: webnnEligible
        ? `WebGPU queda como ruta estable inicial para ${modelId}; WebNN se mantiene experimental.`
        : `WebGPU queda como ruta estable inicial para ${modelId}; WASM permanece como fallback hasta calibrarlo.`,
    }
  }

  if (webnnEligible) {
    return {
      production: "wasm",
      experimental: "webnn",
      webnnEligible: true,
      source: "capability",
      modelId,
      reason: `WebNN está disponible para ${modelId}, pero producción mantiene WASM hasta una calibración específica.`,
    }
  }

  return {
    production: "wasm",
    experimental: "wasm",
    webnnEligible: false,
    source: "capability",
    modelId,
    reason: `No hay acelerador web estable calibrado para ${modelId}; se usa WASM/XNNPack.`,
  }
}

export function selectLiteRTRoute(capabilities: LiteRTCapabilitySnapshot, modelId = DEFAULT_LITERT_PROBE_MODEL_ID): LiteRTRouteDecision {
  return {
    get production() { return resolveLiteRTRoute(capabilities, modelId).production },
    get experimental() { return resolveLiteRTRoute(capabilities, modelId).experimental },
    get reason() { return resolveLiteRTRoute(capabilities, modelId).reason },
    get webnnEligible() { return resolveLiteRTRoute(capabilities, modelId).webnnEligible },
    get source() { return resolveLiteRTRoute(capabilities, modelId).source },
    get modelId() { return modelId },
  }
}
