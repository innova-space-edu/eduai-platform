import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "blocked"
  | "canceled"

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
  request_payload?: Record<string, unknown> | null
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

function getProgressFromStatus(status: JobStatus): number {
  switch (status) {
    case "queued":
      return 10
    case "processing":
      return 60
    case "completed":
      return 100
    case "failed":
    case "blocked":
    case "canceled":
      return 100
    default:
      return 0
  }
}

function getStatusLabel(status: JobStatus): string {
  switch (status) {
    case "queued":
      return "En cola"
    case "processing":
      return "Procesando"
    case "completed":
      return "Completado"
    case "failed":
      return "Falló"
    case "blocked":
      return "Bloqueado"
    case "canceled":
      return "Cancelado"
    default:
      return "Desconocido"
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autenticado.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      )
    }

    const { jobId } = await context.params

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "jobId inválido.",
          code: "INVALID_JOB_ID",
        },
        { status: 400 }
      )
    }

    const { data: job, error } = await supabase
      .from("video_jobs")
      .select(
        `
        id,
        user_id,
        status,
        plan,
        mode,
        prompt,
        style,
        duration_seconds,
        include_audio,
        image_url,
        provider,
        model,
        request_payload,
        response_payload,
        moderation_payload,
        video_url,
        thumbnail_url,
        error_message,
        retry_count,
        started_at,
        completed_at,
        created_at,
        updated_at
      `
      )
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle<VideoJobRow>()

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: "JOB_FETCH_FAILED",
        },
        { status: 500 }
      )
    }

    if (!job) {
      return NextResponse.json(
        {
          ok: false,
          error: "Job no encontrado.",
          code: "JOB_NOT_FOUND",
        },
        { status: 404 }
      )
    }

    const status = job.status
    const progress = getProgressFromStatus(status)
    const statusLabel = getStatusLabel(status)

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status,
      statusLabel,
      progress,
      plan: job.plan ?? "free",
      mode: job.mode ?? "text_to_video",
      prompt: job.prompt ?? "",
      style: job.style ?? "",
      duration: job.duration_seconds ?? 6,
      includeAudio: job.include_audio ?? false,
      imageUrl: job.image_url ?? null,
      provider: job.provider ?? null,
      model: job.model ?? null,
      videoUrl: job.video_url ?? null,
      thumbnailUrl: job.thumbnail_url ?? null,
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
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error inesperado al consultar el estado."

    return NextResponse.json(
      {
        ok: false,
        error: message,
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    )
  }
}
