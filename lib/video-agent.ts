import crypto from "crypto"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import {
  getProviderApiKey,
  getProviderEndpoint,
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
  video_url: string | null
  audio_url: string | null
  preview_image_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

type ProviderCallResult = {
  ok: boolean
  status?: "queued" | "processing" | "completed" | "failed"
  videoUrl?: string
  audioUrl?: string
  previewImageUrl?: string
  providerJobId?: string
  raw?: unknown
  error?: string
}

const DAILY_VIDEO_LIMIT = Number(process.env.VIDEO_DAILY_LIMIT || 12)
const ACTIVE_VIDEO_LIMIT = Number(process.env.VIDEO_ACTIVE_LIMIT || 1)
const MAX_ATTEMPTS_PER_JOB = Number(process.env.VIDEO_MAX_ATTEMPTS || 3)

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

  if (error) {
    throw new Error(error.message)
  }

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
      attempts: 1,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return data as VideoJobRow
}

export async function bumpVideoJobAttempt(jobId: string, attempts: number) {
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from("video_jobs")
    .update({
      attempts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)

  if (error) throw new Error(error.message)
}

export async function completeVideoJob(params: {
  jobId: string
  provider: string
  providerModel: string
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
  attempts?: number
}) {
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from("video_jobs")
    .update({
      status: "failed",
      error_message: params.errorMessage,
      attempts: params.attempts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.jobId)

  if (error) throw new Error(error.message)
}

function normalizeProviderResponse(
  provider: VideoProviderId,
  raw: any
): ProviderCallResult {
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      status: "failed",
      error: "Respuesta vacía o inválida del proveedor.",
      raw,
    }
  }

  const status =
    raw.status === "queued" ||
    raw.status === "processing" ||
    raw.status === "completed" ||
    raw.status === "failed"
      ? raw.status
      : raw.videoUrl || raw.video_url || raw.output_url
      ? "completed"
      : "failed"

  const videoUrl =
    raw.videoUrl || raw.video_url || raw.output_url || raw.url || null

  const audioUrl = raw.audioUrl || raw.audio_url || null
  const previewImageUrl =
    raw.previewImageUrl || raw.preview_image_url || raw.thumbnail_url || null

  if (status === "completed" && videoUrl) {
    return {
      ok: true,
      status,
      videoUrl,
      audioUrl,
      previewImageUrl,
      raw,
    }
  }

  if (status === "queued" || status === "processing") {
    return {
      ok: true,
      status,
      providerJobId: raw.jobId || raw.job_id || raw.id || undefined,
      raw,
    }
  }

  return {
    ok: false,
    status: "failed",
    error: raw.error || raw.message || "El proveedor no devolvió un video válido.",
    raw,
  }
}

async function callVideoProvider(
  provider: VideoProviderId,
  request: NormalizedVideoRequest
): Promise<ProviderCallResult> {
  const endpoint = getProviderEndpoint(provider)
  if (!endpoint) {
    return {
      ok: false,
      status: "failed",
      error: `No existe endpoint configurado para ${provider}.`,
    }
  }

  const apiKey = getProviderApiKey(provider)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const payload = {
    prompt: request.prompt,
    mode: request.mode,
    imageUrl: request.imageUrl,
    imageBase64: request.imageBase64,
    durationSeconds: request.durationSeconds,
    extendToSeconds: request.extendToSeconds,
    aspectRatio: request.aspectRatio,
    fps: request.fps,
    style: request.style,
    audio: request.audio,
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  let raw: any = null
  try {
    raw = await res.json()
  } catch {
    raw = null
  }

  if (!res.ok) {
    return {
      ok: false,
      status: "failed",
      error:
        raw?.error ||
        raw?.message ||
        `Proveedor ${provider} respondió ${res.status}.`,
      raw,
    }
  }

  return normalizeProviderResponse(provider, raw)
}

export async function processVideoJob(
  job: VideoJobRow
): Promise<VideoProviderResult> {
  const request = normalizeVideoRequest(job.request_payload as any)

  if (!request.prompt) {
    return {
      ok: false,
      provider: "ltx",
      model: "unknown",
      error: "El job no tiene prompt válido.",
    }
  }

  const providers = parseVideoProviderOrder()

  let lastError = "No fue posible generar el video con ningún proveedor."

  for (const provider of providers) {
    if (!supportsRequest(provider, request)) continue

    const endpoint = getProviderEndpoint(provider)
    if (!endpoint) continue

    const attempts = Math.min((job.attempts || 0) + 1, MAX_ATTEMPTS_PER_JOB)
    await bumpVideoJobAttempt(job.id, attempts)

    const result = await callVideoProvider(provider, request)

    if (result.ok && result.status === "completed" && result.videoUrl) {
      return {
        ok: true,
        provider,
        model: endpoint,
        videoUrl: result.videoUrl,
        audioUrl: result.audioUrl,
        previewImageUrl: result.previewImageUrl,
        raw: result.raw,
      }
    }

    if (result.ok && (result.status === "queued" || result.status === "processing")) {
      return {
        ok: false,
        provider,
        model: endpoint,
        raw: result.raw,
        error:
          "El proveedor dejó el trabajo en estado asíncrono. Debes implementar polling externo para ese endpoint.",
      }
    }

    lastError = result.error || lastError
  }

  return {
    ok: false,
    provider: "ltx",
    model: "none",
    error: lastError,
  }
}
