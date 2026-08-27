import { transcribeWhisperFeatures, type WhisperBackend, type WhisperProgress, type WhisperTask, type WhisperTranscriptionResult } from "@/lib/ai/local/whisper-transcribe"

type WorkerOptions = {
  maxTokens: number
  language: string
  task: WhisperTask
  includeTimestamps: boolean
  signal?: AbortSignal
  yieldEveryTokens?: number
  onProgress?: (progress: WhisperProgress) => void
}

type PendingRequest = {
  resolve: (result: WhisperTranscriptionResult) => void
  reject: (error: Error) => void
  onProgress?: (progress: WhisperProgress) => void
  cleanup: () => void
}

let worker: Worker | null = null
const pending = new Map<string, PendingRequest>()
let requestCounter = 0

function createAbortError() {
  return new DOMException("Transcripción cancelada.", "AbortError")
}

function resetWorker(error: Error) {
  const current = worker
  worker = null
  current?.terminate()
  for (const request of pending.values()) {
    request.cleanup()
    request.reject(error)
  }
  pending.clear()
}

function getWorker() {
  if (worker) return worker
  if (typeof Worker === "undefined") return null

  const instance = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" })
  instance.onmessage = (event: MessageEvent<any>) => {
    const message = event.data
    const request = pending.get(message?.id)
    if (!request) return

    if (message.type === "progress") {
      request.onProgress?.(message.progress as WhisperProgress)
      return
    }

    request.cleanup()
    pending.delete(message.id)
    if (message.type === "result") request.resolve(message.result as WhisperTranscriptionResult)
    else if (message.type === "aborted") request.reject(createAbortError())
    else request.reject(new Error(message.error || "Whisper Worker falló."))
  }
  instance.onerror = event => resetWorker(new Error(event.message || "Whisper Worker se interrumpió."))
  worker = instance
  return instance
}

export async function transcribeWhisperFeaturesWorker(
  features: Float32Array,
  backend: WhisperBackend,
  options: WorkerOptions,
): Promise<WhisperTranscriptionResult> {
  const instance = getWorker()
  if (!instance) {
    return transcribeWhisperFeatures(features, backend, {
      maxTokens: options.maxTokens,
      language: options.language,
      task: options.task,
      includeTimestamps: options.includeTimestamps,
      signal: options.signal,
      yieldEveryTokens: options.yieldEveryTokens ?? 1,
      onProgress: options.onProgress,
    })
  }

  if (options.signal?.aborted) throw createAbortError()
  const id = `whisper-${Date.now()}-${++requestCounter}`
  const transferable = features.slice().buffer

  return new Promise<WhisperTranscriptionResult>((resolve, reject) => {
    const onAbort = () => {
      instance.postMessage({ type: "cancel", id })
      const request = pending.get(id)
      if (!request) return
      request.cleanup()
      pending.delete(id)
      reject(createAbortError())
    }
    const cleanup = () => options.signal?.removeEventListener("abort", onAbort)
    pending.set(id, { resolve, reject, onProgress: options.onProgress, cleanup })
    options.signal?.addEventListener("abort", onAbort, { once: true })
    instance.postMessage({
      type: "transcribe",
      id,
      features: transferable,
      backend,
      options: {
        maxTokens: options.maxTokens,
        language: options.language,
        task: options.task,
        includeTimestamps: options.includeTimestamps,
        yieldEveryTokens: options.yieldEveryTokens ?? 1,
      },
    }, [transferable])
  })
}

export function disposeWhisperWorker() {
  resetWorker(new Error("Whisper Worker reiniciado."))
}
