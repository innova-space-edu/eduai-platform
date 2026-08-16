import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { processVideoJob } from "@/lib/video-agent"

export const runtime = "nodejs"
export const maxDuration = 60

type JobStatus = "queued" | "processing" | "completed" | "failed" | "blocked" | "canceled"

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
  request_payload?: Record<string, unknown> | null
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
  switch (status) {
    case "queued": return 10
    case "processing": return 60
    case "completed": return 100
    case "failed":
    case "blocked":
    case "canceled": return 100
    default: return 0
  }
}

function getStatusLabel(status: JobStatus): string {
  switch (status) {
    case "queued": return "En cola"
    case "processing": return "Procesando"
    case "completed": return "Completado"
    case "failed": return "Falló"
    case "blocked": return "Bloqueado"
    case "canceled": return "Cancelado"
    default: return "Desconocido"
  }
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

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, 60 * 30)

  return error ? null : data?.signedUrl || null
}

function requestString(payload: Record<string, unknown> | null | undefined, key: string, fallback = "") {
  const value = payload?.[key]
  return typeof value === "string" ? value : fallback
}

function requestNumber(payload: Record<string, unknown> | null | undefined, key: string, fallback: number) {
  const value = payload?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function requestBoolean(payload: Record<string, unknown> | null | undefined, key: string, fallback: boolean) {
  const value = payload?.[key]
  return typeof value === "boolean" ? value : fallback
}

async function maybeAdvanceVideoJob(job: VideoJobRow): Promise<VideoJobRow> {
  const admin = getAdminSupabase()
  if (!admin) return job

  let current = job

  // Preview deployments do not execute Vercel Cron Jobs. When the authenticated
  // owner polls a queued job, claim exactly that job and start it immediately.
  // Production can still use /api/agents/video/process through Vercel Cron.
  if (current.status === "queued") {
    const startedAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await admin
      .from("video_jobs")
      .update({
        status: "processing",
        error_message: null,
        started_at: current.started_at || startedAt,
      })
      .eq("id", current.id)
      .eq("user_id", current.user_id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle()

    if (claimError) {
      console.warn("[Video status][autostart]", claimError.message)
      return current
    }

    // Otro request puede haber reclamado el job milisegundos antes.
    if (!claimed) return current

    current = {
      ...current,
      status: "processing",
      started_at: current.started_at || startedAt,
      updated_at: startedAt,
    }

    try {
      const result = await processVideoJob({
        prompt: current.prompt || requestString(current.request_payload, "prompt", "Video EduAI"),
        style: current.style || requestString(current.request_payload, "style", ""),
        duration: current.duration_seconds ?? requestNumber(current.request_payload, "duration", 6),
        withAudio: current.include_audio ?? requestBoolean(current.request_payload, "withAudio", false),
        mode: current.mode || requestString(current.request_payload, "mode", "text_to_video"),
        imageUrl: current.image_url || requestString(current.request_payload, "imageUrl", "") || null,
        aspectRatio: requestString(current.request_payload, "aspectRatio", "16:9"),
        resolution: requestString(current.request_payload, "resolution", "720p"),
        userId: current.user_id,
        sourceJobId: current.id,
        provider: current.provider || null,
        model: current.model || null,
      })

      const now = new Date().toISOString()

      if (result.ok && result.status === "processing") {
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

        if (error) console.warn("[Video status][autostart]", error.message)

        return {
          ...current,
          status: "processing",
          provider: result.provider || current.provider || null,
          model: result.model || current.model || null,
          operation_name: result.operationName || current.operation_name || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: null,
          updated_at: now,
        }
      }

      if (result.ok && result.status === "completed" && result.videoUrl) {
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

        if (error) console.warn("[Video status][autostart]", error.message)

        return {
          ...current,
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
          updated_at: now,
        }
      }

      const failedStatus: JobStatus = result.status === "blocked" ? "blocked" : "failed"
      const errorMessage = result.moderationReason || result.error || "No fue posible iniciar el video."
      await admin
        .from("video_jobs")
        .update({
          status: failedStatus,
          provider: result.provider || current.provider || null,
          model: result.model || current.model || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: errorMessage,
          completed_at: now,
          retry_count: Number(current.retry_count || 0) + 1,
        })
        .eq("id", current.id)
        .eq("user_id", current.user_id)

      return {
        ...current,
        status: failedStatus,
        provider: result.provider || current.provider || null,
        model: result.model || current.model || null,
        response_payload: result.raw || current.response_payload || null,
        error_message: errorMessage,
        completed_at: now,
        retry_count: Number(current.retry_count || 0) + 1,
        updated_at: now,
      }
    } catch (error) {
      const now = new Date().toISOString()
      const message = error instanceof Error ? error.message : String(error)
      console.warn("[Video status][autostart]", message)
      await admin
        .from("video_jobs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: now,
          retry_count: Number(current.retry_count || 0) + 1,
        })
        .eq("id", current.id)
        .eq("user_id", current.user_id)

      return {
        ...current,
        status: "failed",
        error_message: message,
        completed_at: now,
        retry_count: Number(current.retry_count || 0) + 1,
        updated_at: now,
      }
    }
  }

  if (
    current.status !== "processing"
    || !["google", "wan", "hf-gradio"].includes(current.provider || "")
    || !current.operation_name
  ) return current

  // Evitar golpear APIs de polling en cada render/poll ultra rápido.
  const updatedAt = current.updated_at ? new Date(current.updated_at).getTime() : 0
  if (updatedAt && Date.now() - updatedAt < 5_000) return current

  try {
    const result = await processVideoJob({
      prompt: current.prompt || requestString(current.request_payload, "prompt", "Video EduAI"),
      operationName: current.operation_name,
      userId: current.user_id,
      sourceJobId: current.id,
      provider: current.provider,
      model: current.model,
    })

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

    if (result.ok && result.status === "completed" && result.videoUrl) {
      const { error } = await admin
        .from("video_jobs")
        .update({
          status: "completed",
          provider: result.provider || current.provider,
          model: result.model || current.model,
          operation_name: result.operationName || current.operation_name,
          asset_id: result.assetId || current.asset_id || null,
          video_url: result.videoUrl,
          thumbnail_url: result.thumbnailUrl || current.thumbnail_url || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: null,
          completed_at: now,
        })
        .eq("id", current.id)
        .eq("user_id", current.user_id)

      if (!error) {
        return {
          ...current,
          status: "completed",
          provider: result.provider || current.provider,
          model: result.model || current.model,
          operation_name: result.operationName || current.operation_name,
          asset_id: result.assetId || current.asset_id || null,
          video_url: result.videoUrl,
          thumbnail_url: result.thumbnailUrl || current.thumbnail_url || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: null,
          completed_at: now,
          updated_at: now,
        }
      }
    }

    if (!result.ok) {
      const failedStatus: JobStatus = result.status === "blocked" ? "blocked" : "failed"
      const message = result.moderationReason || result.error || "La operación de video falló."
      await admin
        .from("video_jobs")
        .update({
          status: failedStatus,
          provider: result.provider || current.provider,
          model: result.model || current.model,
          response_payload: result.raw || current.response_payload || null,
          error_message: message,
          completed_at: now,
          retry_count: Number(current.retry_count || 0) + 1,
        })
        .eq("id", current.id)
        .eq("user_id", current.user_id)

      return {
        ...current,
        status: failedStatus,
        provider: result.provider || current.provider,
        model: result.model || current.model,
        response_payload: result.raw || current.response_payload || null,
        error_message: message,
        completed_at: now,
        retry_count: Number(current.retry_count || 0) + 1,
        updated_at: now,
      }
    }
  } catch (error) {
    // Un error transitorio de polling no debe destruir un job todavía válido.
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

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado.", code: "UNAUTHORIZED" }, { status: 401 })
    }

    const { jobId } = await context.params
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ ok: false, error: "jobId inválido.", code: "INVALID_JOB_ID" }, { status: 400 })
    }

    const { data: loadedJob, error } = await supabase
      .from("video_jobs")
      .select("id,user_id,status,plan,mode,prompt,style,duration_seconds,include_audio,image_url,provider,model,operation_name,asset_id,request_payload,response_payload,moderation_payload,video_url,thumbnail_url,error_message,retry_count,reuse_count,started_at,completed_at,created_at,updated_at")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle<VideoJobRow>()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: "JOB_FETCH_FAILED" }, { status: 500 })
    }
    if (!loadedJob) {
      return NextResponse.json({ ok: false, error: "Job no encontrado.", code: "JOB_NOT_FOUND" }, { status: 404 })
    }

    const job = await maybeAdvanceVideoJob(loadedJob)
    const videoUrl = await resolvePrivateUrl(supabase, job.video_url)
    const thumbnailUrl = await resolvePrivateUrl(supabase, job.thumbnail_url)

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
