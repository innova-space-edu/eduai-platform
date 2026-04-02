export type VideoProviderId = "ltx" | "hunyuan_i2v"

export type VideoModeInput =
  | "text-to-video"
  | "image-to-video"
  | "text_to_video"
  | "image_to_video"

export type NormalizedVideoMode = "text_to_video" | "image_to_video"

export type VideoJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "canceled"

export interface VideoAudioOptions {
  enabled: boolean
  ttsText?: string
  audioUrl?: string
}

export interface VideoRequestInput {
  prompt: string
  mode: VideoModeInput
  imageUrl?: string | null
  imageBase64?: string
  durationSeconds?: number
  extendToSeconds?: number
  aspectRatio?: "16:9" | "9:16" | "1:1"
  fps?: number
  style?: string
  includeAudio?: boolean
  audioPrompt?: string
  audio?: VideoAudioOptions
}

export interface NormalizedVideoRequest {
  prompt: string
  mode: NormalizedVideoMode
  imageUrl?: string
  imageBase64?: string
  durationSeconds: number
  extendToSeconds?: number
  aspectRatio: "16:9" | "9:16" | "1:1"
  fps: number
  style: string
  audio: VideoAudioOptions
}

export interface VideoProviderResult {
  ok: boolean
  provider: VideoProviderId
  model: string
  videoUrl?: string
  audioUrl?: string
  previewImageUrl?: string
  queueRequestId?: string
  raw?: unknown
  error?: string
}

export const DEFAULT_VIDEO_PROVIDER_ORDER: VideoProviderId[] = [
  "ltx",
  "hunyuan_i2v",
]

export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function normalizeVideoMode(
  mode: VideoModeInput | undefined
): NormalizedVideoMode {
  if (mode === "image-to-video" || mode === "image_to_video") {
    return "image_to_video"
  }
  return "text_to_video"
}

export function normalizeVideoRequest(
  input: VideoRequestInput
): NormalizedVideoRequest {
  const mode = normalizeVideoMode(input.mode)
  const requested = clampInt(input.durationSeconds, 1, 10, 6)
  const durationSeconds = Math.min(requested, 6)
  const extendToSeconds =
    requested > 6 ? Math.min(requested, 10) : undefined

  const fps = clampInt(input.fps, 6, 12, 8)
  const includeAudio = Boolean(input.includeAudio || input.audio?.enabled)
  const normalizedAudioText =
    input.audioPrompt?.trim() || input.audio?.ttsText?.trim() || undefined

  return {
    prompt: String(input.prompt || "").trim(),
    mode,
    imageUrl: input.imageUrl?.trim() || undefined,
    imageBase64: input.imageBase64?.trim() || undefined,
    durationSeconds,
    extendToSeconds,
    aspectRatio:
      input.aspectRatio === "9:16" || input.aspectRatio === "1:1"
        ? input.aspectRatio
        : "16:9",
    fps,
    style: input.style?.trim() || "educational cinematic",
    audio: {
      enabled: includeAudio,
      ttsText: includeAudio ? normalizedAudioText : undefined,
      audioUrl: input.audio?.audioUrl?.trim() || undefined,
    },
  }
}

export function parseVideoProviderOrder(): VideoProviderId[] {
  const raw = (process.env.VIDEO_PROVIDER_ORDER || "").trim()
  if (!raw) return DEFAULT_VIDEO_PROVIDER_ORDER

  const valid = new Set<VideoProviderId>(["ltx", "hunyuan_i2v"])
  const deduped: VideoProviderId[] = []

  for (const part of raw.split(",").map((v) => v.trim().toLowerCase())) {
    if (
      valid.has(part as VideoProviderId) &&
      !deduped.includes(part as VideoProviderId)
    ) {
      deduped.push(part as VideoProviderId)
    }
  }

  return deduped.length ? deduped : DEFAULT_VIDEO_PROVIDER_ORDER
}

export function getFalModelForRequest(
  provider: VideoProviderId,
  request: NormalizedVideoRequest
): string | null {
  if (provider === "ltx") {
    if (request.mode === "image_to_video") {
      return process.env.FAL_LTX_IMAGE_MODEL?.trim() || null
    }
    return process.env.FAL_LTX_TEXT_MODEL?.trim() || null
  }

  if (provider === "hunyuan_i2v") {
    if (request.mode === "image_to_video") return null
    return process.env.FAL_HUNYUAN_TEXT_MODEL?.trim() || null
  }

  return null
}

export function supportsRequest(
  provider: VideoProviderId,
  request: NormalizedVideoRequest
): boolean {
  if (request.audio.enabled) {
    return false
  }

  if (provider === "hunyuan_i2v" && request.mode === "image_to_video") {
    return false
  }

  return Boolean(getFalModelForRequest(provider, request))
}
