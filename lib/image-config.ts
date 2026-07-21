// lib/image-config.ts
// v3 — configuración multiproveedor para generación de imágenes en EduAI

export type ProviderId =
  | "auto"
  | "gemini"
  | "pollinations"
  | "together"
  | "huggingface"
  | "openrouter"

export type ConcreteProviderId = Exclude<ProviderId, "auto">

export type GenerationMode = "fast" | "quality" | "educational"

export type ProviderResult = {
  imageBase64: string | null
  label: string
  model?: string
  error?: string
}

export const STYLE_GUIDES: Record<string, string> = {
  realistic:
    "photorealistic, DSLR photo, 85mm lens, sharp focus, natural lighting, ultra detailed, 8k resolution",
  "digital art":
    "digital painting, concept art, artstation trending, vibrant colors, detailed illustration, professional quality",
  "oil painting":
    "oil on canvas, impressionist brushstrokes, museum quality, rich textures, classical fine art painting",
  anime:
    "anime style, detailed linework, vibrant colors, manga illustration, clean lines",
  watercolor:
    "watercolor painting, soft edges, transparent washes, artistic, delicate details, paper texture visible",
  "3d render":
    "3D render, octane render, cinema4d, ray tracing, photorealistic 3D, subsurface scattering, volumetric light",
  sketch:
    "pencil sketch, detailed linework, graphite drawing, cross-hatching, artistic sketch, white background",
  cinematic:
    "cinematic photography, movie still, dramatic lighting, anamorphic lens, epic composition, shallow depth of field",
  educational:
    "educational diagram, clean illustration, labeled, informative, white background, professional, colorful, pedagogical",
  "flat design":
    "flat design illustration, minimal, geometric shapes, bold colors, modern vector art, icon style",
  infographic:
    "infographic style, data visualization, clean design, informative, colorful sections, professional design",
}

export const DEFAULT_IMAGE_PROVIDER_ORDER: Record<GenerationMode, ConcreteProviderId[]> = {
  fast: ["pollinations", "openrouter", "together", "huggingface", "gemini"],
  quality: ["gemini", "openrouter", "together", "huggingface", "pollinations"],
  educational: ["gemini", "openrouter", "pollinations", "together", "huggingface"],
}

const GEMINI_IMAGE_MODELS_RAW = [
  process.env.GEMINI_IMAGE_MODEL_PRIMARY,
  process.env.GEMINI_IMAGE_MODEL_SECONDARY,
  process.env.GEMINI_IMAGE_MODEL_TERTIARY,
  "gemini-3.1-flash-image",
  "gemini-2.5-flash-image",
]

export const GEMINI_IMAGE_MODELS: string[] = GEMINI_IMAGE_MODELS_RAW.filter(
  (model): model is string => Boolean(model)
)

const POLLINATIONS_IMAGE_MODELS_RAW = [
  process.env.POLLINATIONS_IMAGE_MODEL_PRIMARY,
  process.env.POLLINATIONS_IMAGE_MODEL_SECONDARY,
  process.env.POLLINATIONS_IMAGE_MODEL_TERTIARY,
  "zimage",
  "flux",
  "qwen-image",
]

export const POLLINATIONS_IMAGE_MODELS: string[] = POLLINATIONS_IMAGE_MODELS_RAW.filter(
  (model): model is string => Boolean(model)
)

export type TogetherImageModel = {
  id: string
  steps: number
  guidance: number
  useAspectRatio: boolean
}

export const TOGETHER_IMAGE_MODELS: TogetherImageModel[] = [
  { id: process.env.TOGETHER_IMAGE_MODEL_PRIMARY || "black-forest-labs/FLUX.1-schnell-Free", steps: 4, guidance: 0, useAspectRatio: false },
  { id: process.env.TOGETHER_IMAGE_MODEL_SECONDARY || "black-forest-labs/FLUX.1-schnell", steps: 4, guidance: 0, useAspectRatio: false },
  { id: process.env.TOGETHER_IMAGE_MODEL_TERTIARY || "black-forest-labs/FLUX.1.1-pro", steps: 20, guidance: 3.5, useAspectRatio: false },
]

export const HUGGINGFACE_IMAGE_MODELS = [
  { id: process.env.HF_IMAGE_MODEL_PRIMARY || "black-forest-labs/FLUX.1-schnell", steps: 4, guidance: 0 },
  { id: process.env.HF_IMAGE_MODEL_SECONDARY || "stabilityai/stable-diffusion-xl-base-1.0", steps: 25, guidance: 7.5 },
]

export const OPENROUTER_IMAGE_MODELS: { id: string; modalities: string[] }[] = [
  { id: process.env.OPENROUTER_IMAGE_MODEL_PRIMARY || "bytedance-seed/seedream-4.5", modalities: ["image"] },
  { id: process.env.OPENROUTER_IMAGE_MODEL_SECONDARY || "google/gemini-2.5-flash-image", modalities: ["image", "text"] },
  { id: process.env.OPENROUTER_IMAGE_MODEL_TERTIARY || "sourceful/riverflow-v2-fast", modalities: ["image"] },
]

