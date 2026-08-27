import {
  decodeWhisperAudio,
  prepareWhisperDecodedSegment,
  WHISPER_MAX_SECONDS,
  type WhisperAudioFeatures,
} from "@/lib/ai/local/whisper-audio"
import {
  transcribeWhisperFeatures,
  type WhisperBackend,
  type WhisperProgress,
  type WhisperTask,
  type WhisperTranscriptionResult,
} from "@/lib/ai/local/whisper-transcribe"

export const WHISPER_LONGFORM_OVERLAP_SECONDS = 3

export type WhisperLongFormChunk = {
  index: number
  startSeconds: number
  endSeconds: number
  features: WhisperAudioFeatures
  result: WhisperTranscriptionResult
  globalTimestampTokens: string[]
}

export type WhisperLongFormProgress = {
  phase: "decode" | "features" | "model" | "merge"
  chunkIndex: number
  chunkCount: number
  startSeconds?: number
  endSeconds?: number
  modelProgress?: WhisperProgress
}

export type WhisperLongFormResult = {
  text: string
  rawText: string
  chunks: WhisperLongFormChunk[]
  backend: WhisperBackend
  language: string
  languageConfidence: number
  languageSource: "auto" | "manual"
  task: WhisperTask
  sourceDurationSeconds: number
  overlapSeconds: number
  totalMs: number
  decodeMs: number
  featureMs: number
  acquireMs: number
  encodeMs: number
  languageDetectionMs: number
  decodeWallMs: number
  tokenizerMs: number
  modelEndToEndMs: number
  decodedTokens: number
  tokensPerSecond: number
  msPerToken: number
  realTimeFactor: number
  timestampTokens: string[]
  modelReused: boolean
  cacheHit: boolean
  cacheSource: "cache" | "network" | "direct"
}

type WhisperLongFormOptions = {
  backend: WhisperBackend
  language?: string
  task?: WhisperTask
  overlapSeconds?: number
  maxTokensPerChunk?: number
  signal?: AbortSignal
  onProgress?: (progress: WhisperLongFormProgress) => void
}

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Transcripción cancelada.", "AbortError")
}

function buildChunkStarts(durationSeconds: number, overlapSeconds: number) {
  if (durationSeconds <= WHISPER_MAX_SECONDS) return [0]
  const step = Math.max(1, WHISPER_MAX_SECONDS - overlapSeconds)
  const starts: number[] = []
  for (let start = 0; start < durationSeconds; start += step) {
    starts.push(start)
    if (start + WHISPER_MAX_SECONDS >= durationSeconds) break
  }
  return starts
}

