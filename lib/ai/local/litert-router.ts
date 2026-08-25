import type { LiteRTCapabilitySnapshot } from "@/lib/ai/local/litert-capabilities"

export type LiteRTBackend = "webgpu" | "webnn" | "wasm"

export type LiteRTRouteDecision = {
  production: LiteRTBackend
  experimental: LiteRTBackend
  reason: string
  webnnEligible: boolean
}

export function selectLiteRTRoute(capabilities: LiteRTCapabilitySnapshot): LiteRTRouteDecision {
  const webnnEligible = capabilities.webnnContext && capabilities.jspi

  if (capabilities.webgpu) {
    return {
      production: "webgpu",
      experimental: webnnEligible ? "webnn" : "webgpu",
      webnnEligible,
      reason: webnnEligible
        ? "WebGPU queda como ruta estable; WebNN está disponible solo para pruebas experimentales."
        : "WebGPU ofrece la mejor ruta estable detectada; WASM queda como fallback.",
    }
  }

  if (webnnEligible) {
    return {
      production: "wasm",
      experimental: "webnn",
      webnnEligible: true,
      reason: "WebNN está disponible, pero continúa en preview; producción mantiene WASM como fallback estable.",
    }
  }

  return {
    production: "wasm",
    experimental: "wasm",
    webnnEligible: false,
    reason: "No hay acelerador web estable detectado; se usa WASM/XNNPack.",
  }
}
