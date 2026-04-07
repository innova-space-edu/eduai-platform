import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { processVideoJob } from "@/lib/video-agent"

type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "canceled"
  | "blocked"

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
  request_payload?: {
    prompt?: string
    style?: string | null
    duration?: number | null
    durationSeconds?: number | null
    withAudio?: boolean | null
    includeAudio?: boolean | null
    mode?: string | null
    imageUrl?: string | null
    image_url?: string | null
  } | null
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
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true

  const authHeader = req.headers.get("authorization")
  return authHeader === `Bearer ${cronSecret}`
}

function getAdminSupabase() {
  // Preferir SUPABASE_URL (servidor) sobre NEXT_PUBLIC_SUPABASE_URL (cliente)
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) o SUPABASE_SERVICE_ROLE_KEY."
    )
  }

  return createClient(url, key)
}

function extractRequestInput(job: VideoJobRow) {
  const payload = job.request_payload || {}

  return {
    prompt: payload.prompt || job.prompt || "",
    style: payload.style ?? job.style ?? "",
    duration:
      payload.duration ??
      payload.durationSeconds ??
      job.duration_seconds ??
      6,
    withAudio:
      payload.withAudio ??
      payload.includeAudio ??
      job.include_audio ??
      false,
    mode: payload.mode || job.mode || "text_to_video",
    imageUrl: payload.imageUrl || payload.image_url || job.image_url || null,
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        } satisfies ProcessVideoResponse,
        { status: 401 }
      )
    }

    const supabase = getAdminSupabase()

    // 1. Leer el próximo job en cola
    const { data: nextJob, error: nextJobError } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<VideoJobRow>()

    if (nextJobError) {
      return NextResponse.json(
        {
          ok: false,
          error: nextJobError.message,
        } satisfies ProcessVideoResponse,
        { status: 500 }
      )
    }

    if (!nextJob) {
      return NextResponse.json(
        {
          ok: true,
          message: "No hay jobs pendientes en la cola.",
        } satisfies ProcessVideoResponse
      )
    }

    // 2. Toma exclusiva: marcar como processing solo si sigue en queued.
    //    Si otro worker ya lo tomó, el update no devolverá fila → abortamos.
    const nowIso = new Date().toISOString()

    const { data: claimedJob, error: processingError } = await supabase
      .from("video_jobs")
      .update({
        status: "processing",
        error_message: null,
        started_at: nowIso,
      })
      .eq("id", nextJob.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle()

    if (processingError) {
      return NextResponse.json(
        {
          ok: false,
          error: processingError.message,
        } satisfies ProcessVideoResponse,
        { status: 500 }
      )
    }

    // Otro worker ya tomó este job → nada que hacer, responder OK vacío
    if (!claimedJob) {
      return NextResponse.json(
        {
          ok: true,
          message: "Job ya fue tomado por otro worker.",
        } satisfies ProcessVideoResponse
      )
    }

    // 3. Procesar el job
    const input = extractRequestInput(nextJob)
    const result = await processVideoJob(input)

    // 4a. Fallo
    if (!result.ok || !result.videoUrl) {
      const failedStatus: JobStatus =
        result.status === "blocked" ? "blocked" : "failed"

      const { error: failError } = await supabase
        .from("video_jobs")
        .update({
          status: failedStatus,
          provider: result.provider || nextJob.provider || null,
          model: result.model || nextJob.model || null,
          response_payload: result.raw ?? null,
          error_message:
            result.moderationReason ||
            result.error ||
            "No fue posible generar el video.",
          completed_at: new Date().toISOString(),
          retry_count: (nextJob.retry_count ?? 0) + 1,
        })
        .eq("id", nextJob.id)

      if (failError) {
        return NextResponse.json(
          {
            ok: false,
            error: failError.message,
          } satisfies ProcessVideoResponse,
          { status: 500 }
        )
      }

      // El job fue procesado y persistido como failed/blocked → responder 200,
      // no 500, para que schedulers no reintenten innecesariamente.
      return NextResponse.json(
        {
          ok: false,
          jobId: nextJob.id,
          status: failedStatus,
          provider: result.provider || nextJob.provider || null,
          model: result.model || nextJob.model || null,
          error:
            result.moderationReason ||
            result.error ||
            "Error desconocido al procesar el video.",
        } satisfies ProcessVideoResponse
      )
    }

    // 4b. Éxito
    const { error: completeError } = await supabase
      .from("video_jobs")
      .update({
        status: "completed",
        provider: result.provider || nextJob.provider || "wan-worker",
        model: result.model || nextJob.model || null,
        video_url: result.videoUrl,
        thumbnail_url: result.thumbnailUrl || null,
        response_payload: result.raw ?? null,
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", nextJob.id)

    if (completeError) {
      return NextResponse.json(
        {
          ok: false,
          error: completeError.message,
        } satisfies ProcessVideoResponse,
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        jobId: nextJob.id,
        status: "completed",
        provider: result.provider || nextJob.provider || "wan-worker",
        model: result.model || nextJob.model || null,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl || null,
        message: "Video procesado correctamente.",
      } satisfies ProcessVideoResponse
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error"

    return NextResponse.json(
      {
        ok: false,
        error: message,
      } satisfies ProcessVideoResponse,
      { status: 500 }
    )
  }
}
