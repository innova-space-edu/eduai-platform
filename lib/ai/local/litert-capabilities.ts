export type WebNNProbeStatus = "available" | "api-missing" | "context-failed" | "insecure-context" | "not-tested"

export type LiteRTCapabilitySnapshot = {
  secureContext: boolean
  chromium: boolean
  webgpu: boolean
  wasm: boolean
  jspi: boolean
  webnnApi: boolean
  webnnContext: boolean
  webnnStatus: WebNNProbeStatus
  webnnError?: string
}

type WebNNLike = {
  createContext?: (options?: { powerPreference?: "default" | "high-performance" | "low-power"; accelerated?: boolean }) => Promise<{ destroy?: () => void }>
}

function hasJSPI() {
  const wasm = WebAssembly as typeof WebAssembly & {
    Suspending?: unknown
    promising?: unknown
  }
  return typeof wasm.Suspending === "function" && typeof wasm.promising === "function"
}

export async function probeLiteRTCapabilities(): Promise<LiteRTCapabilitySnapshot> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      secureContext: false,
      chromium: false,
      webgpu: false,
      wasm: false,
      jspi: false,
      webnnApi: false,
      webnnContext: false,
      webnnStatus: "not-tested",
    }
  }

  const secureContext = window.isSecureContext
  const userAgent = navigator.userAgent || ""
  const chromium = /Chrome\//.test(userAgent) || /Edg\//.test(userAgent) || /Chromium\//.test(userAgent)
  const webgpu = "gpu" in navigator
  const wasm = typeof WebAssembly !== "undefined"
  const jspi = wasm ? hasJSPI() : false
  const ml = (navigator as Navigator & { ml?: WebNNLike }).ml
  const webnnApi = Boolean(ml && typeof ml.createContext === "function")

  if (!secureContext) {
    return { secureContext, chromium, webgpu, wasm, jspi, webnnApi, webnnContext: false, webnnStatus: "insecure-context" }
  }

  if (!webnnApi || !ml?.createContext) {
    return { secureContext, chromium, webgpu, wasm, jspi, webnnApi: false, webnnContext: false, webnnStatus: "api-missing" }
  }

  try {
    const context = await ml.createContext({ powerPreference: "high-performance", accelerated: true })
    context?.destroy?.()
    return { secureContext, chromium, webgpu, wasm, jspi, webnnApi: true, webnnContext: true, webnnStatus: "available" }
  } catch (error) {
    return {
      secureContext,
      chromium,
      webgpu,
      wasm,
      jspi,
      webnnApi: true,
      webnnContext: false,
      webnnStatus: "context-failed",
      webnnError: error instanceof Error ? error.message : String(error || "WebNN context failed"),
    }
  }
}

export function explainWebNNStatus(snapshot: LiteRTCapabilitySnapshot | null) {
  if (!snapshot) return "Sin diagnóstico"
  if (snapshot.webnnStatus === "available") return "API + contexto disponibles"
  if (snapshot.webnnStatus === "insecure-context") return "Requiere HTTPS / contexto seguro"
  if (snapshot.webnnStatus === "context-failed") return "API visible, contexto no disponible"
  if (snapshot.webnnStatus === "api-missing") return "El navegador no expone navigator.ml"
  return "No probado"
}
