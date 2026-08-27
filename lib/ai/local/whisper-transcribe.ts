import { getCachedModelSource } from "@/lib/ai/local/litert-model-cache"
import { DEFAULT_LITERT_WHISPER_MODEL_ID, getLocalAIModel } from "@/lib/ai/local/litert-models"
import { getLiteRTRuntime } from "@/lib/ai/local/litert-runtime"
import {
  loadWhisperTokenizer,
  WHISPER_DECODE_START_TOKEN_ID,
  WHISPER_DECODE_STOP_TOKEN_ID,
  WHISPER_NO_TIMESTAMPS_TOKEN_ID,
  WHISPER_TRANSCRIBE_TOKEN_ID,
  WHISPER_TRANSLATE_TOKEN_ID,
} from "@/lib/ai/local/whisper-tokenizer"

export type WhisperBackend = "wasm" | "webgpu"
export type WhisperTask = "transcribe" | "translate"
export type WhisperLanguageMode = "auto" | string

export type WhisperProgress = {
  phase: "encoder" | "language" | "decoder" | "tokenizer"
  current: number
  total: number
  tokensPerSecond?: number
  language?: string
  languageConfidence?: number
}

export type WhisperSignatureDetail = {
  name: string
  dtype: string
  shape: number[]
}

export type WhisperTranscriptionResult = {
  text: string
  rawText: string
  tokenIds: number[]
  prefixTokenIds: number[]
  timestampTokens: string[]
  backend: WhisperBackend
  acquireMs: number
  encodeMs: number
  languageDetectionMs: number
  decodeMs: number
  decodeWallMs: number
  tokenizerMs: number
  modelEndToEndMs: number
  modelReused: boolean
  cacheHit: boolean
  cacheSource: "cache" | "network" | "direct"
  decodedTokens: number
  tokensPerSecond: number
  msPerToken: number
  language: string
  languageConfidence: number
  languageSource: "auto" | "manual"
  task: WhisperTask
  encodeInputs: WhisperSignatureDetail[]
  encodeOutputs: WhisperSignatureDetail[]
  decodeInputs: WhisperSignatureDetail[]
  decodeOutputs: WhisperSignatureDetail[]
}

type WhisperTranscribeOptions = {
  maxTokens?: number
  language?: WhisperLanguageMode
  task?: WhisperTask
  includeTimestamps?: boolean
  signal?: AbortSignal
  onProgress?: (progress: WhisperProgress) => void
  yieldEveryTokens?: number
}

function details(runner: any, kind: "input" | "output"): WhisperSignatureDetail[] {
  const values = kind === "input" ? runner.getInputDetails?.() : runner.getOutputDetails?.()
  if (!Array.isArray(values)) return []
  return values.map((detail: any) => ({
    name: String(detail?.name || ""),
    dtype: String(detail?.dtype || "unknown"),
    shape: Array.from(detail?.shape || [], value => Number(value)),
  }))
}

function elementCount(shape: number[]) {
  return shape.reduce((total, value) => total * Math.max(1, Number(value) || 1), 1)
}

function disposeOutputs(outputs: any) {
  if (Array.isArray(outputs)) outputs.forEach(output => output?.delete?.())
  else if (outputs && typeof outputs === "object") Object.values(outputs).forEach(output => (output as any)?.delete?.())
}

function outputArray(outputs: any) {
  return Array.isArray(outputs) ? outputs : outputs && typeof outputs === "object" ? Object.values(outputs) : []
}

function buildCausalMask(length: number) {
  const masked = -0.7 * 3.4028234663852886e38
  const data = new Float32Array(length * length)
  data.fill(masked)
  for (let row = 0; row < length; row += 1) {
    for (let column = 0; column <= row; column += 1) data[row * length + column] = 0
  }
  return data
}

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Transcripción cancelada.", "AbortError")
}

async function yieldToBrowser() {
  const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) await scheduler.yield()
  else await new Promise<void>(resolve => setTimeout(resolve, 0))
}

function argmaxRow(logits: ArrayLike<number>, position: number, vocabSize: number) {
  const start = position * vocabSize
  const end = Math.min(logits.length, start + vocabSize)
  let bestToken = 0
  let bestValue = Number.NEGATIVE_INFINITY
  for (let index = start; index < end; index += 1) {
    const value = Number(logits[index])
    if (value > bestValue) {
      bestValue = value
      bestToken = index - start
    }
  }
  return { tokenId: bestToken, score: bestValue }
}

function softmaxConfidence(entries: Array<{ code: string; tokenId: number; score: number }>, winnerScore: number) {
  if (!entries.length || !Number.isFinite(winnerScore)) return 0
  let denominator = 0
  for (const entry of entries) denominator += Math.exp(Math.max(-80, entry.score - winnerScore))
  return denominator > 0 ? Math.min(1, 1 / denominator) : 0
}

