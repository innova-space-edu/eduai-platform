import {
  decodeWhisperAudio,
  prepareWhisperDecodedSegment,
  WHISPER_MAX_SECONDS,
  WHISPER_SAMPLE_RATE,
  type WhisperAudioFeatures,
  type WhisperDecodedAudio,
} from "@/lib/ai/local/whisper-audio"
import {
  transcribeWhisperFeatures,
  type WhisperBackend,
  type WhisperProgress,
  type WhisperTask,
  type WhisperTranscriptionResult,
} from "@/lib/ai/local/whisper-transcribe"

export const WHISPER_LONGFORM_OVERLAP_SECONDS = 3
export const WHISPER_LONGFORM_QUALITY_VERSION = "v1.4"
const SILENCE_SEARCH_SECONDS = 2.25
const SILENCE_WINDOW_SECONDS = 0.22
const MIN_CHUNK_ADVANCE_SECONDS = 18
const MAX_FUZZY_WORDS = 28

export type WhisperLongFormChunk = {
  index: number
  startSeconds: number
  endSeconds: number
  plannedStartSeconds: number
  silenceAdjustmentSeconds: number
  boundaryRms: number
  features: WhisperAudioFeatures
  result: WhisperTranscriptionResult
  globalTimestampTokens: string[]
}

export type WhisperLongFormProgress = {
  phase: "decode" | "segment" | "features" | "model" | "merge"
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
  qualityVersion: string
  boundaryStrategy: "silence-aware"
  mergeStrategy: "fuzzy-token-overlap"
}

export type WhisperFeatureRunnerOptions = {
  maxTokens: number
  language: string
  task: WhisperTask
  includeTimestamps: boolean
  signal?: AbortSignal
  yieldEveryTokens: number
  onProgress?: (progress: WhisperProgress) => void
}

export type WhisperFeatureRunner = (
  features: Float32Array,
  backend: WhisperBackend,
  options: WhisperFeatureRunnerOptions,
) => Promise<WhisperTranscriptionResult>

type WhisperLongFormOptions = {
  backend: WhisperBackend
  language?: string
  task?: WhisperTask
  overlapSeconds?: number
  maxTokensPerChunk?: number
  signal?: AbortSignal
  onProgress?: (progress: WhisperLongFormProgress) => void
  transcribeFeatures?: WhisperFeatureRunner
}

type ChunkPlan = {
  startSeconds: number
  plannedStartSeconds: number
  silenceAdjustmentSeconds: number
  boundaryRms: number
}

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Transcripción cancelada.", "AbortError")
}

function rmsWindow(waveform: Float32Array, centerSeconds: number) {
  const halfSamples = Math.max(1, Math.round((SILENCE_WINDOW_SECONDS * WHISPER_SAMPLE_RATE) / 2))
  const center = Math.round(centerSeconds * WHISPER_SAMPLE_RATE)
  const start = Math.max(0, center - halfSamples)
  const end = Math.min(waveform.length, center + halfSamples)
  if (end <= start) return Number.POSITIVE_INFINITY
  let energy = 0
  for (let index = start; index < end; index += 1) {
    const value = waveform[index]
    energy += value * value
  }
  return Math.sqrt(energy / Math.max(1, end - start))
}

function findQuietStart(decoded: WhisperDecodedAudio, plannedStartSeconds: number, previousStartSeconds: number) {
  const duration = decoded.sourceDurationSeconds
  const lower = Math.max(
    previousStartSeconds + MIN_CHUNK_ADVANCE_SECONDS,
    plannedStartSeconds - SILENCE_SEARCH_SECONDS,
  )
  const upper = Math.min(duration, plannedStartSeconds + SILENCE_SEARCH_SECONDS)
  if (upper <= lower) {
    return { startSeconds: plannedStartSeconds, rms: rmsWindow(decoded.waveform, plannedStartSeconds) }
  }

  let bestSeconds = plannedStartSeconds
  let bestRms = Number.POSITIVE_INFINITY
  const step = 0.1
  for (let seconds = lower; seconds <= upper; seconds += step) {
    const rms = rmsWindow(decoded.waveform, seconds)
    const distancePenalty = Math.abs(seconds - plannedStartSeconds) * 0.002
    const score = rms + distancePenalty
    if (score < bestRms) {
      bestRms = score
      bestSeconds = seconds
    }
  }
  return { startSeconds: Math.max(0, Math.min(duration, bestSeconds)), rms: rmsWindow(decoded.waveform, bestSeconds) }
}

