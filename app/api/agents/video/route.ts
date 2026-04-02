import { NextResponse } from "next/server"
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
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        } satisfies CreateVideoApiResponse,
        { status: 401 }
      )
    }

    const body = (await req.json()) as VideoRequestInput
    const request = normalizeVideoRequest(body)

    if (!request.prompt) {
      return NextResponse.json(
        {
          ok: false,
          error: "Debes ingresar un prompt para generar el video.",
        } satisfies CreateVideoApiResponse,
        { status: 400 }
      )
    }

    if (
      request.mode === "image_to_video" &&
      !request.imageUrl &&
      !request.imageBase64
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Para Imagen → Video debes subir o enviar una imagen base.",
        } satisfies CreateVideoApiResponse,
        { status: 400 }
      )
    }

    if (
      request.audio.enabled &&
      !request.audio.ttsText &&
      !request.audio.audioUrl
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Activaste audio, pero falta el texto o archivo base para el audio.",
        } satisfies CreateVideoApiResponse,
        { status: 400 }
      )
    }

    await enforceVideoLimits(user.id)

    const cached = await getCachedCompletedVideo(user.id, request)
    if (cached?.status === "completed" && cached.video_url) {
      return NextResponse.json(
        {
          ok: true,
          jobId: cached.id,
          cached: true,
          status: "completed",
          message: "Se reutilizó un video ya generado para esta misma solicitud.",
        } satisfies CreateVideoApiResponse
      )
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
      return NextResponse.json(
        {
          ok: false,
          error: sameRequestError.message,
        } satisfies CreateVideoApiResponse,
        { status: 500 }
      )
    }

    if (sameRequestJob) {
      return NextResponse.json(
        {
          ok: true,
          jobId: sameRequestJob.id,
          cached: sameRequestJob.status === "completed",
          status: sameRequestJob.status,
          message:
            sameRequestJob.status === "completed"
              ? "Ya existía un video generado para esta solicitud."
              : "La solicitud ya estaba en cola o procesándose.",
        } satisfies CreateVideoApiResponse
      )
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
      return NextResponse.json(
        {
          ok: false,
          error: activeJobError.message,
        } satisfies CreateVideoApiResponse,
        { status: 500 }
      )
    }

    if (activeJob) {
      return NextResponse.json(
        {
          ok: false,
          jobId: activeJob.id,
          status: activeJob.status,
          error:
            "Ya tienes un video en cola o procesándose. Espera a que termine antes de crear otro.",
        } satisfies CreateVideoApiResponse,
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
      return NextResponse.json(
        {
          ok: false,
          error: insertError?.message || "No se pudo crear el job de video.",
        } satisfies CreateVideoApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        jobId: insertedJob.id,
        cached: false,
        status: insertedJob.status,
        message: "Video enviado a la cola correctamente.",
      } satisfies CreateVideoApiResponse
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unexpected error",
      } satisfies CreateVideoApiResponse,
      { status: 500 }
    )
  }
}
