import "server-only"

import { fal } from "@fal-ai/client"
import { persistRemoteVideo } from "@/lib/video/persist-remote-video"
import {
  buildFalVideoInput,
  endpointForMode,
  getVideoStudioModel,
  type StudioAspectRatio,
  type StudioResolution,
  type StudioVideoMode,
} from "@/lib/video/premium-models"

export type FalVideoResult = {
  ok: boolean
  status: "processing" | "completed" | "failed"
  provider: "fal"
  model?: string | null
  operationName?: string | null
  videoUrl?: string | null
  assetId?: string | null
  error?: string | null
  raw?: Record<string, unknown> | null
}

function configureFal() {
  const key = process.env.FAL_KEY?.trim()
  if (!key) throw new Error("FAL_KEY no está configurada para videos premium.")
  fal.config({ credentials: key })
}

function encodeOperation(endpoint: string, requestId: string) {
  return `fal:${Buffer.from(endpoint).toString("base64url")}:${requestId}`
}

function decodeOperation(value: string) {
  const [prefix, endpoint64, ...requestParts] = value.split(":")
  if (prefix !== "fal" || !endpoint64 || requestParts.length === 0) throw new Error("Operación fal.ai inválida.")
  return {
    endpoint: Buffer.from(endpoint64, "base64url").toString("utf8"),
    requestId: requestParts.join(":"),
  }
}

export async function startFalPremiumVideo(input: {
  modelKey: string
  prompt: string
  style?: string | null
  duration: number
  withAudio: boolean
  mode: StudioVideoMode
  imageUrl?: string | null
  aspectRatio: StudioAspectRatio
  resolution: StudioResolution
  userId: string
}): Promise<FalVideoResult> {
  configureFal()
  const model = getVideoStudioModel(input.modelKey)
  if (model.provider !== "fal") throw new Error("El modelo seleccionado no es un modelo premium fal.ai.")
  const endpoint = endpointForMode(model, input.mode)
  if (!endpoint) throw new Error("No existe endpoint para el modo seleccionado.")
  if (input.mode === "image_to_video" && !input.imageUrl) throw new Error("Este modo requiere una imagen base.")

  const payload = buildFalVideoInput({
    modelKey: model.key,
    prompt: input.prompt,
    style: input.style,
    mode: input.mode,
    duration: input.duration,
    resolution: input.resolution,
    aspectRatio: input.aspectRatio,
    withAudio: input.withAudio,
    imageUrl: input.imageUrl,
    userId: input.userId,
  })

  const submitted = await fal.queue.submit(endpoint as never, { input: payload as never }) as unknown as { request_id?: string }
  const requestId = submitted.request_id
  if (!requestId) throw new Error("fal.ai no devolvió request_id.")

  return {
    ok: true,
    status: "processing",
    provider: "fal",
    model: endpoint,
    operationName: encodeOperation(endpoint, requestId),
    raw: { phase: "submitted", requestId, endpoint, modelKey: model.key },
  }
}

export async function pollFalPremiumVideo(input: {
  operationName: string
  prompt: string
  userId: string
  sourceJobId?: string | null
  model?: string | null
}): Promise<FalVideoResult> {
  configureFal()
  const { endpoint, requestId } = decodeOperation(input.operationName)
  const status = await fal.queue.status(endpoint, { requestId, logs: false }) as unknown as { status?: string; error?: string }

  if (status.status !== "COMPLETED") {
    if (status.status === "FAILED") {
      return {
        ok: false,
        status: "failed",
        provider: "fal",
        model: endpoint,
        operationName: input.operationName,
        error: status.error || "fal.ai informó que la generación falló.",
        raw: { phase: "failed", requestId, endpoint, status: status.status },
      }
    }
    return {
      ok: true,
      status: "processing",
      provider: "fal",
      model: endpoint,
      operationName: input.operationName,
      raw: { phase: "polling", requestId, endpoint, status: status.status || "IN_PROGRESS" },
    }
  }

  const result = await fal.queue.result(endpoint as never, { requestId }) as unknown as {
    data?: { video?: { url?: string }; seed?: number }
    requestId?: string
  }
  const remoteUrl = result.data?.video?.url
  if (!remoteUrl) {
    return {
      ok: false,
      status: "failed",
      provider: "fal",
      model: endpoint,
      operationName: input.operationName,
      error: "fal.ai completó la solicitud sin devolver video.",
      raw: { phase: "completed_without_video", requestId, endpoint },
    }
  }

  const persisted = await persistRemoteVideo({
    remoteUrl,
    userId: input.userId,
    provider: "fal",
    model: endpoint,
    prompt: input.prompt,
    sourceJobId: input.sourceJobId,
    metadata: { falRequestId: requestId },
  })

  return {
    ok: true,
    status: "completed",
    provider: "fal",
    model: endpoint,
    operationName: input.operationName,
    videoUrl: persisted.videoUrl,
    assetId: persisted.assetId,
    raw: { phase: "completed", requestId, endpoint, persisted: true },
  }
}
