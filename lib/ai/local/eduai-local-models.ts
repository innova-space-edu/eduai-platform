export type EduAILocalRuntimeMode = "auto" | "cpu";

export type EduAILocalModelRole = "assistant" | "nano" | "router";

export type EduAILocalModel = {
  id: string;
  label: string;
  baseModel: string;
  repo: string;
  file: string;
  sizeMB: number;
  context: number;
  minimumMemoryGB: number;
  role: EduAILocalModelRole;
  description: string;
  recommendedFor: string[];
  systemPrompt: string;
};

export const DEFAULT_EDUAI_LOCAL_MODEL_ID = "eduai-local-lfm-350m";

export const EDUAI_LOCAL_MODELS: readonly EduAILocalModel[] = [
  {
    id: "eduai-local-lfm-350m",
    label: "EDUAI Local · LFM2.5 350M Q4",
    baseModel: "LiquidAI/LFM2.5-350M",
    repo: "LiquidAI/LFM2.5-350M-GGUF",
    file: "LFM2.5-350M-Q4_K_M.gguf",
    sizeMB: 229,
    context: 4096,
    minimumMemoryGB: 4,
    role: "assistant",
    description: "Modelo local principal para notebooks modestos. Prioriza CPU/WASM y usa WebGPU cuando el navegador y el equipo lo permiten.",
    recommendedFor: ["fallback offline", "respuestas breves", "clasificación", "estructuración", "asistencia EDUAI"],
    systemPrompt:
      "Eres EDUAI Local, el asistente local de contingencia de EDUAI. Responde en español claro y breve. " +
      "Trabaja sin asumir acceso a Internet ni a datos que no estén en el mensaje. Si falta información, dilo. " +
      "No inventes funciones de EDUAI, datos de estudiantes, resultados ni fuentes.",
  },
  {
    id: "eduai-nano-gemma-270m",
    label: "EDUAI Nano · Gemma 3 270M Q4",
    baseModel: "Google/gemma-3-270m",
    repo: "gguf-org/gemma-3-270m-gguf",
    file: "gemma-3-270m-q4_0.gguf",
    sizeMB: 241,
    context: 4096,
    minimumMemoryGB: 4,
    role: "nano",
    description: "Ruta ultraligera alternativa para equipos limitados y pruebas comparativas del laboratorio.",
    recommendedFor: ["clasificación", "texto corto", "fallback", "benchmark"],
    systemPrompt:
      "Eres EDUAI Nano. Responde en español, con frases breves y datos explícitos. " +
      "Si una tarea requiere información que no está disponible localmente, indícalo en vez de inventarla.",
  },
  {
    id: "eduai-router-functiongemma-270m",
    label: "EDUAI Router · FunctionGemma 270M",
    baseModel: "Google/functiongemma-270m-it",
    repo: "ggml-org/functiongemma-270m-it-GGUF",
    file: "functiongemma-270m-it-q8_0.gguf",
    sizeMB: 292,
    context: 4096,
    minimumMemoryGB: 4,
    role: "router",
    description: "Candidato especializado para convertir instrucciones en llamadas a herramientas y rutas internas de EDUAI.",
    recommendedFor: ["tool calling", "routing", "JSON estructurado", "selección de agente"],
    systemPrompt:
      "Eres EDUAI Router, un modelo local de laboratorio para seleccionar herramientas de EDUAI. " +
      "No ejecutes acciones por tu cuenta. Devuelve solo decisiones compatibles con las herramientas que se te entreguen.",
  },
] as const;

export function getEduAILocalModel(modelId: string) {
  return EDUAI_LOCAL_MODELS.find((model) => model.id === modelId) || EDUAI_LOCAL_MODELS[0];
}
