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
    name: "MobileNet V3 Small INT8 weight-only",
    runtime: "litertjs",
    task: "Clasificación de imágenes",
    format: ".tflite",
    sizeMB: 2.75,
    sourceRepo: "litert-community/MobileNet-v3-small",
    modelUrl: "https://huggingface.co/litert-community/MobileNet-v3-small/resolve/main/mobilenet_v3_small_weight_only_wi8_afp32.tflite",
    status: "ready",
    recommendedFor: ["equipos modestos", "FP32 activations", "comparación contra FP32"],
    notes: "Cuantiza los pesos a INT8 pero conserva activaciones FP32. Es la variante adecuada para comparar tamaño y velocidad sin cambiar el pipeline de entrada actual.",
  },
  {
    id: "mobilenet-v2-webnn-probe",
    name: "MobileNet V2 · WebNN probe",
    runtime: "litertjs",
    task: "Clasificación de imágenes / diagnóstico WebNN",
    format: ".tflite",
    sizeMB: 14.1,
    sourceRepo: "litert-community/MobileNet-v2",
    modelUrl: "https://huggingface.co/litert-community/MobileNet-v2/resolve/main/mobilenet_v2.tflite",
    status: "candidate",
    recommendedFor: ["WebNN preview", "NPU/GPU experimental", "validación de contexto WebNN"],
    notes: "Modelo de prueba separado para WebNN. MobileNet V2 figura entre los modelos validados por Microsoft para su preview de WebNN; EduAI lo mantiene fuera de la ruta de producción.",
  },
  {
    id: "mobilenet-v3-small-static-int8",
    name: "MobileNet V3 Small Static INT8",
    runtime: "litertjs",
    task: "Clasificación de imágenes",
    format: ".tflite",
    sizeMB: 2.88,
    sourceRepo: "litert-community/MobileNet-v3-small",
    modelUrl: "https://huggingface.co/litert-community/MobileNet-v3-small/resolve/main/mobilenet_v3_small_int8_channelwise.tflite",
    status: "next",
    recommendedFor: ["NPU/WebNN futuro", "activaciones INT8", "validación de cuantización completa"],
    notes: "Variante estática INT8 con activaciones INT8. Requiere cuantizar la entrada y validar escalas/zero-point antes de habilitarla en la prueba visual general.",
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
export const DEFAULT_LITERT_INT8_COMPARE_MODEL_ID = "mobilenet-v3-small-int8"
export const DEFAULT_LITERT_WEBNN_PROBE_MODEL_ID = "mobilenet-v2-webnn-probe"

export function getLocalAIModel(modelId: string) {
  return LOCAL_AI_MODELS.find((model) => model.id === modelId) || null
}