function buildChunkPlan(decoded: WhisperDecodedAudio, overlapSeconds: number): ChunkPlan[] {
  if (decoded.sourceDurationSeconds <= WHISPER_MAX_SECONDS) {
    return [{ startSeconds: 0, plannedStartSeconds: 0, silenceAdjustmentSeconds: 0, boundaryRms: rmsWindow(decoded.waveform, 0) }]
  }

  const plan: ChunkPlan[] = [{
    startSeconds: 0,
    plannedStartSeconds: 0,
    silenceAdjustmentSeconds: 0,
    boundaryRms: rmsWindow(decoded.waveform, 0),
  }]
  const nominalStep = Math.max(1, WHISPER_MAX_SECONDS - overlapSeconds)

  while (true) {
    const previous = plan[plan.length - 1]
    if (previous.startSeconds + WHISPER_MAX_SECONDS >= decoded.sourceDurationSeconds) break
    const plannedStartSeconds = previous.startSeconds + nominalStep
    const quiet = findQuietStart(decoded, plannedStartSeconds, previous.startSeconds)
    let startSeconds = quiet.startSeconds
    if (startSeconds <= previous.startSeconds + 1) startSeconds = plannedStartSeconds

    // Do not pull the final chunk backwards just to force a full 30 s window.
    // prepareWhisperDecodedSegment pads a shorter final window safely; keeping this
    // start close to the nominal boundary preserves the intended ~3 s overlap.
    startSeconds = Math.min(startSeconds, Math.max(previous.startSeconds + 1, decoded.sourceDurationSeconds - 0.1))

    plan.push({
      startSeconds,
      plannedStartSeconds,
      silenceAdjustmentSeconds: startSeconds - plannedStartSeconds,
      boundaryRms: quiet.rms,
    })
    if (plan.length > 1000 || startSeconds + WHISPER_MAX_SECONDS >= decoded.sourceDurationSeconds) break
  }

  return plan
}

function normalizedWord(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

function editDistance(a: string, b: string) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const previous = new Array<number>(b.length + 1)
  const current = new Array<number>(b.length + 1)
  for (let column = 0; column <= b.length; column += 1) previous[column] = column
  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost)
    }
    for (let column = 0; column <= b.length; column += 1) previous[column] = current[column]
  }
  return previous[b.length]
}

function wordSimilarity(a: string, b: string) {
  const left = normalizedWord(a)
  const right = normalizedWord(b)
  if (!left || !right) return 0
  if (left === right) return 1
  const distance = editDistance(left, right)
  return 1 - distance / Math.max(left.length, right.length)
}

function overlapScore(leftWords: string[], rightWords: string[]) {
  if (!leftWords.length || leftWords.length !== rightWords.length) return 0
  let score = 0
  let strong = 0
  for (let index = 0; index < leftWords.length; index += 1) {
    const similarity = wordSimilarity(leftWords[index], rightWords[index])
    score += similarity
    if (similarity >= 0.82) strong += 1
  }
  const mean = score / leftWords.length
  const strongShare = strong / leftWords.length
  return mean * 0.72 + strongShare * 0.28
}

function normalizeReadableText(value: string) {
  const collapsed = value
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([¿¡])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  if (!collapsed) return ""
  return collapsed.charAt(0).toLocaleUpperCase() + collapsed.slice(1)
}

