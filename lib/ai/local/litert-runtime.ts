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
let prewarmAttempted = false
let prewarmCompletedAt: string | null = null
let prewarmError: string | null = null

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
    await litert.loadLiteRt(EDUAI_LITERT_WASM_URL, { jspi: true })
  } catch (error) {
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

export function scheduleLiteRTPrewarm(options: { timeoutMs?: number; delayMs?: number } = {}) {
  if (typeof window === "undefined") return () => undefined
  const target = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  const timeoutMs = options.timeoutMs ?? 2500
  const delayMs = options.delayMs ?? 700
  let cancelled = false
  let idleId: number | null = null
  let timerId: ReturnType<typeof setTimeout> | null = null

  const run = () => {
    if (cancelled || cachedRuntime || runtimePromise) return
    prewarmAttempted = true
    void getLiteRTRuntime()
      .then(() => {
        prewarmCompletedAt = new Date().toISOString()
        prewarmError = null
      })
      .catch(error => {
        prewarmError = error instanceof Error ? error.message : String(error || "Prewarm falló")
      })
  }

  if (typeof target.requestIdleCallback === "function") {
    idleId = target.requestIdleCallback(run, { timeout: timeoutMs })
  } else {
    timerId = setTimeout(run, delayMs)
  }

  return () => {
    cancelled = true
    if (idleId !== null && typeof target.cancelIdleCallback === "function") target.cancelIdleCallback(idleId)
    if (timerId) clearTimeout(timerId)
  }
}

export function getLiteRTRuntimeStatus() {
  return {
    ready: Boolean(cachedRuntime),
    loading: Boolean(runtimePromise && !cachedRuntime),
    initializedAt: cachedRuntime?.initializedAt || null,
    jspiRequested: cachedRuntime?.jspiRequested || false,
    prewarmAttempted,
    prewarmCompletedAt,
    prewarmError,
  }
}
