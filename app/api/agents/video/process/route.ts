import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { processVideoJob } from "@/lib/video-agent"

type ProcessVideoResponse = {
  ok: boolean
  message?: string
  jobId?: string
  status?: "queued" | "processing" | "completed" | "failed" | "canceled" | "blocked"
  provider?: string
  videoUrl?: string
  error?: string
}

function isAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true

  const authHeader = req.headers.get("authorization")
  return authHeader === `Bearer ${cronSecret}`
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    )
  }

  return createClient(url, key)
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

    const { data: nextJob, error: nextJobError } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

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

    const { error: processingError } = await supabase
      .from("video_jobs")
      .update({
        status: "processing",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", nextJob.id)

    if (processingError) {
      return NextResponse.json(
        {
          ok: false,
          error: processingError.message,
        } satisfies ProcessVideoResponse,
        { status: 500 }
      )
    }

    const requestPayload = (nextJob.request_payload || {}) as {
      prompt?: string
      style?: string | null
      duration?: number | null
      durationSeconds?: number | null
      withAudio?: boolean | null
      includeAudio?: boolean | null
      mode?: string | null
      imageUrl?: string | null
      image_url?: string | null
    }

    const result = await processVideoJob({
      prompt: requestPayload.prompt || "",
      style: requestPayload.style || "",
      duration:
        requestPayload.duration ??
        requestPayload.durationSeconds ??
        6,
      withAudio:
        requestPayload.withAudio ??
        requestPayload.includeAudio ??
        false,
      mode: requestPayload.mode || "text_to_video",
      imageUrl: requestPayload.imageUrl || requestPayload.image_url || null,
    })

    if (!result.ok || !result.videoUrl) {
      const finalStatus =
        result.status === "blocked" ? "failed" : "failed"

      const { error: failError } = await supabase
        .from("video_jobs")
        .update({
          status: finalStatus,
          provider: result.provider || null,
          error_message:
            result.moderationReason ||
            result.error ||
            "No fue posible generar el video.",
          updated_at: new Date().toISOString(),
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

      return NextResponse.json(
        {
          ok: false,
          jobId: nextJob.id,
          status: "failed",
          provider: result.provider,
          error:
            result.moderationReason ||
            result.error ||
            "Error desconocido al procesar el video.",
        } satisfies ProcessVideoResponse,
        { status: 500 }
      )
    }

    const { error: completeError } = await supabase
      .from("video_jobs")
      .update({
        status: "completed",
        provider: result.provider || null,
        video_url: result.videoUrl,
        error_message: null,
        updated_at: new Date().toISOString(),
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
        provider: result.provider,
        videoUrl: result.videoUrl,
        message: "Video procesado correctamente.",
      } satisfies ProcessVideoResponse
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unexpected error",
      } satisfies ProcessVideoResponse,
      { status: 500 }
    )
  }
}
