import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { processVideoJob, type ProcessVideoJobResult } from "@/lib/video-agent"
import { captureVideoCredits, releaseVideoCredits } from "@/lib/credits/server"
import { pollFalPremiumVideo, startFalPremiumVideo } from "@/lib/video/providers/fal-premium"

export const runtime = "nodejs"
export const maxDuration = 60

type JobStatus = "queued" | "processing" | "completed" | "failed" | "blocked" | "canceled"
type RequestPayload = Record<string, unknown>

type VideoJobRow = {
  id: string
  user_id: string
  status: JobStatus
  plan?: string | null
  mode?: string | null
  prompt?: string | null
  style?: string | null
  duration_seconds?: number | null
  include_audio?: boolean | null
  image_url?: string | null
  provider?: string | null
  model?: string | null
  operation_name?: string | null
  asset_id?: string | null
  request_payload?: RequestPayload | null
  response_payload?: Record<string, unknown> | null
  moderation_payload?: Record<string, unknown> | null
  video_url?: string | null
  thumbnail_url?: string | null
  error_message?: string | null
  retry_count?: number | null
  reuse_count?: number | null
  started_at?: string | null
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}

function getProgressFromStatus(status: JobStatus): number {
  if (status === "queued") return 10
  if (status === "processing") return 60
  if (status === "completed") return 100
  if (["failed", "blocked", "canceled"].includes(status)) return 100
  return 0
}

function getStatusLabel(status: JobStatus): string {
  const labels: Record<JobStatus, string> = {
    queued: "En cola",
    processing: "Procesando",
    completed: "Completado",
    failed: "Falló",
    blocked: "Bloqueado",
    canceled: "Cancelado",
  }
  return labels[status] || "Desconocido"
}

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdmin(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function parseSupabaseAssetUrl(value: string | null | undefined) {
  if (!value?.startsWith("supabase://")) return null
  const remainder = value.slice("supabase://".length)
  const slash = remainder.indexOf("/")
  if (slash <= 0) return null
  return { bucket: remainder.slice(0, slash), path: remainder.slice(slash + 1) }
}

async function resolvePrivateUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  value: string | null | undefined
) {
  if (!value) return null
  const parsed = parseSupabaseAssetUrl(value)
  if (!parsed) return value
  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 30)
  return error ? null : data?.signedUrl || null
}

function requestString(payload: RequestPayload | null | undefined, key: string, fallback = "") {
  const value = payload?.[key]
  return typeof value === "string" ? value : fallback
}