export async function transcribeWhisperFeatures(
  features: Float32Array,
  backend: WhisperBackend,
  options: WhisperTranscribeOptions = {},
): Promise<WhisperTranscriptionResult> {
  const modelDef = getLocalAIModel(DEFAULT_LITERT_WHISPER_MODEL_ID)
  if (!modelDef) throw new Error("Whisper Tiny INT8 no está registrado en Model Lab.")
  if (backend === "webgpu" && !("gpu" in navigator)) throw new Error("WebGPU no está disponible en este navegador.")

  const requestedLanguage = options.language || "auto"
  const task: WhisperTask = options.task || "transcribe"
  const includeTimestamps = options.includeTimestamps !== false
  const yieldEveryTokens = Math.max(1, options.yieldEveryTokens ?? 1)
  abortIfNeeded(options.signal)

  const runtime = await getLiteRTRuntime()
  const source = await getCachedModelSource(modelDef.modelUrl)
  const acquireStarted = performance.now()
  let model: any = null
  let encoderOutputs: any[] = []
  try {
    model = await runtime.litert.loadAndCompile(source.url, {
      accelerator: backend,
      __eduaiModelId: modelDef.id,
    })
    const acquireMs = performance.now() - acquireStarted
    const modelReused = Boolean(model?.__eduaiPoolReused)
    const encodeRunner = model?.signatures?.encode
    const decodeRunner = model?.signatures?.decode
    if (!encodeRunner || !decodeRunner) {
      const keys = Object.keys(model?.signatures || {})
      throw new Error(`Whisper requiere firmas encode/decode. Detectadas: ${keys.join(", ") || "ninguna"}.`)
    }

    const encodeInputs = details(encodeRunner, "input")
    const encodeOutputsDetails = details(encodeRunner, "output")
    const decodeInputs = details(decodeRunner, "input")
    const decodeOutputs = details(decodeRunner, "output")
    if (encodeInputs.length !== 1) throw new Error(`La firma encode esperaba 1 entrada y reportó ${encodeInputs.length}.`)
    const expectedFeatures = elementCount(encodeInputs[0].shape)
    if (features.length !== expectedFeatures) throw new Error(`Whisper espera ${expectedFeatures} valores log-Mel y EduAI preparó ${features.length}.`)
    if (decodeInputs.length < 3) throw new Error("La firma decode no expone estados + tokenIds + máscara causal.")

    const tokenizer = await loadWhisperTokenizer()
    const featureTensor = new runtime.litert.Tensor(features, encodeInputs[0].shape)
    const modelStarted = performance.now()
    const encodeStarted = performance.now()
    options.onProgress?.({ phase: "encoder", current: 0, total: 1 })
    try {
      encoderOutputs = outputArray(await encodeRunner.run(featureTensor))
    } finally {
      featureTensor.delete?.()
    }
    const encodeMs = performance.now() - encodeStarted
    options.onProgress?.({ phase: "encoder", current: 1, total: 1 })
    abortIfNeeded(options.signal)
    if (!encoderOutputs.length) throw new Error("La firma encode no devolvió estados para el decoder.")

    const tokenDetail = decodeInputs[decodeInputs.length - 2]
    const maskDetail = decodeInputs[decodeInputs.length - 1]
    const numTokenIds = elementCount(tokenDetail.shape)
    const maskElements = elementCount(maskDetail.shape)
    const maskSize = Math.round(Math.sqrt(maskElements))
    if (maskSize * maskSize !== maskElements) throw new Error(`Máscara causal inesperada: ${maskDetail.shape.join("×")}.`)
    if (!/int32/i.test(tokenDetail.dtype)) throw new Error(`Whisper decode usa tokenIds ${tokenDetail.dtype}; se esperaba int32.`)
    if (!/float32/i.test(maskDetail.dtype)) throw new Error(`Whisper decode usa máscara ${maskDetail.dtype}; se esperaba float32.`)

    const tokenIdsBuffer = new Int32Array(numTokenIds)
    tokenIdsBuffer[0] = WHISPER_DECODE_START_TOKEN_ID
    const causalMask = buildCausalMask(maskSize)
    const maskTensor = new runtime.litert.Tensor(causalMask, maskDetail.shape)
    let decodeMs = 0
    let languageDetectionMs = 0

    async function readLogits(position: number) {
      abortIfNeeded(options.signal)
      const tokenTensor = new runtime.litert.Tensor(tokenIdsBuffer, tokenDetail.shape)
      let outputs: any = null
      const started = performance.now()
      try {
        outputs = await decodeRunner.run([...encoderOutputs, tokenTensor, maskTensor])
        const logitsTensor = outputArray(outputs)[0]
        if (!logitsTensor) throw new Error("Whisper decode no devolvió logits.")
        const logits = await logitsTensor.data() as ArrayLike<number>
        const vocabSize = Math.floor(Number(logits.length || 0) / numTokenIds)
        if (!vocabSize) throw new Error("No fue posible determinar el vocabulario de Whisper.")
        return { logits, vocabSize, elapsedMs: performance.now() - started }
      } finally {
        tokenTensor.delete?.()
        disposeOutputs(outputs)
      }
    }

    let language = requestedLanguage === "auto" ? "en" : requestedLanguage
    let languageConfidence = requestedLanguage === "auto" ? 0 : 1
    const languageSource: "auto" | "manual" = requestedLanguage === "auto" ? "auto" : "manual"

    try {
      if (requestedLanguage === "auto") {
        options.onProgress?.({ phase: "language", current: 0, total: 1 })
        const detectionStarted = performance.now()
        const { logits, vocabSize, elapsedMs } = await readLogits(0)
        languageDetectionMs = performance.now() - detectionStarted
        decodeMs += elapsedMs
        const candidates = Array.from(tokenizer.languageTokens.entries())
          .filter(([, tokenId]) => tokenId >= 0 && tokenId < vocabSize)
          .map(([code, tokenId]) => ({ code, tokenId, score: Number(logits[tokenId]) }))
        if (!candidates.length) throw new Error("El tokenizer Whisper no expone tokens de idioma para detección automática.")
        const winner = candidates.reduce((best, entry) => entry.score > best.score ? entry : best, candidates[0])
        language = winner.code
        languageConfidence = softmaxConfidence(candidates, winner.score)
        options.onProgress?.({ phase: "language", current: 1, total: 1, language, languageConfidence })
        await yieldToBrowser()
      }

      const languageTokenId = tokenizer.languageTokens.get(language)
      if (typeof languageTokenId !== "number") throw new Error(`El idioma "${language}" no está disponible en el tokenizer multilingüe de Whisper Tiny.`)
      const taskTokenId = task === "translate" ? WHISPER_TRANSLATE_TOKEN_ID : WHISPER_TRANSCRIBE_TOKEN_ID
      const prefixTokenIds = includeTimestamps
        ? [WHISPER_DECODE_START_TOKEN_ID, languageTokenId, taskTokenId]
        : [WHISPER_DECODE_START_TOKEN_ID, languageTokenId, taskTokenId, WHISPER_NO_TIMESTAMPS_TOKEN_ID]
      tokenIdsBuffer.fill(0)
      prefixTokenIds.forEach((tokenId, index) => { tokenIdsBuffer[index] = tokenId })

      const decoded: number[] = []
      const maxGeneratedTokens = Math.min(
        numTokenIds - prefixTokenIds.length,
        Math.max(1, options.maxTokens ?? numTokenIds - prefixTokenIds.length),
      )
      const decodeWallStarted = performance.now()

      for (let generated = 0; generated < maxGeneratedTokens; generated += 1) {
        abortIfNeeded(options.signal)
        const position = prefixTokenIds.length - 1 + generated
        const { logits, vocabSize, elapsedMs } = await readLogits(position)
        decodeMs += elapsedMs
        const { tokenId: bestToken } = argmaxRow(logits, position, vocabSize)
        if (bestToken === WHISPER_DECODE_STOP_TOKEN_ID) break
        decoded.push(bestToken)
        tokenIdsBuffer[position + 1] = bestToken

        const wallMs = Math.max(1, performance.now() - decodeWallStarted)
        options.onProgress?.({
          phase: "decoder",
          current: decoded.length,
          total: maxGeneratedTokens,
          tokensPerSecond: decoded.length / (wallMs / 1000),
          language,
          languageConfidence,
        })
        if ((generated + 1) % yieldEveryTokens === 0) await yieldToBrowser()
      }

      const decodeWallMs = performance.now() - decodeWallStarted
      abortIfNeeded(options.signal)
      options.onProgress?.({ phase: "tokenizer", current: 0, total: 1, language, languageConfidence })
      const tokenizerStarted = performance.now()
      const rawText = tokenizer.decodeRaw(decoded)
      const text = tokenizer.decode(decoded)
      const tokenizerMs = performance.now() - tokenizerStarted
      const timestampTokens = rawText.match(/<\|\d+(?:\.\d+)?\|>/g) || []
      const modelEndToEndMs = performance.now() - modelStarted
      const tokensPerSecond = decoded.length ? decoded.length / (Math.max(1, decodeWallMs) / 1000) : 0
      const msPerToken = decoded.length ? decodeWallMs / decoded.length : 0
      options.onProgress?.({ phase: "tokenizer", current: 1, total: 1, language, languageConfidence, tokensPerSecond })

      return {
        text,
        rawText,
        tokenIds: decoded,
        prefixTokenIds,
        timestampTokens,
        backend,
        acquireMs,
        encodeMs,
        languageDetectionMs,
        decodeMs,
        decodeWallMs,
        tokenizerMs,
        modelEndToEndMs,
        modelReused,
        cacheHit: source.cacheHit,
        cacheSource: source.source,
        decodedTokens: decoded.length,
        tokensPerSecond,
        msPerToken,
        language,
        languageConfidence,
        languageSource,
        task,
        encodeInputs,
        encodeOutputs: encodeOutputsDetails,
        decodeInputs,
        decodeOutputs,
      }
    } finally {
      maskTensor.delete?.()
    }
  } finally {
    for (const output of encoderOutputs) output?.delete?.()
    source.cleanup()
    model?.delete?.()
  }
}
