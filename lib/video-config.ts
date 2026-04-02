export type VideoProvider =
  | "hf-space"
  | "replicate"
  | "fal"
  | "ltx"
  | "cogvideox"
  | "hunyuan"

export const VIDEO_PROVIDER_ORDER: VideoProvider[] = (
  process.env.VIDEO_PROVIDER_ORDER || "hf-space,replicate,fal"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean) as VideoProvider[]

export const HF_VIDEO_ENDPOINT = process.env.HF_VIDEO_ENDPOINT || ""
export const HF_API_TOKEN = process.env.HF_API_TOKEN || ""

export const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ""
export const FAL_KEY = process.env.FAL_KEY || ""

export const VIDEO_PROCESS_SECRET =
  process.env.VIDEO_PROCESS_SECRET || process.env.CRON_SECRET || ""

export const VIDEO_DEFAULT_DURATION = 6
export const VIDEO_MAX_DURATION = 10

export const VIDEO_ALLOWED_DURATIONS = [6, 10]

export const VIDEO_DEFAULT_MODE = "text_to_video"
export const VIDEO_ALLOWED_MODES = ["text_to_video", "image_to_video"]

export function normalizeDuration(value?: number | null): number {
  if (!value) return VIDEO_DEFAULT_DURATION
  if (VIDEO_ALLOWED_DURATIONS.includes(value)) return value
  return VIDEO_DEFAULT_DURATION
}

export function normalizeMode(value?: string | null): "text_to_video" | "image_to_video" {
  if (value === "image_to_video") return "image_to_video"
  return "text_to_video"
}

export function getProviderOrder(): VideoProvider[] {
  return VIDEO_PROVIDER_ORDER
}

export function isProviderConfigured(provider: VideoProvider): boolean {
  switch (provider) {
    case "hf-space":
      return Boolean(HF_VIDEO_ENDPOINT)
    case "replicate":
      return Boolean(REPLICATE_API_TOKEN)
    case "fal":
    case "ltx":
    case "cogvideox":
    case "hunyuan":
      return Boolean(FAL_KEY)
    default:
      return false
  }
}
