export type EduAILocalRuntimeMode = "auto" | "cpu";

export type EduAILocalModelRole = "assistant" | "nano" | "router";
export type EduAILocalModelTier = "nano" | "light" | "balanced" | "performance" | "max-browser";

export type EduAILocalModel = {
  id: string;
  label: string;
  baseModel: string;
  repo: string;
  file: string;
  sizeMB: number;
  context: number;
  minimumMemoryGB: number;
  recommendedMemoryGB: number;
  recommendedVramGB: number;
  webgpuPreferred: boolean;
  tier: EduAILocalModelTier;
  role: EduAILocalModelRole;
  description: string;
  recommendedFor: string[];
  systemPrompt: string;
};

export type EduAIHardwareProfile = {
  memoryGB: number | null;
  vramGB: number | null;
  webgpu: boolean;
  cores: number;
};

export type EduAIModelFit = "recommended" | "compatible" | "heavy" | "avoid";

export const DEFAULT_EDUAI_LOCAL_MODEL_ID = "eduai-local-lfm-350m";

const EDUAI_ASSISTANT_PROMPT =
  "Eres EDUAI Local, el asistente local de contingencia de EDUAI. Responde en español claro y breve. " +
  "Trabaja sin asumir acceso a Internet ni a datos que no estén en el mensaje. Si falta información, dilo. " +
  "No inventes funciones de EDUAI, datos de estudiantes, resultados ni fuentes.";

export const EDUAI_LOCAL_MODELS: readonly EduAILocalModel[] = [
  {
    id: "eduai-nano-gemma-270m",
    label: "EDUAI Nano · Gemma 3 270M Q4",
    baseModel: "Google/gemma-3-270m",
    repo: "gguf-org/gemma-3-270m-gguf",
    file: "gemma-3-270m-q4_0.gguf",
    sizeMB: 241,
    context: 4096,
    minimumMemoryGB: 4,
    recommendedMemoryGB: 4,
    recommendedVramGB: 0,
    webgpuPreferred: false,
    tier: "nano",
    role: "nano",
    description: "Ruta mínima para equipos con poca memoria o como fallback de emergencia.",
    recommendedFor: ["clasificación", "texto corto", "fallback", "benchmark"],
    systemPrompt:
      "Eres EDUAI Nano. Responde en español, con frases breves y datos explícitos. " +
      "Si una tarea requiere información que no está disponible localmente, indícalo en vez de inventarla.",
  },
  {
    id: "eduai-local-lfm-350m",
    label: "EDUAI Local · LFM2.5 350M Q4",
    baseModel: "LiquidAI/LFM2.5-350M",
    repo: "LiquidAI/LFM2.5-350M-GGUF",
    file: "LFM2.5-350M-Q4_K_M.gguf",
    sizeMB: 229,
    context: 4096,
    minimumMemoryGB: 4,
    recommendedMemoryGB: 4,
    recommendedVramGB: 0,
    webgpuPreferred: false,
    tier: "light",
    role: "assistant",
    description: "Modelo pequeño para CPU/WASM, rápido y apropiado para notebooks modestos.",
    recommendedFor: ["fallback offline", "respuestas breves", "clasificación", "estructuración"],
    systemPrompt: EDUAI_ASSISTANT_PROMPT,
  },
  {
    id: "eduai-local-qwen35-08b",
    label: "EDUAI Local+ · Qwen3.5 0.8B Q4",
    baseModel: "Qwen/Qwen3.5-0.8B",
    repo: "ggml-org/Qwen3.5-0.8B-GGUF",
    file: "Qwen3.5-0.8B-Q4_0.gguf",
    sizeMB: 563,
    context: 4096,
    minimumMemoryGB: 6,
    recommendedMemoryGB: 8,
    recommendedVramGB: 0,
    webgpuPreferred: false,
    tier: "balanced",
    role: "assistant",
    description: "Salto de calidad para equipos de 8 GB sin exigir GPU dedicada.",
    recommendedFor: ["chat local", "resumen", "redacción corta", "RAG local", "JSON"],
    systemPrompt: EDUAI_ASSISTANT_PROMPT,
  },
  {
    id: "eduai-local-gemma3-1b",
    label: "EDUAI Gemma · Gemma 3 1B Q4_K_M",
    baseModel: "google/gemma-3-1b-it",
    repo: "ggml-org/gemma-3-1b-it-GGUF",
    file: "gemma-3-1b-it-Q4_K_M.gguf",
    sizeMB: 806,
    context: 4096,
    minimumMemoryGB: 8,
    recommendedMemoryGB: 8,
    recommendedVramGB: 2,
    webgpuPreferred: true,
    tier: "balanced",
    role: "assistant",
    description: "Alternativa 1B para comparar calidad y latencia en hardware medio.",
    recommendedFor: ["chat", "redacción", "comparación de modelos", "RAG"],
    systemPrompt: EDUAI_ASSISTANT_PROMPT,
  },
  {
    id: "eduai-local-lfm12-qad",
    label: "EDUAI Plus · LFM2.5 1.2B QAD Q4",
    baseModel: "LiquidAI/LFM2.5-1.2B-Instruct",
    repo: "LiquidAI/LFM2.5-1.2B-Instruct-GGUF",
    file: "LFM2.5-1.2B-Instruct-QAD-Q4_0.gguf",
    sizeMB: 696,
    context: 4096,
    minimumMemoryGB: 8,
    recommendedMemoryGB: 8,
    recommendedVramGB: 2,
    webgpuPreferred: true,
    tier: "balanced",
    role: "assistant",
    description: "Perfil equilibrado para 8 GB RAM y equipos con WebGPU o CPU moderna.",
    recommendedFor: ["asistente general", "RAG", "routing", "redacción", "trabajo offline"],
    systemPrompt: EDUAI_ASSISTANT_PROMPT,
  },
  {
    id: "eduai-local-lfm26-qad",
    label: "EDUAI Performance · LFM2.5 2.6B QAD Q4",
    baseModel: "LiquidAI/LFM2.5-2.6B",
    repo: "LiquidAI/LFM2.5-2.6B-GGUF",
    file: "LFM2.5-2.6B-QAD-Q4_0.gguf",
    sizeMB: 1590,
    context: 4096,
    minimumMemoryGB: 8,
    recommendedMemoryGB: 8,
    recommendedVramGB: 4,
    webgpuPreferred: true,
    tier: "performance",
    role: "assistant",
    description: "Perfil de mayor calidad para, por ejemplo, i5 + 8 GB RAM + 4 GB VRAM. Mantiene el archivo GGUF por debajo de 2 GB.",
    recommendedFor: ["asistente principal offline", "RAG más complejo", "redacción", "razonamiento corto", "agentes locales"],
    systemPrompt: EDUAI_ASSISTANT_PROMPT,
  },
  {
    id: "eduai-local-lfm26-q5",
    label: "EDUAI Max Browser · LFM2.5 2.6B Q5_K_M",
    baseModel: "LiquidAI/LFM2.5-2.6B",
    repo: "LiquidAI/LFM2.5-2.6B-GGUF",
    file: "LFM2.5-2.6B-Q5_K_M.gguf",
    sizeMB: 1940,
    context: 4096,
    minimumMemoryGB: 12,
    recommendedMemoryGB: 16,
    recommendedVramGB: 6,
    webgpuPreferred: true,
    tier: "max-browser",
    role: "assistant",
    description: "Cuantización de mayor calidad cerca del límite práctico de archivo único de wllama. Reservada para equipos más holgados.",
    recommendedFor: ["máxima calidad local en navegador", "RAG", "redacción", "benchmark avanzado"],
    systemPrompt: EDUAI_ASSISTANT_PROMPT,
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
    recommendedMemoryGB: 4,
    recommendedVramGB: 0,
    webgpuPreferred: false,
    tier: "nano",
    role: "router",
    description: "Especializado para convertir instrucciones en llamadas a herramientas y rutas internas de EDUAI.",
    recommendedFor: ["tool calling", "routing", "JSON estructurado", "selección de agente"],
    systemPrompt:
      "Eres EDUAI Router, un modelo local de laboratorio para seleccionar herramientas de EDUAI. " +
      "No ejecutes acciones por tu cuenta. Devuelve solo decisiones compatibles con las herramientas que se te entreguen.",
  },
] as const;

