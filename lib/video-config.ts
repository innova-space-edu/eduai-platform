export type VideoProviderId = "ltx" | "cogvideox" | "hunyuan_i2v"

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

export interface VideoProviderConfig {
  id: VideoProviderId
  label: string
  model: string
  endpointEnv: string
  keyEnv?: string
  supportsImageToVideo: boolean
  supportsAudio: boolean
  priority: number
}

export interface VideoProviderResult {
  ok: boolean
  provider: VideoProviderId
  model: string
  videoUrl?: string
  audioUrl?: string
  previewImageUrl?: string
  raw?: unknown
  error?: string
}

export const DEFAULT_VIDEO_PROVIDER_ORDER: VideoProviderId[] = [
  "ltx",
  "cogvideox",
  "hunyuan_i2v",
]

export const VIDEO_PROVIDER_CONFIGS: Record<
  VideoProviderId,
  VideoProviderConfig
> = {
  ltx: {
    id: "ltx",
    label: "LTX",
    model: process.env.LTX_VIDEO_MODEL || "Lightricks/LTX-Video",
    endpointEnv: "LTX_VIDEO_ENDPOINT",
    keyEnv: "LTX_VIDEO_API_KEY",
    supportsImageToVideo: true,
    supportsAudio: true,
    priority: 1,
  },
  cogvideox: {
    id: "cogvideox",
    label: "CogVideoX",
    model: process.env.COGVIDEOX_MODEL || "zai-org/CogVideoX-5b",
    endpointEnv: "COGVIDEOX_ENDPOINT",
    keyEnv: "COGVIDEOX_API_KEY",
    supportsImageToVideo: false,
    supportsAudio: false,
    priority: 2,
  },
  hunyuan_i2v: {
    id: "hunyuan_i2v",
    label: "HunyuanVideo-I2V",
    model:
      process.env.HUNYUAN_I2V_MODEL || "Tencent-Hunyuan/HunyuanVideo-I2V",
    endpointEnv: "HUNYUAN_I2V_ENDPOINT",
    keyEnv: "HUNYUAN_I2V_API_KEY",
    supportsImageToVideo: true,
    supportsAudio: false,
    priority: 3,
  },
}

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
  const durationSeconds = clampInt(input.durationSeconds, 1, 6, 6)

  const requestedExtension = clampInt(
    input.extendToSeconds ?? input.durationSeconds ?? 0,
    0,
    10,
    0
  )

  const extendToSeconds =
    requestedExtension > durationSeconds ? requestedExtension : undefined

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

  const valid = new Set<VideoProviderId>(["ltx", "cogvideox", "hunyuan_i2v"])
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

export function getProviderEndpoint(provider: VideoProviderId): string | null {
  const cfg = VIDEO_PROVIDER_CONFIGS[provider]
  const endpoint = process.env[cfg.endpointEnv]
  return endpoint?.trim() || null
}

export function getProviderApiKey(provider: VideoProviderId): string | null {
  const cfg = VIDEO_PROVIDER_CONFIGS[provider]
  const keyName = cfg.keyEnv
  if (!keyName) return null
  const key = process.env[keyName]
  return key?.trim() || null
}

export function supportsRequest(
  provider: VideoProviderId,
  request: NormalizedVideoRequest
): boolean {
  const cfg = VIDEO_PROVIDER_CONFIGS[provider]
  if (request.mode === "image_to_video" && !cfg.supportsImageToVideo) {
    return false
  }
  if (request.audio.enabled && !cfg.supportsAudio) {
    return false
  }
  return true
}