export function clamp(v: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, Math.round(v)))
}

export function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}

export function basicPrompt(prompt: string, style: string): string {
  return `${prompt}, ${STYLE_GUIDES[style] || STYLE_GUIDES.realistic}, highly detailed, masterpiece, best quality`
}

export function aspectRatio(width: number, height: number): string {
  const r = width / height
  if (Math.abs(r - 1) < 0.05) return "1:1"
  if (Math.abs(r - 16 / 9) < 0.15) return "16:9"
  if (Math.abs(r - 9 / 16) < 0.15) return "9:16"
  if (Math.abs(r - 4 / 3) < 0.15) return "4:3"
  if (Math.abs(r - 3 / 4) < 0.15) return "3:4"
  if (Math.abs(r - 3 / 2) < 0.15) return "3:2"
  if (Math.abs(r - 2 / 3) < 0.15) return "2:3"
  return r >= 1 ? "16:9" : "9:16"
}

export function envPool(...names: string[]): string[] {
  return names.map((name) => process.env[name]).filter(Boolean) as string[]
}

export function pickFromPool<T>(items: T[], seed?: string): T | null {
  if (!items.length) return null
  if (!seed) return items[Math.floor(Math.random() * items.length)]

  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return items[hash % items.length]
}

export function getPromptOptimizerKeys(): string[] {
  return envPool(
    "GEMINI_API_KEY_PROMPT_1",
    "GEMINI_API_KEY_PROMPT_2",
    "GEMINI_API_KEY_PROMPT_3",
    "GEMINI_API_KEY_PROMPT_4",
    "GEMINI_API_KEY_IMAGE",
    "GEMINI_API_KEY"
  )
}

export function getGeminiImageKeys(): string[] {
  return envPool(
    "GEMINI_API_KEY_IMAGE",
    "GEMINI_API_KEY_IMAGE_2",
    "GEMINI_API_KEY_IMAGE_3",
    "GEMINI_API_KEY"
  )
}

export function getGeminiTextKeys(): string[] {
  return envPool(
    "GEMINI_API_KEY_TEXT",
    "GEMINI_API_KEY"
  )
}

export function getTogetherKeys(): string[] {
  return envPool(
    "TOGETHER_API_KEY_1",
    "TOGETHER_API_KEY_2",
    "TOGETHER_API_KEY_3",
    "TOGETHER_API_KEY"
  )
}

export function getOpenRouterKeys(): string[] {
  return envPool(
    "OPENROUTER_API_KEY_1",
    "OPENROUTER_API_KEY_2",
    "OPENROUTER_API_KEY_3",
    "OPENROUTER_API_KEY"
  )
}

export function getHuggingFaceTokens(): string[] {
  return envPool(
    "HF_TOKEN_1",
    "HF_TOKEN_2",
    "HF_TOKEN_3",
    "HF_TOKEN_4",
    "HF_TOKEN_5",
    "HF_TOKEN"
  )
}

export function parseProviderOrder(
  value: string | undefined,
  fallback: ConcreteProviderId[]
): ConcreteProviderId[] {
  if (!value?.trim()) return fallback

  const valid: ConcreteProviderId[] = [
    "gemini",
    "pollinations",
    "together",
    "huggingface",
    "openrouter",
  ]
  const parsed = value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is ConcreteProviderId => valid.includes(part as ConcreteProviderId))

  if (!parsed.length) return fallback

  const unique: ConcreteProviderId[] = []
  for (const provider of parsed) {
    if (!unique.includes(provider)) unique.push(provider)
  }
  return unique
}

export function providerOrder(provider: ProviderId, mode: GenerationMode): ConcreteProviderId[] {
  if (provider !== "auto") return [provider]

  if (mode === "fast") {
    return parseProviderOrder(
      process.env.IMAGE_PROVIDER_ORDER_FAST,
      DEFAULT_IMAGE_PROVIDER_ORDER.fast
    )
  }

  if (mode === "quality") {
    return parseProviderOrder(
      process.env.IMAGE_PROVIDER_ORDER_QUALITY,
      DEFAULT_IMAGE_PROVIDER_ORDER.quality
    )
  }

  return parseProviderOrder(
    process.env.IMAGE_PROVIDER_ORDER_EDUCATIONAL,
    DEFAULT_IMAGE_PROVIDER_ORDER.educational
  )
}

export function shouldOptimizePrompt(mode: GenerationMode, customPrompt?: string): boolean {
  if (customPrompt?.trim()) return false

  const enabled = (process.env.IMAGE_PROMPT_OPTIMIZER_ENABLED || "true").toLowerCase() === "true"
  if (!enabled) return false

  const optimizerMode = (process.env.IMAGE_PROMPT_OPTIMIZER_MODE || "quality_only").toLowerCase()

  if (optimizerMode === "always") return true
  if (optimizerMode === "never") return false
  if (optimizerMode === "quality_only") return mode === "quality" || mode === "educational"
  if (optimizerMode === "educational_only") return mode === "educational"

  return mode === "quality" || mode === "educational"
}
