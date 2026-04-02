import crypto from "crypto"
import { fal } from "@fal-ai/client"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import {
  getFalModelForRequest,
  normalizeVideoRequest,
  parseVideoProviderOrder,
  supportsRequest,
  type NormalizedVideoRequest,
  type VideoProviderId,
  type VideoProviderResult,
} from "@/lib/video-config"

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

type VideoJobRow = {
  id: string
  user_id: string
  status: "queued" | "processing" | "completed" | "failed" | "canceled"
  request_hash: string
  request_payload: Json
  attempts: number
  provider: string | null
  provider_model: string | null
  provider_request_id: string | null
  video_url: string | null
  audio_url: string | null
  preview_image_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

const DAILY_VIDEO_LIMIT = Number(process.env.VIDEO_DAILY_LIMIT || 12)
const ACTIVE_VIDEO_LIMIT = Number(process.env.VIDEO_ACTIVE_LIMIT || 1)

if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  })
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para video-agent."
    )
  }

  return createSupabaseClient(url, key)
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input)
  }

  if (Array.isArray(input)) {
    return `[${input.map((v) => stableStringify(v)).join(",")}]`
  }

  const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`
}

export function hashVideoRequest(input: NormalizedVideoRequest): string {
  const normalized = normalizeVideoRequest(input)
  const payload = {
    prompt: normalized.prompt,
    mode: normalized.mode,
    imageUrl: normalized.imageUrl || null,
    imageBase64: normalized.imageBase64 ? "[inline-image]" : null,
    durationSeconds: normalized.durationSeconds,
    extendToSeconds: normalized.extendToSeconds || null,
    aspectRatio: normalized.aspectRatio,
    fps: normalized.fps,
    style: normalized.style,
    audio: {
      enabled: normalized.audio.enabled,
      ttsText: normalized.audio.ttsText || null,
      audioUrl: normalized.audio.audioUrl || null,
    },
  }

  return crypto
    .createHash("sha256")
    .update(stableStringify(payload))
    .digest("hex")
}

export async function enforceVideoLimits(userId: string) {
  const supabase = getAdminSupabase()

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const [{ count: dailyCount, error: dailyError }, { count: activeCount, error: activeError }] =
    await Promise.all([
      supabase
        .from("video_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfDay.toISOString()),
      supabase
        .from("video_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["queued", "processing"]),
    ])

  if (dailyError) throw new Error(dailyError.message)
  if (activeError) throw new Error(activeError.message)

  if ((dailyCount || 0) >= DAILY_VIDEO_LIMIT) {
    throw new Error(
      `Has alcanzado el límite diario de ${DAILY_VIDEO_LIMIT} videos.`
    )
  }

  if ((activeCount || 0) >= ACTIVE_VIDEO_LIMIT) {
    throw new Error(
      "Ya tienes un video en cola o procesándose. Espera a que termine antes de crear otro."
    )
  }
}

export async function getCachedCompletedVideo(
  userId: string,
  request: NormalizedVideoRequest
): Promise<VideoJobRow | null> {
  const supabase = getAdminSupabase()
  const requestHash = hashVideoRequest(request)

  const { data, error } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("request_hash", requestHash)
    .eq("status", "completed")
    .not("video_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as VideoJobRow | null) || null
}

export async function getNextQueuedVideoJob(): Promise<VideoJobRow | null> {
  const supabase = getAdminSupabase()

  const { data, error } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as VideoJobRow | null) || null
}

export async function markVideoJobProcessing(jobId: string) {
  const supabase = getAdminSupabase()

  const { data, error } = await supabase
    .from("video_jobs")
    .update({
      status: "processing",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return data as VideoJobRow
}

export async function completeVideoJob(params: {
  jobId: string
  provider: string
  providerModel: string
  queueRequestId?: string | null
  videoUrl: string
  audioUrl?: string | null
  previewImageUrl?: string | null
}) {
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from("video_jobs")
    .update({
      status: "completed",
      provider: params.provider,
      provider_model: params.providerModel,
      provider_request_id: params.queueRequestId || null,
      video_url: params.videoUrl,
      audio_url: params.audioUrl || null,
      preview_image_url: params.previewImageUrl || null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.jobId)

  if (error) throw new Error(error.message)
}

export async function failVideoJob(params: {
  jobId: string
  errorMessage: string
}) {
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from("video_jobs")
    .update({
      status: "failed",
      error_message: params.errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.jobId)

  if (error) throw new Error(error.message)
}

export async function setVideoJobProviderRequestId(params: {
  jobId: string
  provider: string
  providerModel: string
  queueRequestId: string
}) {
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from("video_jobs")
    .update({
      provider: params.provider,
      provider_model: params.providerModel,
      provider_request_id: params.queueRequestId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.jobId)

  if (error) throw new Error(error.message)
}

function extractVideoUrl(data: any): string | null {
  if (!data) return null

  if (typeof data.video?.url === "string") return data.video.url
  if (typeof data.video_url === "string") return data.video_url
  if (typeof data.output_url === "string") return data.output_url

  if (Array.isArray(data.videos) && typeof data.videos[0]?.url === "string") {
    return data.videos[0].url
  }

  return null
}

function buildFalArguments(request: NormalizedVideoRequest) {
  const args: Record<string, unknown> = {
    prompt: request.prompt,
  }

  if (request.imageUrl) {
    args.image_url = request.imageUrl
  }

  if (request.mode === "image_to_video") {
    args.image_url = request.imageUrl
  }

  return args
}

export async function processVideoJob(
  job: VideoJobRow
): Promise<VideoProviderResult> {
  if (!process.env.FAL_KEY) {
    return {
      ok: false,
      provider: "ltx",
      model: "missing-fal-key",
      error: "Falta FAL_KEY en variables de entorno.",
    }
  }

  const request = normalizeVideoRequest(job.request_payload as any)

  if (!request.prompt) {
    return {
      ok: false,
      provider: "ltx",
      model: "invalid-request",
      error: "El job no tiene prompt válido.",
    }
  }

  const providers = parseVideoProviderOrder()
  let lastError = "No fue posible generar el video con ningún proveedor."

  for (const provider of providers) {
    if (!supportsRequest(provider, request)) continue

    const modelId = getFalModelForRequest(provider, request)
    if (!modelId) continue

    try {
      const result = await fal.subscribe(modelId, {
        input: buildFalArguments(request),
      })

      const videoUrl = extractVideoUrl((result as any)?.data ?? result)
      if (!videoUrl) {
        lastError = `El modelo ${modelId} no devolvió una URL de video válida.`
        continue
      }

      return {
        ok: true,
        provider,
        model: modelId,
        videoUrl,
        raw: result,
      }
    } catch (error: any) {
      lastError =
        error?.message || `Falló el proveedor ${provider} (${modelId}).`
    }
  }

  return {
    ok: false,
    provider: "ltx",
    model: "none",
    error: lastError,
  }
}
