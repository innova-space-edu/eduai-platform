// lib/image-config.ts — v3

export type ProviderId =
  | "auto"
  | "stability"
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

// ─── Style guides — prompts estructurados FLUX.2 ──────────────────────────────
export const STYLE_GUIDES: Record<string, string> = {
  realistic:
    "RAW photo, photorealistic, shot on Sony A7R V with 85mm f/1.4 lens, natural skin texture with visible pores, catchlights in eyes, natural lighting, ultra-sharp focus, 8K resolution, no filters, professional photography",

  portrait:
    "professional photography, Sony A7IV 85mm f/1.8, natural skin texture, sharp eyes with natural catchlights, warm golden hour window light, soft bokeh background, perfect facial anatomy, detailed hair strands, cinematic color grading",

  "3d animation":
    "3D animated character, Pixar style, subsurface scattering skin shader, high-fidelity 3D render, cinema4d octane render, volumetric lighting, professional character design, smooth textures, expressive face, vibrant color palette, depth of field",

  "comic book":
    "classic American comic book illustration style, 1970s-1980s era, bold ink outlines, halftone dot patterns, strong shadows and highlights, dynamic composition, vintage color palette with warm tones, detailed cross-hatching, graphic novel quality",

  "digital art":
    "digital painting, concept art, artstation trending 2025, vibrant colors, highly detailed, professional illustration, dramatic lighting, rich color contrast, cinematic composition, masterpiece quality",

  "oil painting":
    "oil on canvas, classical fine art portrait, museum quality, rich impasto textures, Rembrandt dramatic chiaroscuro lighting, warm amber tones, detailed brushwork, renaissance composition, masterpiece",

  anime:
    "high-quality anime illustration, Studio Ghibli or KyoAni inspired, clean linework, expressive detailed eyes with light reflections, vibrant colors, soft cel shading, professional anime key visual, detailed hair, cinematic framing",

  watercolor:
    "watercolor painting, loose expressive brushwork, delicate transparent washes, artistic, soft dreamy edges, paper texture visible, natural light, harmonious color palette, award-winning illustration",

  "3d render":
    "photorealistic 3D render, octane render or Blender cycles, ray-traced reflections, subsurface scattering, volumetric atmosphere, cinematic depth of field, PBR materials, studio HDR lighting, 4K resolution",

  sketch:
    "detailed pencil sketch, graphite on white paper, precise technical linework, cross-hatching for shadows, expressive gestural marks, concept art quality, clean white background",

  cinematic:
    "anamorphic cinema lens, movie still, dramatic Kodak 35mm film look, golden hour or magic hour lighting, epic widescreen composition, shallow depth of field, cinematic color grade with lifted shadows, blockbuster quality",

  "neon cyberpunk":
    "neon-lit cyberpunk aesthetic, rain-slicked streets reflection, holographic UI elements, volumetric neon glow, deep contrast darkness, cyan and magenta accent lights, futuristic urban environment, blade runner 2049 inspired",

  fantasy:
    "epic fantasy digital painting, highly detailed, dramatic magical lighting, intricate costume and environment design, rich jewel-tone color palette, bokeh particles of light, fantastical landscape, cinematic composition",

  architectural:
    "architectural photography, Canon EOS R5 with 24mm tilt-shift lens, blue hour lighting, perfect vertical lines, HDR detail, award-winning architectural digest quality, dramatic sky, long exposure",

  educational:
    "clean educational diagram, professional scientific illustration, white background, clear labeled elements, high contrast, pedagogical design, colorful but not garish, precise anatomical or technical accuracy",

  "flat design":
    "minimal flat design vector illustration, geometric bold shapes, harmonious color palette, modern icon style, clean negative space, professional graphic design, Dribbble quality",
}

// ─── Negative prompts (HuggingFace SD/SDXL) ──────────────────────────────────
export const NEGATIVE_PROMPTS: Record<string, string> = {
  realistic:
    "deformed face, asymmetrical eyes, crossed eyes, bad anatomy, blurry, low quality, distorted, ugly, mutated hands, extra fingers, missing fingers, watermark, text, signature, overexposed, underexposed, cartoon, painting, illustration, artificial, plastic skin, doll-like",
  portrait:
    "deformed iris, deformed pupils, bad eyes, asymmetrical face, ugly, poorly drawn face, bad anatomy, blurry, text, watermark, extra fingers, mutated hands, bad hands, long neck, skin blemishes, oversaturated",
  "3d animation":
    "photo realistic, blurry, low quality, bad proportions, deformed, ugly textures",
  "comic book":
    "photorealistic, 3d render, blurry, low quality, inconsistent style",
  default:
    "blurry, low quality, distorted, watermark, text, deformed, bad anatomy, ugly, oversaturated, underexposed",
}

