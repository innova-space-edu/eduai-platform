// lib/image-config.ts
// v2 — FLUX.2 en Together, cadena OpenRouter 2026, Gemini via OR

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
    "anime style, Studio Ghibli inspired, detailed linework, vibrant colors, manga illustration, clean lines",
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
  fast:        ["pollinations", "openrouter", "together", "huggingface"],
  quality:     ["gemini", "openrouter", "together", "huggingface", "pollinations"],
  educational: ["gemini", "openrouter", "together", "huggingface", "pollinations"],
}

export const GEMINI_IMAGE_MODELS: string[] = [
  process.env.GEMINI_IMAGE_MODEL_PRIMARY,
  process.env.GEMINI_IMAGE_MODEL_SECONDARY,
  process.env.GEMINI_IMAGE_MODEL_TERTIARY,
  // GA — modelos activos oficiales
  "gemini-2.5-flash-image", // GA desde Oct 2025, modelo correcto
  "gemini-3.1-flash-image-preview", // preview más reciente
  // Fallbacks (pueden fallar en cuentas nuevas o regiones)
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation",
].filter((model): model is string => Boolean(model))

export type TogetherImageModel = { id: string; steps: number; guidance: number; useAspectRatio: boolean }
export const TOGETHER_IMAGE_MODELS: TogetherImageModel[] = [
  // FLUX.2 (nov 2025) — calidad producción, usa aspect_ratio
  { id: "black-forest-labs/FLUX.2-pro",     steps: 28, guidance: 3.5, useAspectRatio: true  },
  { id: "black-forest-labs/FLUX.2-flex",    steps: 28, guidance: 3.5, useAspectRatio: true  },
  // FLUX.1.x — más rápido, usa width/height
  { id: "black-forest-labs/FLUX.1-schnell", steps: 4,  guidance: 0,   useAspectRatio: false },
  { id: "black-forest-labs/FLUX.1-dev",     steps: 20, guidance: 3.5, useAspectRatio: false },
]

export const HUGGINGFACE_IMAGE_MODELS = [
  { id: "black-forest-labs/FLUX.1-schnell", steps: 4, guidance: 0 },
  { id: "stabilityai/stable-diffusion-xl-base-1.0", steps: 25, guidance: 7.5 },
]

// Modelos de imagen disponibles vía OpenRouter (abril 2026).
// modalities: ["image","text"] → modelos que devuelven texto + imagen (Gemini, OpenAI)
//             ["image"]        → solo imagen (Sourceful, ByteDance, FLUX)
export const OPENROUTER_IMAGE_MODELS: { id: string; modalities: string[] }[] = [
  // Google Gemini — GA, mejor calidad/precio, excelente para educación
  { id: "google/gemini-2.5-flash-image",         modalities: ["image", "text"] },
  { id: "google/gemini-3.1-flash-image-preview", modalities: ["image", "text"] },
  // Sourceful Riverflow — rápido y barato ($0.02/imagen)
  { id: "sourceful/riverflow-v2-fast",           modalities: ["image"] },
  // ByteDance Seedream 4.5 — alta calidad ($0.04/imagen)
  { id: "bytedance-seed/seedream-4.5",           modalities: ["image"] },
  // OpenAI GPT-5 Image Mini — fallback premium
  { id: "openai/gpt-5-image-mini",               modalities: ["image", "text"] },
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
    "HF_TOKEN_5"
  )
}

export function parseProviderOrder(value: string | undefined, fallback: ConcreteProviderId[]): ConcreteProviderId[] {
  if (!value?.trim()) return fallback

  const valid: ConcreteProviderId[] = ["gemini", "pollinations", "together", "huggingface", "openrouter"]
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