function mergeOverlappingText(previous: string, next: string) {
  const left = normalizeReadableText(previous)
  const right = normalizeReadableText(next)
  if (!left) return right
  if (!right) return left
  const leftWords = left.split(/\s+/)
  const rightWords = right.split(/\s+/)
  const maxOverlap = Math.min(MAX_FUZZY_WORDS, leftWords.length, rightWords.length)
  let best: { size: number; offset: number; score: number } | null = null

  for (let offset = 0; offset <= Math.min(5, Math.max(0, rightWords.length - 2)); offset += 1) {
    for (let size = maxOverlap; size >= 2; size -= 1) {
      if (offset + size > rightWords.length) continue
      const leftSlice = leftWords.slice(-size)
      const rightSlice = rightWords.slice(offset, offset + size)
      const score = overlapScore(leftSlice, rightSlice)
      if (!best || score > best.score || (score === best.score && size > best.size)) best = { size, offset, score }
    }
  }

  if (best && (best.score >= 0.78 || (best.size >= 5 && best.score >= 0.7))) {
    return normalizeReadableText([...leftWords, ...rightWords.slice(best.offset + best.size)].join(" "))
  }
  return normalizeReadableText(`${left} ${right}`)
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
  const runner: WhisperFeatureRunner = options.transcribeFeatures || transcribeWhisperFeatures
  abortIfNeeded(options.signal)
  options.onProgress?.({ phase: "decode", chunkIndex: 0, chunkCount: 1 })
  const decoded = await decodeWhisperAudio(blob)
  abortIfNeeded(options.signal)

  options.onProgress?.({ phase: "segment", chunkIndex: 0, chunkCount: 1 })
  const plan = buildChunkPlan(decoded, overlapSeconds)
  const chunks: WhisperLongFormChunk[] = []
  let mergedText = ""
  let resolvedLanguage = requestedLanguage
  let languageConfidence = requestedLanguage === "auto" ? 0 : 1
  let featureMs = 0

  for (let index = 0; index < plan.length; index += 1) {
    abortIfNeeded(options.signal)
    const item = plan[index]
    const startSeconds = item.startSeconds
    options.onProgress?.({
      phase: "features",
      chunkIndex: index,
      chunkCount: plan.length,
      startSeconds,
      endSeconds: Math.min(decoded.sourceDurationSeconds, startSeconds + WHISPER_MAX_SECONDS),
    })
    const features = prepareWhisperDecodedSegment(decoded, { segmentStartSeconds: startSeconds })
    featureMs += features.featureMs
    abortIfNeeded(options.signal)

    const languageForChunk = resolvedLanguage === "auto" ? "auto" : resolvedLanguage
    const result = await runner(features.features, options.backend, {
      maxTokens: options.maxTokensPerChunk ?? 192,
      language: languageForChunk,
      task,
      includeTimestamps: true,
      signal: options.signal,
      yieldEveryTokens: 1,
      onProgress: modelProgress => options.onProgress?.({
        phase: "model",
        chunkIndex: index,
        chunkCount: plan.length,
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
      plannedStartSeconds: item.plannedStartSeconds,
      silenceAdjustmentSeconds: item.silenceAdjustmentSeconds,
      boundaryRms: item.boundaryRms,
      features,
      result,
      globalTimestampTokens,
    })
    mergedText = mergeOverlappingText(mergedText, result.text)
  }

  options.onProgress?.({ phase: "merge", chunkIndex: plan.length, chunkCount: plan.length })
  const totalMs = performance.now() - started
  const decodedTokens = chunks.reduce((sum, chunk) => sum + chunk.result.decodedTokens, 0)
  const decodeWallMs = chunks.reduce((sum, chunk) => sum + chunk.result.decodeWallMs, 0)
  const modelEndToEndMs = chunks.reduce((sum, chunk) => sum + chunk.result.modelEndToEndMs, 0)
  const timestampTokens = chunks.flatMap(chunk => chunk.globalTimestampTokens)
  const first = chunks[0]?.result
  const finalLanguage = resolvedLanguage === "auto" ? first?.language || "en" : resolvedLanguage
  const finalConfidence = requestedLanguage === "auto" ? languageConfidence || first?.languageConfidence || 0 : 1

  return {
    text: normalizeReadableText(mergedText),
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
    qualityVersion: WHISPER_LONGFORM_QUALITY_VERSION,
    boundaryStrategy: "silence-aware",
    mergeStrategy: "fuzzy-token-overlap",
  }
}
