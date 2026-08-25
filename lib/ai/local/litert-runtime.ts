import { EDUAI_LITERT_ESM_URL, EDUAI_LITERT_WASM_URL } from "@/lib/ai/local/litert-models"

export type LiteRTRuntimeHandle = {
  litert: any
  importMs: number
  initMs: number
  totalMs: number
  initializedAt: string
  jspiRequested: boolean
}

export type LiteRTRuntimeLease = LiteRTRuntimeHandle & {
  reused: boolean
  acquireMs: number
}

let cachedRuntime: LiteRTRuntimeHandle | null = null
let runtimePromise: Promise<LiteRTRuntimeHandle> | null = null

function isAlreadyLoadedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return /already\s+(loading|loaded)|loading\s*\/\s*loaded/i.test(message)
}

async function initializeRuntime(): Promise<LiteRTRuntimeHandle> {
  const startedAt = performance.now()
  const importStartedAt = performance.now()
  const litert = await import(/* webpackIgnore: true */ EDUAI_LITERT_ESM_URL)
  const importMs = performance.now() - importStartedAt

  if (typeof litert.loadLiteRt !== "function" || typeof litert.loadAndCompile !== "function" || typeof litert.Tensor !== "function") {
    throw new Error("LiteRT.js cargó, pero no expone la API esperada.")
  }

  const initStartedAt = performance.now()
  try {
    // JSPI es requerido por LiteRT.js para WebNN y habilita partición mixta
    // WebGPU/WASM en navegadores compatibles. En navegadores sin JSPI LiteRT
    // conserva sus rutas soportadas y puede hacer fallback completo a WASM.
    await litert.loadLiteRt(EDUAI_LITERT_WASM_URL, { jspi: true })
  } catch (error) {
    // LiteRT.js no es idempotente en todas las versiones. Si otro panel ya
    // inicializó el runtime en esta misma página, reutilizamos ese estado.
    if (!isAlreadyLoadedError(error)) throw error
  }
  const initMs = performance.now() - initStartedAt

  return {
    litert,
    importMs,
    initMs,
    totalMs: performance.now() - startedAt,
    initializedAt: new Date().toISOString(),
    jspiRequested: true,
  }
}

export async function getLiteRTRuntime(): Promise<LiteRTRuntimeLease> {
  if (typeof window === "undefined") {
    throw new Error("LiteRT.js solo puede inicializarse en el navegador.")
  }

  const acquireStartedAt = performance.now()
  if (cachedRuntime) {
    return {
      ...cachedRuntime,
      reused: true,
      acquireMs: performance.now() - acquireStartedAt,
    }
  }

  const reused = Boolean(runtimePromise)
  if (!runtimePromise) {
    runtimePromise = initializeRuntime()
      .then(runtime => {
        cachedRuntime = runtime
        return runtime
      })
      .catch(error => {
        runtimePromise = null
        cachedRuntime = null
        throw error
      })
  }

  const runtime = await runtimePromise
  return {
    ...runtime,
    reused,
    acquireMs: performance.now() - acquireStartedAt,
  }
}

export function getLiteRTRuntimeStatus() {
  return {
    ready: Boolean(cachedRuntime),
    loading: Boolean(runtimePromise && !cachedRuntime),
    initializedAt: cachedRuntime?.initializedAt || null,
    jspiRequested: cachedRuntime?.jspiRequested || false,
  }
}
