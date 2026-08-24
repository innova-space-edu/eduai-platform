import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { processVideoJob, type ProcessVideoJobResult } from "@/lib/video-agent"
import { captureVideoCredits, releaseVideoCredits } from "@/lib/credits/server"
import { pollFalPremiumVideo, startFalPremiumVideo } from "@/lib/video/providers/fal-premium"

export const runtime = "nodejs"
export const maxDuration = 60

type JobStatus = "queued" | "processing" | "completed" | "failed" | "canceled" | "blocked"

type ProcessVideoResponse = {
  ok: boolean
  message?: string
  jobId?: string
  status?: JobStatus
  provider?: string | null
  model?: string | null
  videoUrl?: string | null
  thumbnailUrl?: string | null
  error?: string
}

type RequestPayload = {
  prompt?: string
  style?: string | null
  duration?: number | null
  durationSeconds?: number | null
  withAudio?: boolean | null
  includeAudio?: boolean | null
  mode?: string | null
  imageUrl?: string | null
  image_url?: string | null
  aspectRatio?: string | null
  resolution?: string | null
  modelKey?: string | null
  billingMode?: string | null
}

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
  started_at?: string | null
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}

function isAuthorized(req: Request) {
  const cronSecret = process.env.VIDEO_CRON_SECRET || process.env.CRON_SECRET
  if (!cronSecret) return process.env.NODE_ENV !== "production"
  const authHeader = req.headers.get("authorization")
  const explicitHeader = req.headers.get("x-video-cron-secret")
  return authHeader === `Bearer ${cronSecret}` || explicitHeader === cronSecret
}

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) o SUPABASE_SERVICE_ROLE_KEY.")
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function extractRequestInput(job: VideoJobRow) {
  const payload = job.request_payload || {}
  return {
    prompt: payload.prompt || job.prompt || "",
    style: payload.style ?? job.style ?? "",
    duration: payload.duration ?? payload.durationSeconds ?? job.duration_seconds ?? 6,
    withAudio: payload.withAudio ?? payload.includeAudio ?? job.include_audio ?? false,
    mode: payload.mode || job.mode || "text_to_video",
    imageUrl: payload.imageUrl || payload.image_url || job.image_url || null,
    aspectRatio: payload.aspectRatio || "16:9",
    resolution: payload.resolution || process.env.GOOGLE_VIDEO_RESOLUTION || "720p",
    operationName: job.operation_name || null,
    userId: job.user_id,
    sourceJobId: job.id,
    provider: job.provider || null,
    model: job.model || null,
    modelKey: payload.modelKey || null,
  }
}

async function runJob(job: VideoJobRow): Promise<ProcessVideoJobResult> {
  const input = extractRequestInput(job)

  if (job.provider === "fal") {
    if (input.operationName) {
      return pollFalPremiumVideo({
        operationName: input.operationName,
        prompt: input.prompt,
        userId: input.userId,
        sourceJobId: input.sourceJobId,
        model: input.model,
      })
    }
    if (!input.modelKey) {
      return { ok: false, status: "failed", provider: "fal", error: "Falta modelKey para el job premium." }
    }
    return startFalPremiumVideo({
      modelKey: input.modelKey,
      prompt: input.prompt,
      style: input.style,
      duration: Number(input.duration),
      withAudio: Boolean(input.withAudio),
      mode: input.mode === "image_to_video" ? "image_to_video" : "text_to_video",
      imageUrl: input.imageUrl,
      aspectRatio: input.aspectRatio === "9:16" ? "9:16" : "16:9",
      resolution: input.resolution === "4k" ? "4k" : input.resolution === "1080p" ? "1080p" : "720p",
      userId: input.userId,
    })
  }

  return processVideoJob(input)
}

async function settleCompleted(jobId: string) {
  try {
    await captureVideoCredits(jobId)
  } catch (error) {
    console.error("[Video][credits][capture]", jobId, error instanceof Error ? error.message : String(error))
    throw error
  }
}

async function settleFailed(jobId: string, reason: string) {
  try {
    await releaseVideoCredits(jobId, reason)
  } catch (error) {
    console.error("[Video][credits][release]", jobId, error instanceof Error ? error.message : String(error))
  }
}

