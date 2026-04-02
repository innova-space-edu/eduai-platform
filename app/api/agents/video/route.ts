import { createClient } from "@/lib/supabase/server"
import {
  normalizeVideoRequest,
  type VideoRequestInput,
} from "@/lib/video-config"
import {
  enforceVideoLimits,
  getCachedCompletedVideo,
  hashVideoRequest,
} from "@/lib/video-agent"

type CreateVideoApiResponse = {
  ok: boolean
  jobId?: string
  cached?: boolean
  status?: "queued" | "processing" | "completed" | "failed" | "canceled"
  message?: string
  error?: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json<CreateVideoApiResponse>(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      )
    }

    const body = (await req.json()) as VideoRequestInput
    const request = normalizeVideoRequest(body)

    if (!request.prompt) {
      return Response.json<CreateVideoApiResponse>(
        {
          ok: false,
          error: "Debes ingresar un prompt para generar el video.",
        },
        { status: 400 }
      )
    }

    if (request.mode === "image_to_video" && !request.imageUrl && !request.imageBase64) {
      return Response.json<CreateVideoApiResponse>(
        {
          ok: false,
          error: "Para Imagen → Video debes subir o enviar una imagen base.",
        },
        { status: 400 }
      )
    }

    if (request.audio.enabled && !request.audio.ttsText && !request.audio.audioUrl) {
      return Response.json<CreateVideoApiResponse>(
        {
          ok: false,
          error: "Activaste audio, pero falta el texto o archivo base para el audio.",
        },
        { status: 400 }
      )
    }

    await enforceVideoLimits(user.id)

    const cached = await getCachedCompletedVideo(user.id, request)
    if (cached?.status === "completed" && cached.video_url) {
      return Response.json<CreateVideoApiResponse>({
        ok: true,
        jobId: cached.id,
        cached: true,
        status: "completed",
        message: "Se reutilizó un video ya generado para esta misma solicitud.",
      })
    }

    const requestHash = hashVideoRequest(request)

    const { data: sameRequestJob, error: sameRequestError } = await supabase
      .from("video_jobs")
      .select("id,status,video_url,created_at")
      .eq("user_id", user.id)
      .eq("request_hash", requestHash)
      .in("status", ["queued", "processing", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sameRequestError) {
      return Response.json<CreateVideoApiResponse>(
        {
          ok: false,
          error: sameRequestError.message,
        },
        { status: 500 }
      )
    }

    if (sameRequestJob) {
      return Response.json<CreateVideoApiResponse>({
        ok: true,
        jobId: sameRequestJob.id,
        cached: sameRequestJob.status === "completed",
        status: sameRequestJob.status,
        message:
          sameRequestJob.status === "completed"
            ? "Ya existía un video generado para esta solicitud."
            : "La solicitud ya estaba en cola o procesándose.",
      })
    }

    const { data: activeJob, error: activeJobError } = await supabase
      .from("video_jobs")
      .select("id,status,created_at")
      .eq("user_id", user.id)
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeJobError) {
      return Response.json<CreateVideoApiResponse>(
        {
          ok: false,
          error: activeJobError.message,
        },
        { status: 500 }
      )
    }

    if (activeJob) {
      return Response.json<CreateVideoApiResponse>(
        {
          ok: false,
          jobId: activeJob.id,
          status: activeJob.status,
          error:
            "Ya tienes un video en cola o procesándose. Espera a que termine antes de crear otro.",
        },
        { status: 429 }
      )
    }

    const insertPayload = {
      user_id: user.id,
      status: "queued",
      request_hash: requestHash,
      request_payload: request,
      attempts: 0,
      provider: null,
      provider_model: null,
      video_url: null,
      audio_url: null,
      preview_image_url: null,
      error_message: null,
    }

    const { data: insertedJob, error: insertError } = await supabase
      .from("video_jobs")
      .insert(insertPayload)
      .select("id,status,created_at")
      .single()

    if (insertError || !insertedJob) {
      return Response.json<CreateVideoApiResponse>(
        {
          ok: false,
          error: insertError?.message || "No se pudo crear el job de video.",
        },
        { status: 500 }
      )
    }

    return Response.json<CreateVideoApiResponse>({
      ok: true,
      jobId: insertedJob.id,
      cached: false,
      status: insertedJob.status,
      message: "Video enviado a la cola correctamente.",
    })
  } catch (error: any) {
    return Response.json<CreateVideoApiResponse>(
      {
        ok: false,
        error: error?.message || "Unexpected error",
      },
      { status: 500 }
    )
  }
}