// ─── Provider order ───────────────────────────────────────────────────────────
export const DEFAULT_IMAGE_PROVIDER_ORDER: Record<GenerationMode, ConcreteProviderId[]> = {
  fast:        ["stability", "pollinations", "openrouter", "together", "huggingface"],
  quality:     ["stability", "together", "openrouter", "gemini", "huggingface", "pollinations"],
  educational: ["gemini", "stability", "openrouter", "together", "huggingface", "pollinations"],
}

// ─── Model lists ──────────────────────────────────────────────────────────────

// Stability AI — api.stability.ai/v2beta
// Requiere: STABILITY_API_KEY en .env
export type StabilityModel = {
  id: string          // model name para el campo "model" del body
  endpoint: string    // "core" | "sd3"
  label: string       // nombre para mostrar
  supportsNegative: boolean
}

export const STABILITY_MODELS: StabilityModel[] = [
  // Stable Image Core — más rápido y barato (~$0.03/imagen), sin campo "model"
  { id: "core",               endpoint: "core", label: "Stable Image Core",      supportsNegative: true  },
  // SD3.5 Large Turbo — 4 pasos, rápido y de alta calidad (~$0.04/imagen)
  { id: "sd3.5-large-turbo",  endpoint: "sd3",  label: "SD3.5 Large Turbo",      supportsNegative: false },
  // SD3.5 Large — máxima calidad (~$0.065/imagen)
  { id: "sd3.5-large",        endpoint: "sd3",  label: "SD3.5 Large",            supportsNegative: true  },
  // SD3.5 Medium — equilibrio calidad/velocidad (~$0.035/imagen)
  { id: "sd3.5-medium",       endpoint: "sd3",  label: "SD3.5 Medium",           supportsNegative: true  },
]
  process.env.GEMINI_IMAGE_MODEL_PRIMARY,
  process.env.GEMINI_IMAGE_MODEL_SECONDARY,
  process.env.GEMINI_IMAGE_MODEL_TERTIARY,
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation",
].filter(Boolean) as string[]

export type TogetherImageModel = {
  id: string
  steps: number
  guidance: number
  useAspectRatio: boolean
}

export const TOGETHER_IMAGE_MODELS: TogetherImageModel[] = [
  // FLUX.2
  { id: "black-forest-labs/FLUX.2-pro",             steps: 35, guidance: 3.5, useAspectRatio: true  },
  { id: "black-forest-labs/FLUX.2-flex",            steps: 30, guidance: 3.5, useAspectRatio: true  },
  // Stable Diffusion 3.5 vía Together (~$0.0019/MP)
  { id: "stabilityai/stable-diffusion-3.5-large",   steps: 28, guidance: 7.0, useAspectRatio: false },
  { id: "stabilityai/stable-diffusion-3-medium",    steps: 28, guidance: 7.0, useAspectRatio: false },
  // FLUX.1.x
  { id: "black-forest-labs/FLUX.1-schnell",         steps: 4,  guidance: 0,   useAspectRatio: false },
  { id: "black-forest-labs/FLUX.1-dev",             steps: 25, guidance: 3.5, useAspectRatio: false },
]

export type HuggingFaceModel = {
  id: string
  steps: number
  guidance: number
  supportsNegative: boolean
}

export const HUGGINGFACE_IMAGE_MODELS: HuggingFaceModel[] = [
  { id: "black-forest-labs/FLUX.1-schnell",         steps: 4,  guidance: 0,   supportsNegative: false },
  { id: "stabilityai/stable-diffusion-xl-base-1.0", steps: 30, guidance: 7.5, supportsNegative: true  },
  { id: "stabilityai/stable-diffusion-3.5-large",   steps: 28, guidance: 7.0, supportsNegative: true  },
]

export const OPENROUTER_IMAGE_MODELS: { id: string; modalities: string[] }[] = [
  { id: "google/gemini-2.5-flash-image",         modalities: ["image", "text"] },
  { id: "google/gemini-3.1-flash-image-preview", modalities: ["image", "text"] },
  { id: "sourceful/riverflow-v2-fast",           modalities: ["image"] },
  { id: "bytedance-seed/seedream-4.5",           modalities: ["image"] },
  { id: "openai/gpt-5-image-mini",               modalities: ["image", "text"] },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function clamp(v: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, Math.round(v)))
}

export function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function safeText(res: Response): Promise<string> {
  try { return await res.text() } catch { return "" }
}

export function buildStructuredPrompt(subject: string, styleGuide: string, style: string): string {
  const isPortrait = style === "realistic" || style === "portrait"
  if (isPortrait) {
    // Sólo añade calidad de piel/ojos — sin forzar encuadre facial
    return `${subject}, ${styleGuide}, natural skin texture with visible pores, sharp detailed eyes with natural catchlights, detailed hair strands, masterpiece, best quality, highly detailed`
  }
  return `${subject}, ${styleGuide}, highly detailed, masterpiece, best quality`
}

