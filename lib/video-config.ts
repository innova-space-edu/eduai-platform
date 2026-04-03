/**
 * ============================================
 * CONFIGURACIÓN GENERAL DE VIDEO
 * ============================================
 */

export const VIDEO_MAX_DURATION = 10
export const VIDEO_DEFAULT_DURATION = 6

/**
 * ============================================
 * VARIABLES DE ENTORNO
 * ============================================
 */

export const HF_VIDEO_ENDPOINT =
  process.env.HF_VIDEO_ENDPOINT || ""

export const HF_API_TOKEN =
  process.env.HF_API_TOKEN || ""

export const REPLICATE_API_TOKEN =
  process.env.REPLICATE_API_TOKEN || ""

export const REPLICATE_VIDEO_MODEL =
  process.env.REPLICATE_VIDEO_MODEL || "minimax/video-01"

export const FAL_API_KEY =
  process.env.FAL_API_KEY || ""

/**
 * ============================================
 * TIPOS DE PROVIDERS
 * ============================================
 */

export type VideoProvider =
  | "replicate"
  | "hf-space"
  | "fal"
  | "ltx"
  | "cogvideox"
  | "hunyuan"

/**
 * ============================================
 * ORDEN DE PROVIDERS
 * ============================================
 */

export function getProviderOrder(): VideoProvider[] {
  const raw = process.env.VIDEO_PROVIDER_ORDER || "replicate,hf-space"

  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean) as VideoProvider[]
}

/**
 * ============================================
 * VALIDACIÓN DE PROVIDERS
 * ============================================
 */

export function isProviderConfigured(provider: VideoProvider): boolean {
  switch (provider) {
    case "replicate":
      return Boolean(REPLICATE_API_TOKEN)

    case "hf-space":
      return Boolean(HF_VIDEO_ENDPOINT)

    case "fal":
    case "ltx":
    case "cogvideox":
    case "hunyuan":
      return Boolean(FAL_API_KEY)

    default:
      return false
  }
}

/**
 * ============================================
 * NORMALIZACIÓN DE INPUTS
 * ============================================
 */

export function normalizeDuration(input?: number | null): number {
  if (!input || isNaN(input)) {
    return VIDEO_DEFAULT_DURATION
  }

  const value = Math.floor(input)

  if (value < 2) return 2
  if (value > VIDEO_MAX_DURATION) return VIDEO_MAX_DURATION

  return value
}

export function normalizeMode(
  mode?: string | null
): "text_to_video" | "image_to_video" {
  if (!mode) return "text_to_video"

  const m = mode.toLowerCase()

  if (m.includes("image")) return "image_to_video"

  return "text_to_video"
}

/**
 * ============================================
 * UTILIDADES
 * ============================================
 */

export function isTextToVideo(mode?: string | null): boolean {
  return normalizeMode(mode) === "text_to_video"
}

export function isImageToVideo(mode?: string | null): boolean {
  return normalizeMode(mode) === "image_to_video"
}
