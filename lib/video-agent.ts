import { createHash } from "node:crypto"
import {
  getProviderApiKey,
  getProviderEndpoint,
  NormalizedVideoRequest,
  parseVideoProviderOrder,
  supportsRequest,
  VIDEO_PROVIDER_CONFIGS,
  type VideoProviderId,
  type VideoProviderResult,
} from "@/lib/video-config"
import { getRedis, rateLimit } from "@/lib/redis"

export interface VideoJobRecord {
  id: string
  user_id: string
  status: "queued" | "processing" | "completed" | "failed"
  request_hash: string
  request_payload: NormalizedVideoRequest
  provider?: VideoProviderId | null
  provider_model?: string | null
  video_url?: string | null
  audio_url?: string | null
  preview_image_url?: string | null
  error_message?: string | null
  attempts?: number | null
  created_at?: string
  updated_at?: string
}

export function buildVideoCacheKey(userId: string, request: NormalizedVideoRequest): string {
  return `video:job:${userId}:${hashVideoRequest(request)}`
}

export function hashVideoRequest(request: NormalizedVideoRequest): string {
  const normalized = JSON.stringify({
    prompt: request.prompt.toLowerCase().trim(),
    mode: request.mode,
    imageUrl: request.imageUrl || null,
    hasImageBase64: Boolean(request.imageBase64),
    durationSeconds: request.durationSeconds,
    extendToSeconds: request.extendToSeconds || null,
    aspectRatio: request.aspectRatio,
    fps: request.fps,
    style: request.style.toLowerCase().trim(),
    audio: {
      enabled: request.audio.enabled,
      hasTtsText: Boolean(request.audio.ttsText),
      audioUrl: request.audio.audioUrl || null,
    },
  })

  return createHash("sha256").update(normalized).digest("hex")
}

export function buildPromptWithStyle(request: NormalizedVideoRequest): string {
  return [request.prompt, request.style].filter(Boolean).join(", ")
}

export async function enforceVideoLimits(userId: string) {
  const perMinute = await rateLimit(`${userId}:video:minute`, 2, 60)
  if (!perMinute.allowed) {
    throw new Error(`Has alcanzado el límite temporal. Intenta nuevamente en ${perMinute.resetIn}s.`)
  }

  const perDay = await rateLimit(`${userId}:video:day`, 10, 60 * 60 * 24)
  if (!perDay.allowed) {
    throw new Error("Has alcanzado el máximo diario de videos para este plan.")
  }
}

export async function getCachedCompletedVideo(userId: string, request: NormalizedVideoRequest): Promise<VideoJobRecord | null> {
  const redis = getRedis()
  if (!redis) return null

  const key = buildVideoCacheKey(userId, request)
  try {
    return await redis.get<VideoJobRecord>(key)
  } catch {
    return null
  }
}

export async function setCachedCompletedVideo(userId: string, request: NormalizedVideoRequest, job: VideoJobRecord) {
  const redis = getRedis()
  if (!redis) return

  const key = buildVideoCacheKey(userId, request)
  try {
    await redis.set(key, job, { ex: 60 * 60 * 24 * 3 })
  } catch {
    // noop
  }
}

export function getPreferredProviders(request: NormalizedVideoRequest): VideoProviderId[] {
  const configured = parseVideoProviderOrder()
  return configured.filter((provider) => supportsRequest(provider, request) && Boolean(getProviderEndpoint(provider)))
}

async function callProvider(provider: VideoProviderId, request: NormalizedVideoRequest, jobId: string): Promise<VideoProviderResult> {
  const cfg = VIDEO_PROVIDER_CONFIGS[provider]
  const endpoint = getProviderEndpoint(provider)
  if (!endpoint) {
    return {
      ok: false,
      provider,
      model: cfg.model,
      error: `No endpoint configured for ${provider}`,
    }
  }

  const apiKey = getProviderApiKey(provider)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Video-Job": jobId,
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const payload = {
    prompt: buildPromptWithStyle(request),
    mode: request.mode,
    image_url: request.imageUrl,
    image_base64: request.imageBase64,
    duration_seconds: request.durationSeconds,
    extend_to_seconds: request.extendToSeconds,
    fps: request.fps,
    aspect_ratio: request.aspectRatio,
    audio: request.audio,
    output_format: "mp4",
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    return {
      ok: false,
      provider,
      model: cfg.model,
      raw: data,
      error: data?.error || `HTTP ${res.status}`,
    }
  }

  return {
    ok: Boolean(data?.video_url),
    provider,
    model: data?.model || cfg.model,
    videoUrl: data?.video_url,
    audioUrl: data?.audio_url,
    previewImageUrl: data?.preview_image_url,
    raw: data,
    error: data?.video_url ? undefined : "El proveedor respondió sin video_url",
  }
}

export async function executeVideoJob(request: NormalizedVideoRequest, jobId: string): Promise<VideoProviderResult> {
  const providers = getPreferredProviders(request)
  if (!providers.length) {
    return {
      ok: false,
      provider: "ltx",
      model: VIDEO_PROVIDER_CONFIGS.ltx.model,
      error: "No hay endpoints de video configurados. Define LTX_VIDEO_ENDPOINT o COGVIDEOX_ENDPOINT o HUNYUAN_I2V_ENDPOINT.",
    }
  }

  let lastError: VideoProviderResult | null = null

  for (const provider of providers) {
    const result = await callProvider(provider, request, jobId)
    if (result.ok) return result
    lastError = result
  }

  return lastError || {
    ok: false,
    provider: providers[0],
    model: VIDEO_PROVIDER_CONFIGS[providers[0]].model,
    error: "Todos los proveedores fallaron.",
  }
}