function requestNumber(payload: RequestPayload | null | undefined, key: string, fallback: number) {
  const value = payload?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function requestBoolean(payload: RequestPayload | null | undefined, key: string, fallback: boolean) {
  const value = payload?.[key]
  return typeof value === "boolean" ? value : fallback
}

async function runCurrentJob(job: VideoJobRow): Promise<ProcessVideoJobResult> {
  const prompt = job.prompt || requestString(job.request_payload, "prompt", "Video EduAI")
  const style = job.style || requestString(job.request_payload, "style", "")
  const duration = job.duration_seconds ?? requestNumber(job.request_payload, "duration", 6)
  const withAudio = job.include_audio ?? requestBoolean(job.request_payload, "withAudio", false)
  const mode = job.mode || requestString(job.request_payload, "mode", "text_to_video")
  const imageUrl = job.image_url || requestString(job.request_payload, "imageUrl", "") || null
  const aspectRatio = requestString(job.request_payload, "aspectRatio", "16:9")
  const resolution = requestString(job.request_payload, "resolution", "720p")

  if (job.provider === "fal") {
    if (job.operation_name) {
      return pollFalPremiumVideo({
        operationName: job.operation_name,
        prompt,
        userId: job.user_id,
        sourceJobId: job.id,
        model: job.model || null,
      })
    }

    const modelKey = requestString(job.request_payload, "modelKey", "")
    if (!modelKey) return { ok: false, status: "failed", provider: "fal", error: "Falta modelKey en el job premium." }
    return startFalPremiumVideo({
      modelKey,
      prompt,
      style,
      duration,
      withAudio,
      mode: mode === "image_to_video" ? "image_to_video" : "text_to_video",
      imageUrl,
      aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9",
      resolution: resolution === "4k" ? "4k" : resolution === "1080p" ? "1080p" : "720p",
      userId: job.user_id,
    })
  }

  return processVideoJob({
    prompt,
    style,
    duration,
    withAudio,
    mode,
    imageUrl,
    aspectRatio,
    resolution,
    operationName: job.operation_name || null,
    userId: job.user_id,
    sourceJobId: job.id,
    provider: job.provider || null,
    model: job.model || null,
  })
}

async function releaseCreditsQuietly(jobId: string, reason: string) {
  try {
    await releaseVideoCredits(jobId, reason)
  } catch (error) {
    console.warn("[Video status][credits release]", error instanceof Error ? error.message : String(error))
  }
}

async function completeJob(
  admin: NonNullable<ReturnType<typeof getAdminSupabase>>,
  current: VideoJobRow,
  result: ProcessVideoJobResult
): Promise<VideoJobRow> {
  const now = new Date().toISOString()
  const { error } = await admin
    .from("video_jobs")
    .update({
      status: "completed",
      provider: result.provider || current.provider,
      model: result.model || current.model,
      operation_name: result.operationName || current.operation_name || null,
      asset_id: result.assetId || current.asset_id || null,
      video_url: result.videoUrl,
      thumbnail_url: result.thumbnailUrl || current.thumbnail_url || null,
      response_payload: result.raw || current.response_payload || null,
      error_message: null,
      completed_at: now,
    })
    .eq("id", current.id)
    .eq("user_id", current.user_id)
  if (error) throw new Error(error.message)

  await captureVideoCredits(current.id)

  return {
    ...current,
    status: "completed",
    provider: result.provider || current.provider,
    model: result.model || current.model,
    operation_name: result.operationName || current.operation_name || null,
    asset_id: result.assetId || current.asset_id || null,
    video_url: result.videoUrl || current.video_url || null,
    thumbnail_url: result.thumbnailUrl || current.thumbnail_url || null,
    response_payload: result.raw || current.response_payload || null,
    error_message: null,
    completed_at: now,
    updated_at: now,
  }
}

async function failJob(
  admin: NonNullable<ReturnType<typeof getAdminSupabase>>,
  current: VideoJobRow,
  result: ProcessVideoJobResult
): Promise<VideoJobRow> {
  const now = new Date().toISOString()
  const failedStatus: JobStatus = result.status === "blocked" ? "blocked" : "failed"
  const message = result.moderationReason || result.error || "No fue posible generar el video."

  const { error } = await admin
    .from("video_jobs")
    .update({
      status: failedStatus,
      provider: result.provider || current.provider || null,
      model: result.model || current.model || null,
      operation_name: result.operationName || current.operation_name || null,
      response_payload: result.raw || current.response_payload || null,
      error_message: message,
      completed_at: now,
      retry_count: Number(current.retry_count || 0) + 1,
    })
    .eq("id", current.id)
    .eq("user_id", current.user_id)
  if (error) throw new Error(error.message)

  await releaseCreditsQuietly(current.id, message)

  return {
    ...current,
    status: failedStatus,
    provider: result.provider || current.provider || null,
    model: result.model || current.model || null,
    operation_name: result.operationName || current.operation_name || null,
    response_payload: result.raw || current.response_payload || null,
    error_message: message,
    completed_at: now,
    retry_count: Number(current.retry_count || 0) + 1,
    updated_at: now,
  }
}

async function maybeAdvanceVideoJob(job: VideoJobRow): Promise<VideoJobRow> {
  const admin = getAdminSupabase()
  if (!admin) return job
  let current = job

  if (current.status === "queued") {
    const startedAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await admin
      .from("video_jobs")
      .update({ status: "processing", error_message: null, started_at: current.started_at || startedAt })
      .eq("id", current.id)
      .eq("user_id", current.user_id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle()

    if (claimError) {
      console.warn("[Video status][autostart]", claimError.message)
      return current
    }
    if (!claimed) return current

    current = { ...current, status: "processing", started_at: current.started_at || startedAt, updated_at: startedAt }

    try {
      const result = await runCurrentJob(current)
      if (result.ok && result.status === "processing") {
        const now = new Date().toISOString()
        const { error } = await admin
          .from("video_jobs")
          .update({
            status: "processing",
            provider: result.provider || current.provider || null,
            model: result.model || current.model || null,
            operation_name: result.operationName || current.operation_name || null,
            response_payload: result.raw || current.response_payload || null,
            error_message: null,
          })
          .eq("id", current.id)
          .eq("user_id", current.user_id)
        if (error) throw new Error(error.message)
        return {
          ...current,
          provider: result.provider || current.provider || null,
          model: result.model || current.model || null,
          operation_name: result.operationName || current.operation_name || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: null,
          updated_at: now,
        }
      }
      if (result.ok && result.status === "completed" && result.videoUrl) return completeJob(admin, current, result)
      return failJob(admin, current, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn("[Video status][autostart]", message)
      return failJob(admin, current, { ok: false, status: "failed", provider: current.provider, model: current.model, error: message })
    }
  }

  if (current.status !== "processing" || !current.operation_name) return current
  if (!["google", "wan", "hf-gradio", "fal"].includes(current.provider || "")) return current

  const updatedAt = current.updated_at ? new Date(current.updated_at).getTime() : 0
  if (updatedAt && Date.now() - updatedAt < 5_000) return current

  try {
    const result = await runCurrentJob(current)
    const now = new Date().toISOString()
    if (result.ok && result.status === "processing") {
      const { error } = await admin
        .from("video_jobs")
        .update({
          provider: result.provider || current.provider,
          model: result.model || current.model,
          operation_name: result.operationName || current.operation_name,
          response_payload: result.raw || current.response_payload || null,
          error_message: null,
        })
        .eq("id", current.id)
        .eq("user_id", current.user_id)
      if (error) console.warn("[Video status][poll]", error.message)
      return {
        ...current,
        provider: result.provider || current.provider,
        model: result.model || current.model,
        operation_name: result.operationName || current.operation_name,
        response_payload: result.raw || current.response_payload || null,
        error_message: null,
        updated_at: now,
      }
    }
    if (result.ok && result.status === "completed" && result.videoUrl) return completeJob(admin, current, result)
    if (!result.ok) return failJob(admin, current, result)
  } catch (error) {
    console.warn("[Video status][poll]", error instanceof Error ? error.message : String(error))
  }

  return current
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ ok: false, error: "No autenticado.", code: "UNAUTHORIZED" }, { status: 401 })

    const { jobId } = await context.params
    if (!jobId || typeof jobId !== "string") return NextResponse.json({ ok: false, error: "jobId inválido.", code: "INVALID_JOB_ID" }, { status: 400 })

    const { data: loadedJob, error } = await supabase
      .from("video_jobs")
      .select("id,user_id,status,plan,mode,prompt,style,duration_seconds,include_audio,image_url,provider,model,operation_name,asset_id,request_payload,response_payload,moderation_payload,video_url,thumbnail_url,error_message,retry_count,reuse_count,started_at,completed_at,created_at,updated_at")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle<VideoJobRow>()

    if (error) return NextResponse.json({ ok: false, error: error.message, code: "JOB_FETCH_FAILED" }, { status: 500 })
    if (!loadedJob) return NextResponse.json({ ok: false, error: "Job no encontrado.", code: "JOB_NOT_FOUND" }, { status: 404 })

    const job = await maybeAdvanceVideoJob(loadedJob)
    const [videoUrl, thumbnailUrl] = await Promise.all([
      resolvePrivateUrl(supabase, job.video_url),
      resolvePrivateUrl(supabase, job.thumbnail_url),
    ])

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: job.status,
      statusLabel: getStatusLabel(job.status),
      progress: getProgressFromStatus(job.status),
      plan: job.plan ?? "free",
      mode: job.mode ?? "text_to_video",
      prompt: job.prompt ?? "",
      style: job.style ?? "",
      duration: job.duration_seconds ?? 6,
      includeAudio: job.include_audio ?? false,
      imageUrl: job.image_url ?? null,
      provider: job.provider ?? null,
      model: job.model ?? null,
      assetId: job.asset_id ?? null,
      videoUrl,
      thumbnailUrl,
      reusable: Boolean(job.asset_id || job.video_url),
      reuseCount: job.reuse_count ?? 0,
      errorMessage: job.error_message ?? null,
      retryCount: job.retry_count ?? 0,
      startedAt: job.started_at ?? null,
      completedAt: job.completed_at ?? null,
      createdAt: job.created_at ?? null,
      updatedAt: job.updated_at ?? null,
      requestPayload: job.request_payload ?? null,
      responsePayload: job.response_payload ?? null,
      moderationPayload: job.moderation_payload ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al consultar el estado."
    return NextResponse.json({ ok: false, error: message, code: "INTERNAL_ERROR" }, { status: 500 })
  }
}