export function getEduAILocalModel(modelId: string) {
  return EDUAI_LOCAL_MODELS.find((model) => model.id === modelId) || EDUAI_LOCAL_MODELS[0];
}

export function evaluateEduAILocalModel(
  model: EduAILocalModel,
  profile: EduAIHardwareProfile,
): EduAIModelFit {
  const memory = profile.memoryGB ?? 8;
  const vram = profile.vramGB ?? 0;

  if (memory < model.minimumMemoryGB) return "avoid";
  if (model.webgpuPreferred && !profile.webgpu) {
    return memory >= model.recommendedMemoryGB + 4 ? "compatible" : "heavy";
  }
  if (model.recommendedVramGB > 0 && profile.webgpu && vram > 0 && vram < model.recommendedVramGB) {
    return "heavy";
  }
  if (
    memory >= model.recommendedMemoryGB &&
    (!model.webgpuPreferred || (profile.webgpu && (model.recommendedVramGB === 0 || vram >= model.recommendedVramGB)))
  ) {
    return "recommended";
  }
  return "compatible";
}

export function recommendEduAILocalModel(profile: EduAIHardwareProfile) {
  const memory = profile.memoryGB ?? 8;
  const vram = profile.vramGB ?? 0;

  if (profile.webgpu && memory >= 16 && vram >= 6) return "eduai-local-lfm26-q5";
  if (profile.webgpu && memory >= 8 && vram >= 4) return "eduai-local-lfm26-qad";
  if (profile.webgpu && memory >= 8 && vram >= 2) return "eduai-local-lfm12-qad";
  if (memory >= 8) return "eduai-local-qwen35-08b";
  if (memory >= 4) return "eduai-local-lfm-350m";
  return "eduai-nano-gemma-270m";
}
