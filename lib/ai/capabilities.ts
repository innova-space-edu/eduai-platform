export type AICapability =
  | "text"
  | "structured"
  | "vision"
  | "long_context"
  | "research"
  | "retrieval"
  | "embeddings"
  | "image"
  | "video"
  | "audio_transcribe"
  | "audio_speech"
  | "music"
  | "code"

export type AIProviderId =
  | "google"
  | "groq"
  | "openrouter"
  | "together"
  | "cerebras"
  | "local"

export type AIReusePolicy =
  | "never"
  | "exact_private"
  | "exact_workspace"
  | "published"

export type AIVisibility = "private" | "workspace" | "shared" | "public"

export type AIRequestContext = {
  userId?: string | null
  workspaceId?: string | null
  module?: string | null
  sourceId?: string | null
  reusePolicy?: AIReusePolicy
  visibility?: AIVisibility
}

// Orden conservador: Google sigue siendo el proveedor principal donde ya está
// funcionando. Los proveedores alternativos se añaden como fallbacks y pueden
// reordenarse por capability mediante variables EDUAI_AI_PROVIDER_ORDER_*.
// `retrieval` representa índices/buscadores cloud como Google File Search y no
// sustituye el RAG local/propio de EduAI.
export const DEFAULT_PROVIDER_ORDER: Record<AICapability, AIProviderId[]> = {
  text: ["google", "groq", "openrouter", "cerebras", "together"],
  structured: ["google", "groq", "openrouter", "cerebras", "together"],
  vision: ["google", "openrouter", "together"],
  long_context: ["google", "openrouter", "groq", "cerebras", "together"],
  research: ["google", "groq", "openrouter"],
  retrieval: ["google"],
  embeddings: ["google", "local"],
  image: ["google", "openrouter", "together"],
  video: ["google"],
  audio_transcribe: ["groq", "google"],
  audio_speech: ["google"],
  music: ["google", "local"],
  code: ["google", "groq", "cerebras", "openrouter", "together"],
}

const PROVIDERS = new Set<AIProviderId>([
  "google",
  "groq",
  "openrouter",
  "together",
  "cerebras",
  "local",
])

export function providerOrderFor(
  capability: AICapability,
  envOverride?: string | null
): AIProviderId[] {
  if (!envOverride?.trim()) return DEFAULT_PROVIDER_ORDER[capability]

  const parsed = envOverride
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is AIProviderId => PROVIDERS.has(value as AIProviderId))

  if (!parsed.length) return DEFAULT_PROVIDER_ORDER[capability]

  return Array.from(new Set(parsed))
}

export function envNameForCapability(capability: AICapability): string {
  return `EDUAI_AI_PROVIDER_ORDER_${capability.toUpperCase()}`
}
