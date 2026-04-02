import { NextRequest } from "next/server"
import { generateVideoWithFallback } from "@/lib/video-agent"
import {
  normalizeDuration,
  normalizeMode,
  VIDEO_MAX_DURATION,
} from "@/lib/video-config"

type VideoRequestBody = {
  prompt?: string
  style?: string
  duration?: number
  withAudio?: boolean
  mode?: "text_to_video" | "image_to_video"
  imageUrl?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VideoRequestBody

    const prompt = (body.prompt || "").trim()
    const style = (body.style || "").trim()
    const duration = normalizeDuration(body.duration)
    const withAudio = Boolean(body.withAudio)
    const mode = normalizeMode(body.mode)
    const imageUrl = body.imageUrl || null

    if (!prompt) {
      return Response.json(
        {
          ok: false,
          error: "Debes ingresar un prompt para generar el video.",
        },
        { status: 400 }
      )
    }

    if (duration > VIDEO_MAX_DURATION) {
      return Response.json(
        {
          ok: false,
          error: `La duración máxima permitida es ${VIDEO_MAX_DURATION} segundos.`,
        },
        { status: 400 }
      )
    }

    if (mode === "image_to_video" && !imageUrl) {
      return Response.json(
        {
          ok: false,
          error: "Para Imagen → Video debes proporcionar una imagen base.",
        },
        { status: 400 }
      )
    }

    const result = await generateVideoWithFallback({
      prompt,
      style,
      duration,
      withAudio,
      mode,
      imageUrl,
    })

    if (!result.ok) {
      return Response.json(
        {
          ok: false,
          provider: result.provider || null,
          blocked: result.blocked || false,
          moderationReason: result.moderationReason || null,
          error: result.error || "No se pudo generar el video.",
          raw: result.raw || null,
        },
        { status: result.blocked ? 400 : 500 }
      )
    }

    return Response.json({
      ok: true,
      provider: result.provider,
      videoUrl: result.videoUrl,
      raw: result.raw || null,
    })
  } catch (error: any) {
    console.error("[/api/agents/video] Error:", error)

    return Response.json(
      {
        ok: false,
        error: error?.message || "Error interno al generar video.",
      },
      { status: 500 }
    )
  }
}
