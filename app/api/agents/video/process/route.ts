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
      return Response.json<ProcessVideoResponse>(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      )
    }

    const nextJob = await getNextQueuedVideoJob()

    if (!nextJob) {
      return Response.json<ProcessVideoResponse>({
        ok: true,
        message: "No hay jobs pendientes en la cola.",
      })
    }

    const processingJob = await markVideoJobProcessing(nextJob.id)
    const result = await processVideoJob(processingJob)

    if (!result.ok || !result.videoUrl) {
      await failVideoJob({
        jobId: processingJob.id,
        attempts: processingJob.attempts + 1,
        errorMessage:
          result.error || "No fue posible generar el video con los proveedores configurados.",
      })

      return Response.json<ProcessVideoResponse>(
        {
          ok: false,
          jobId: processingJob.id,
          status: "failed",
          provider: result.provider,
          error: result.error || "Error desconocido al procesar el video.",
        },
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

    return Response.json<ProcessVideoResponse>({
      ok: true,
      jobId: processingJob.id,
      status: "completed",
      provider: result.provider,
      videoUrl: result.videoUrl,
      message: "Video procesado correctamente.",
    })
  } catch (error: any) {
    return Response.json<ProcessVideoResponse>(
      {
        ok: false,
        error: error?.message || "Unexpected error",
      },
      { status: 500 }
    )
  }
}
