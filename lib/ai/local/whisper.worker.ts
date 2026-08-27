import { transcribeWhisperFeatures, type WhisperBackend, type WhisperProgress, type WhisperTask } from "@/lib/ai/local/whisper-transcribe"

type TranscribeMessage = {
  type: "transcribe"
  id: string
  features: ArrayBuffer
  backend: WhisperBackend
  options: {
    maxTokens: number
    language: string
    task: WhisperTask
    includeTimestamps: boolean
    yieldEveryTokens: number
  }
}

type CancelMessage = { type: "cancel"; id: string }
type IncomingMessage = TranscribeMessage | CancelMessage

const controllers = new Map<string, AbortController>()

function post(payload: unknown) {
  self.postMessage(payload)
}

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const message = event.data
  if (message.type === "cancel") {
    controllers.get(message.id)?.abort()
    return
  }

  const controller = new AbortController()
  controllers.set(message.id, controller)
  try {
    const features = new Float32Array(message.features)
    const result = await transcribeWhisperFeatures(features, message.backend, {
      maxTokens: message.options.maxTokens,
      language: message.options.language,
      task: message.options.task,
      includeTimestamps: message.options.includeTimestamps,
      yieldEveryTokens: message.options.yieldEveryTokens,
      signal: controller.signal,
      onProgress: (progress: WhisperProgress) => post({ type: "progress", id: message.id, progress }),
    })
    post({ type: "result", id: message.id, result })
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")
    post({
      type: aborted ? "aborted" : "error",
      id: message.id,
      error: aborted ? "Transcripción cancelada." : error instanceof Error ? error.message : String(error),
    })
  } finally {
    controllers.delete(message.id)
  }
}