async function findWork(supabase: ReturnType<typeof getAdminSupabase>): Promise<{ job: VideoJobRow; claimed: boolean } | null> {
  const { data: processing, error: processingError } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("status", "processing")
    .not("operation_name", "is", null)
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle<VideoJobRow>()

  if (processingError) throw new Error(processingError.message)
  if (processing) return { job: processing, claimed: true }

  const { data: queued, error: queuedError } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<VideoJobRow>()

  if (queuedError) throw new Error(queuedError.message)
  if (!queued) return null

  const { data: claimed, error: claimError } = await supabase
    .from("video_jobs")
    .update({ status: "processing", error_message: null, started_at: new Date().toISOString() })
    .eq("id", queued.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle()

  if (claimError) throw new Error(claimError.message)
  if (!claimed) return null
  return { job: { ...queued, status: "processing" }, claimed: true }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" } satisfies ProcessVideoResponse, { status: 401 })
    }

    const supabase = getAdminSupabase()
    const work = await findWork(supabase)
    if (!work) return NextResponse.json({ ok: true, message: "No hay jobs pendientes en la cola." } satisfies ProcessVideoResponse)

    const nextJob = work.job
    let result: ProcessVideoJobResult
    try {
      result = await runJob(nextJob)
    } catch (error) {
      result = {
        ok: false,
        status: "failed",
        provider: nextJob.provider || null,
        model: nextJob.model || null,
        error: error instanceof Error ? error.message : String(error),
      }
    }

    if (result.ok && result.status === "processing") {
      const { error } = await supabase
        .from("video_jobs")
        .update({
          status: "processing",
          provider: result.provider || nextJob.provider || "google",
          model: result.model || nextJob.model || null,
          operation_name: result.operationName || nextJob.operation_name || null,
          response_payload: result.raw ?? nextJob.response_payload ?? null,
          error_message: null,
        })
        .eq("id", nextJob.id)
      if (error) throw new Error(error.message)

      return NextResponse.json({
        ok: true,
        jobId: nextJob.id,
        status: "processing",
        provider: result.provider || nextJob.provider || "google",
        model: result.model || nextJob.model || null,
        message: result.operationName ? "Generación iniciada; EduAI continuará consultando el estado." : "Generación en curso.",
      } satisfies ProcessVideoResponse)
    }

    if (!result.ok || !result.videoUrl) {
      const failedStatus: JobStatus = result.status === "blocked" ? "blocked" : "failed"
      const failureMessage = result.moderationReason || result.error || "No fue posible generar el video."
      const { error } = await supabase
        .from("video_jobs")
        .update({
          status: failedStatus,
          provider: result.provider || nextJob.provider || null,
          model: result.model || nextJob.model || null,
          operation_name: result.operationName || nextJob.operation_name || null,
          response_payload: result.raw ?? null,
          error_message: failureMessage,
          completed_at: new Date().toISOString(),
          retry_count: (nextJob.retry_count ?? 0) + 1,
        })
        .eq("id", nextJob.id)
      if (error) throw new Error(error.message)
      await settleFailed(nextJob.id, failureMessage)

      return NextResponse.json({
        ok: false,
        jobId: nextJob.id,
        status: failedStatus,
        provider: result.provider || nextJob.provider || null,
        model: result.model || nextJob.model || null,
        error: failureMessage,
      } satisfies ProcessVideoResponse)
    }

    const { error: completeError } = await supabase
      .from("video_jobs")
      .update({
        status: "completed",
        provider: result.provider || nextJob.provider || "google",
        model: result.model || nextJob.model || null,
        operation_name: result.operationName || nextJob.operation_name || null,
        asset_id: result.assetId || nextJob.asset_id || null,
        video_url: result.videoUrl,
        thumbnail_url: result.thumbnailUrl || null,
        response_payload: result.raw ?? null,
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", nextJob.id)
    if (completeError) throw new Error(completeError.message)

    await settleCompleted(nextJob.id)

    return NextResponse.json({
      ok: true,
      jobId: nextJob.id,
      status: "completed",
      provider: result.provider || nextJob.provider || "google",
      model: result.model || nextJob.model || null,
      videoUrl: result.videoUrl,
      thumbnailUrl: result.thumbnailUrl || null,
      message: "Video procesado, guardado y conciliado correctamente.",
    } satisfies ProcessVideoResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ ok: false, error: message } satisfies ProcessVideoResponse, { status: 500 })
  }
}