export function basicPrompt(prompt: string, style: string): string {
  const guide = STYLE_GUIDES[style] || STYLE_GUIDES.realistic
  return buildStructuredPrompt(prompt, guide, style)
}

export function getNegativePrompt(style: string): string {
  return NEGATIVE_PROMPTS[style] || NEGATIVE_PROMPTS.default
}

export function aspectRatio(width: number, height: number): string {
  const r = width / height
  if (Math.abs(r - 1)       < 0.05)  return "1:1"
  if (Math.abs(r - 16 / 9)  < 0.15)  return "16:9"
  if (Math.abs(r - 9 / 16)  < 0.15)  return "9:16"
  if (Math.abs(r - 4 / 3)   < 0.15)  return "4:3"
  if (Math.abs(r - 3 / 4)   < 0.15)  return "3:4"
  if (Math.abs(r - 3 / 2)   < 0.15)  return "3:2"
  if (Math.abs(r - 2 / 3)   < 0.15)  return "2:3"
  return r >= 1 ? "16:9" : "9:16"
}

export function envPool(...names: string[]): string[] {
  return names.map(n => process.env[n]).filter(Boolean) as string[]
}

export function pickFromPool<T>(items: T[], seed?: string): T | null {
  if (!items.length) return null
  if (!seed) return items[Math.floor(Math.random() * items.length)]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return items[hash % items.length]
}

export function getPromptOptimizerKeys(): string[] {
  return envPool("GEMINI_API_KEY_PROMPT_1","GEMINI_API_KEY_PROMPT_2","GEMINI_API_KEY_PROMPT_3","GEMINI_API_KEY_PROMPT_4","GEMINI_API_KEY_IMAGE","GEMINI_API_KEY")
}
export function getGeminiImageKeys(): string[] {
  return envPool("GEMINI_API_KEY_IMAGE","GEMINI_API_KEY_IMAGE_2","GEMINI_API_KEY")
}
export function getGeminiTextKeys(): string[] {
  return envPool("GEMINI_API_KEY_TEXT","GEMINI_API_KEY")
}
export function getStabilityKeys(): string[] {
  return envPool("STABILITY_API_KEY_1","STABILITY_API_KEY_2","STABILITY_API_KEY")
}
export function getTogetherKeys(): string[] {
  return envPool("TOGETHER_API_KEY_1","TOGETHER_API_KEY_2","TOGETHER_API_KEY_3","TOGETHER_API_KEY")
}
export function getOpenRouterKeys(): string[] {
  return envPool("OPENROUTER_API_KEY_1","OPENROUTER_API_KEY_2","OPENROUTER_API_KEY_3","OPENROUTER_API_KEY")
}
export function getHuggingFaceTokens(): string[] {
  return envPool("HF_TOKEN_1","HF_TOKEN_2","HF_TOKEN_3","HF_TOKEN_4","HF_TOKEN_5")
}

export function parseProviderOrder(
  value: string | undefined,
  fallback: ConcreteProviderId[]
): ConcreteProviderId[] {
  if (!value?.trim()) return fallback
  const valid: ConcreteProviderId[] = ["stability","gemini","pollinations","together","huggingface","openrouter"]
  const parsed = value
    .split(",")
    .map(p => p.trim().toLowerCase())
    .filter((p): p is ConcreteProviderId => valid.includes(p as ConcreteProviderId))
  if (!parsed.length) return fallback
  const unique: ConcreteProviderId[] = []
  for (const p of parsed) { if (!unique.includes(p)) unique.push(p) }
  return unique
}

export function providerOrder(provider: ProviderId, mode: GenerationMode): ConcreteProviderId[] {
  if (provider !== "auto") return [provider]
  if (mode === "fast")    return parseProviderOrder(process.env.IMAGE_PROVIDER_ORDER_FAST,        DEFAULT_IMAGE_PROVIDER_ORDER.fast)
  if (mode === "quality") return parseProviderOrder(process.env.IMAGE_PROVIDER_ORDER_QUALITY,     DEFAULT_IMAGE_PROVIDER_ORDER.quality)
  return parseProviderOrder(process.env.IMAGE_PROVIDER_ORDER_EDUCATIONAL, DEFAULT_IMAGE_PROVIDER_ORDER.educational)
}

export function shouldOptimizePrompt(mode: GenerationMode, customPrompt?: string): boolean {
  if (customPrompt?.trim()) return false
  const enabled = (process.env.IMAGE_PROMPT_OPTIMIZER_ENABLED || "true").toLowerCase() === "true"
  if (!enabled) return false
  const optimizerMode = (process.env.IMAGE_PROMPT_OPTIMIZER_MODE || "quality_only").toLowerCase()
  if (optimizerMode === "always")           return true
  if (optimizerMode === "never")            return false
  if (optimizerMode === "quality_only")     return mode === "quality" || mode === "educational"
  if (optimizerMode === "educational_only") return mode === "educational"
  return mode === "quality" || mode === "educational"
}
