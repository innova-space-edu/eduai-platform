export type LocalAIRuntime = "litertjs" | "litert-lm"
export type LocalAIModelStatus = "ready" | "candidate" | "next"

export type LocalAIModelDefinition = {
  id: string
  name: string
  runtime: LocalAIRuntime
  task: string
  format: ".tflite" | ".litertlm"
  sizeMB: number
  sourceRepo: string
  modelUrl: string
  status: LocalAIModelStatus
  recommendedFor: string[]
  notes: string
}

export const EDUAI_LITERT_VERSION = "2.5.3"
export const EDUAI_LITERT_ESM_URL = `https://cdn.jsdelivr.net/npm/@litertjs/core@${EDUAI_LITERT_VERSION}/+esm`
export const EDUAI_LITERT_WASM_URL = `https://cdn.jsdelivr.net/npm/@litertjs/core@${EDUAI_LITERT_VERSION}/wasm/`

export const LOCAL_AI_MODELS: LocalAIModelDefinition[] = [
  {
    id: "mobilenet-v3-small-fp32",
    name: "MobileNet V3 Small",
    runtime: "litertjs",
    task: "Clasificación de imágenes",
    format: ".tflite",
    sizeMB: 10.2,
    sourceRepo: "litert-community/MobileNet-v3-small",
    modelUrl: "https://huggingface.co/litert-community/MobileNet-v3-small/resolve/main/mobilenet_v3_small.tflite",
    status: "ready",
    recommendedFor: ["prueba de WebGPU/WASM", "clasificación visual", "pipeline base de cámara"],
    notes: "Primer modelo de validación de EduAI. Es pequeño, público y usa un flujo clásico de LiteRT.",
  },
  {
    id: "mobilenet-v3-small-int8",
    name: "MobileNet V3 Small INT8",
    runtime: "litertjs",
    task: "Clasificación de imágenes",
    format: ".tflite",
    sizeMB: 2.88,
    sourceRepo: "litert-community/MobileNet-v3-small",
    modelUrl: "https://huggingface.co/litert-community/MobileNet-v3-small/resolve/main/mobilenet_v3_small_int8_channelwise.tflite",
    status: "candidate",
    recommendedFor: ["equipos modestos", "CPU/WASM", "pruebas de cuantización"],
    notes: "Mucho más liviano. Debe validarse por dispositivo porque la delegación WebGPU de modelos cuantizados puede variar.",
  },
  {
    id: "whisper-tiny-int8",
    name: "Whisper Tiny INT8",
    runtime: "litertjs",
    task: "Reconocimiento de voz",
    format: ".tflite",
    sizeMB: 41.1,
    sourceRepo: "litert-community/whisper-tiny",
    modelUrl: "https://huggingface.co/litert-community/whisper-tiny/resolve/main/whisper_tiny_30s_i8.tflite",
    status: "candidate",
    recommendedFor: ["dictado local", "transcripción", "modo voz de MIRA"],
    notes: "El runtime puede cargar el modelo, pero EduAI todavía debe implementar tokenización, audio y postprocesamiento ASR.",
  },
  {
    id: "qwen3-0.6b-int4",
    name: "Qwen3 0.6B mixed INT4",
    runtime: "litert-lm",
    task: "Generación de texto",
    format: ".litertlm",
    sizeMB: 474.61,
    sourceRepo: "litert-community/Qwen3-0.6B",
    modelUrl: "https://huggingface.co/litert-community/Qwen3-0.6B/resolve/main/qwen3_0_6b_mixed_int4.litertlm",
    status: "candidate",
    recommendedFor: ["LLM local liviano", "equipos con WebGPU", "asistente offline experimental"],
    notes: "Muy atractivo por tamaño, pero la API JS oficial de LiteRT-LM aún debe verificarse modelo por modelo antes de habilitarlo en EduAI web.",
  },
  {
    id: "gemma-4-e2b-web",
    name: "Gemma 4 E2B Web",
    runtime: "litert-lm",
    task: "Generación de texto",
    format: ".litertlm",
    sizeMB: 2010,
    sourceRepo: "litert-community/gemma-4-E2B-it-litert-lm",
    modelUrl: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm",
    status: "next",
    recommendedFor: ["chat local", "privacidad", "fallback sin API"],
    notes: "Modelo web citado oficialmente por LiteRT-LM JS. Requiere una descarga grande y hardware con memoria suficiente.",
  },
  {
    id: "gemma-4-e4b-web",
    name: "Gemma 4 E4B Web",
    runtime: "litert-lm",
    task: "Generación de texto",
    format: ".litertlm",
    sizeMB: 2970,
    sourceRepo: "litert-community/gemma-4-E4B-it-litert-lm",
    modelUrl: "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm",
    status: "next",
    recommendedFor: ["chat local de mayor calidad", "equipos potentes", "laboratorio admin"],
    notes: "También está documentado para LiteRT-LM JS, pero no debe descargarse automáticamente por su tamaño.",
  },
]

export const DEFAULT_LITERT_PROBE_MODEL_ID = "mobilenet-v3-small-fp32"

export function getLocalAIModel(modelId: string) {
  return LOCAL_AI_MODELS.find((model) => model.id === modelId) || null
}
