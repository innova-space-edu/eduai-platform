import { NextResponse } from "next/server"
import {
  completeVideoJob,
  failVideoJob,
  getNextQueuedVideoJob,
  markVideoJobProcessing,
  processVideoJob,
} from "@/lib/video-agent"

type ProcessVideoResponse = {
  ok: boolean
  message?: string
  jobId?: string
  status?: "queued" | "processing" | "completed" | "failed" | "canceled"
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

    const nextJob = await getNextQueuedVideoJob()

    if (!nextJob) {
      return NextResponse.json(
        {
          ok: true,
          message: "No hay jobs pendientes en la cola.",
        } satisfies ProcessVideoResponse
      )
    }

    const processingJob = await markVideoJobProcessing(nextJob.id)
    const result = await processVideoJob(processingJob)

    if (!result.ok || !result.videoUrl) {
      await failVideoJob({
        jobId: processingJob.id,
        attempts: (processingJob.attempts || 0) + 1,
        errorMessage:
          result.error ||
          "No fue posible generar el video con los proveedores configurados.",
      })

      return NextResponse.json(
        {
          ok: false,
          jobId: processingJob.id,
          status: "failed",
          provider: result.provider,
          error: result.error || "Error desconocido al procesar el video.",
        } satisfies ProcessVideoResponse,
        { status: 500 }
      )
    }

    await completeVideoJob({
      jobId: processingJob.id,
      provider: result.provider,
      providerModel: result.model,
      videoUrl: result.videoUrl,
      audioUrl: result.audioUrl || null,
      previewImageUrl: result.previewImageUrl || null,
    })

    return NextResponse.json(
      {
        ok: true,
        jobId: processingJob.id,
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
