import { getCachedModelSource } from "@/lib/ai/local/litert-model-cache"
import { DEFAULT_LITERT_WHISPER_MODEL_ID, getLocalAIModel } from "@/lib/ai/local/litert-models"
import { getLiteRTRuntime } from "@/lib/ai/local/litert-runtime"
import { loadWhisperTokenizer, WHISPER_DECODE_START_TOKEN_ID, WHISPER_DECODE_STOP_TOKEN_ID } from "@/lib/ai/local/whisper-tokenizer"

export type WhisperBackend = "wasm" | "webgpu"

export type WhisperSignatureDetail = {
  name: string
  dtype: string
  shape: number[]
}

export type WhisperTranscriptionResult = {
  text: string
  tokenIds: number[]
  backend: WhisperBackend
  acquireMs: number
  encodeMs: number
  decodeMs: number
  tokenizerMs: number
  modelEndToEndMs: number
  modelReused: boolean
  cacheHit: boolean
  cacheSource: "cache" | "network" | "direct"
  decodedTokens: number
  encodeInputs: WhisperSignatureDetail[]
  encodeOutputs: WhisperSignatureDetail[]
  decodeInputs: WhisperSignatureDetail[]
  decodeOutputs: WhisperSignatureDetail[]
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

export async function transcribeWhisperFeatures(
  features: Float32Array,
  backend: WhisperBackend,
  options: { maxTokens?: number } = {},
): Promise<WhisperTranscriptionResult> {
  const modelDef = getLocalAIModel(DEFAULT_LITERT_WHISPER_MODEL_ID)
  if (!modelDef) throw new Error("Whisper Tiny INT8 no está registrado en Model Lab.")
  if (backend === "webgpu" && !("gpu" in navigator)) throw new Error("WebGPU no está disponible en este navegador.")

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
    if (features.length !== expectedFeatures) {
      throw new Error(`Whisper espera ${expectedFeatures} valores log-Mel y EduAI preparó ${features.length}.`)
    }
    if (decodeInputs.length < 3) throw new Error("La firma decode no expone estados + tokenIds + máscara causal.")

    const featureTensor = new runtime.litert.Tensor(features, encodeInputs[0].shape)
    const modelStarted = performance.now()
    const encodeStarted = performance.now()
    try {
      encoderOutputs = outputArray(await encodeRunner.run(featureTensor))
    } finally {
      featureTensor.delete?.()
    }
    const encodeMs = performance.now() - encodeStarted
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
    const decoded: number[] = []
    let decodeMs = 0
    const hardLimit = Math.min(numTokenIds - 1, Math.max(1, options.maxTokens ?? numTokenIds - 1))

    try {
      for (let position = 0; position < hardLimit; position += 1) {
        const tokenTensor = new runtime.litert.Tensor(tokenIdsBuffer, tokenDetail.shape)
        const decodeStarted = performance.now()
        let outputs: any = null
        try {
          outputs = await decodeRunner.run([...encoderOutputs, tokenTensor, maskTensor])
          const logitsTensor = outputArray(outputs)[0]
          if (!logitsTensor) throw new Error("Whisper decode no devolvió logits.")
          const logitsData = await logitsTensor.data()
          const logits = logitsData as ArrayLike<number>
          const vocabSize = Math.floor(Number(logits.length || 0) / numTokenIds)
          if (!vocabSize) throw new Error("No fue posible determinar el vocabulario de Whisper.")
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
          if (bestToken === WHISPER_DECODE_STOP_TOKEN_ID) break
          decoded.push(bestToken)
          tokenIdsBuffer[position + 1] = bestToken
        } finally {
          decodeMs += performance.now() - decodeStarted
          tokenTensor.delete?.()
          disposeOutputs(outputs)
        }
      }
    } finally {
      maskTensor.delete?.()
    }

    const tokenizerStarted = performance.now()
    const tokenizer = await loadWhisperTokenizer()
    const text = tokenizer.decode(decoded)
    const tokenizerMs = performance.now() - tokenizerStarted
    const modelEndToEndMs = performance.now() - modelStarted

    return {
      text,
      tokenIds: decoded,
      backend,
      acquireMs,
      encodeMs,
      decodeMs,
      tokenizerMs,
      modelEndToEndMs,
      modelReused,
      cacheHit: source.cacheHit,
      cacheSource: source.source,
      decodedTokens: decoded.length,
      encodeInputs,
      encodeOutputs: encodeOutputsDetails,
      decodeInputs,
      decodeOutputs,
    }
  } finally {
    for (const output of encoderOutputs) output?.delete?.()
    source.cleanup()
    model?.delete?.()
  }
}