function normalizedWord(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

function mergeOverlappingText(previous: string, next: string) {
  const left = previous.trim()
  const right = next.trim()
  if (!left) return right
  if (!right) return left
  const leftWords = left.split(/\s+/)
  const rightWords = right.split(/\s+/)
  const maxOverlap = Math.min(24, leftWords.length, rightWords.length)

  for (let size = maxOverlap; size >= 2; size -= 1) {
    const leftSlice = leftWords.slice(-size).map(normalizedWord)
    const rightSlice = rightWords.slice(0, size).map(normalizedWord)
    if (leftSlice.every((word, index) => word && word === rightSlice[index])) {
      return [...leftWords, ...rightWords.slice(size)].join(" ").trim()
    }
  }

  return `${left} ${right}`.replace(/\s+/g, " ").trim()
}

function offsetTimestamp(token: string, offsetSeconds: number) {
  const match = token.match(/^<\|(\d+(?:\.\d+)?)\|>$/)
  if (!match) return token
  return `<|${(Number(match[1]) + offsetSeconds).toFixed(2)}|>`
}

export async function transcribeWhisperLongForm(
  blob: Blob,
  options: WhisperLongFormOptions,
): Promise<WhisperLongFormResult> {
  const started = performance.now()
  const overlapSeconds = Math.min(10, Math.max(0, options.overlapSeconds ?? WHISPER_LONGFORM_OVERLAP_SECONDS))
  const requestedLanguage = options.language || "auto"
  const task = options.task || "transcribe"
  abortIfNeeded(options.signal)
  options.onProgress?.({ phase: "decode", chunkIndex: 0, chunkCount: 1 })
  const decoded = await decodeWhisperAudio(blob)
  abortIfNeeded(options.signal)

  const starts = buildChunkStarts(decoded.sourceDurationSeconds, overlapSeconds)
  const chunks: WhisperLongFormChunk[] = []
  let mergedText = ""
  let resolvedLanguage = requestedLanguage
  let languageConfidence = requestedLanguage === "auto" ? 0 : 1
  let featureMs = 0

  for (let index = 0; index < starts.length; index += 1) {
    abortIfNeeded(options.signal)
    const startSeconds = starts[index]
    options.onProgress?.({
      phase: "features",
      chunkIndex: index,
      chunkCount: starts.length,
      startSeconds,
      endSeconds: Math.min(decoded.sourceDurationSeconds, startSeconds + WHISPER_MAX_SECONDS),
    })
    const features = prepareWhisperDecodedSegment(decoded, { segmentStartSeconds: startSeconds })
    featureMs += features.featureMs
    abortIfNeeded(options.signal)

    const languageForChunk = resolvedLanguage === "auto" ? "auto" : resolvedLanguage
    const result = await transcribeWhisperFeatures(features.features, options.backend, {
      maxTokens: options.maxTokensPerChunk ?? 192,
      language: languageForChunk,
      task,
      includeTimestamps: true,
      signal: options.signal,
      yieldEveryTokens: 1,
      onProgress: modelProgress => options.onProgress?.({
        phase: "model",
        chunkIndex: index,
        chunkCount: starts.length,
        startSeconds: features.segmentStartSeconds,
        endSeconds: features.segmentEndSeconds,
        modelProgress,
      }),
    })

    if (resolvedLanguage === "auto" && result.text.trim()) {
      resolvedLanguage = result.language
      languageConfidence = result.languageConfidence
    }

    const globalTimestampTokens = result.timestampTokens.map(token => offsetTimestamp(token, features.segmentStartSeconds))
    chunks.push({
      index,
      startSeconds: features.segmentStartSeconds,
      endSeconds: features.segmentEndSeconds,
      features,
      result,
      globalTimestampTokens,
    })
    mergedText = mergeOverlappingText(mergedText, result.text)
  }

  options.onProgress?.({ phase: "merge", chunkIndex: starts.length, chunkCount: starts.length })
  const totalMs = performance.now() - started
  const decodedTokens = chunks.reduce((sum, chunk) => sum + chunk.result.decodedTokens, 0)
  const decodeWallMs = chunks.reduce((sum, chunk) => sum + chunk.result.decodeWallMs, 0)
  const modelEndToEndMs = chunks.reduce((sum, chunk) => sum + chunk.result.modelEndToEndMs, 0)
  const timestampTokens = chunks.flatMap(chunk => chunk.globalTimestampTokens)
  const first = chunks[0]?.result
  const finalLanguage = resolvedLanguage === "auto" ? first?.language || "en" : resolvedLanguage
  const finalConfidence = requestedLanguage === "auto" ? languageConfidence || first?.languageConfidence || 0 : 1

  return {
    text: mergedText,
    rawText: chunks.map(chunk => chunk.result.rawText).join("\n"),
    chunks,
    backend: options.backend,
    language: finalLanguage,
    languageConfidence: finalConfidence,
    languageSource: requestedLanguage === "auto" ? "auto" : "manual",
    task,
    sourceDurationSeconds: decoded.sourceDurationSeconds,
    overlapSeconds,
    totalMs,
    decodeMs: decoded.decodeMs,
    featureMs,
    acquireMs: chunks.reduce((sum, chunk) => sum + chunk.result.acquireMs, 0),
    encodeMs: chunks.reduce((sum, chunk) => sum + chunk.result.encodeMs, 0),
    languageDetectionMs: chunks.reduce((sum, chunk) => sum + chunk.result.languageDetectionMs, 0),
    decodeWallMs,
    tokenizerMs: chunks.reduce((sum, chunk) => sum + chunk.result.tokenizerMs, 0),
    modelEndToEndMs,
    decodedTokens,
    tokensPerSecond: decodedTokens ? decodedTokens / (Math.max(1, decodeWallMs) / 1000) : 0,
    msPerToken: decodedTokens ? decodeWallMs / decodedTokens : 0,
    realTimeFactor: decoded.sourceDurationSeconds > 0 ? totalMs / 1000 / decoded.sourceDurationSeconds : 0,
    timestampTokens,
    modelReused: chunks.every(chunk => chunk.result.modelReused),
    cacheHit: chunks.every(chunk => chunk.result.cacheHit),
    cacheSource: chunks.every(chunk => chunk.result.cacheSource === "cache") ? "cache" : first?.cacheSource || "direct",
  }
}
