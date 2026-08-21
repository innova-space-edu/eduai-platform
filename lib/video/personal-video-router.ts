import { persistRemoteVideo } from "@/lib/video/persist-remote-video"
import { getFalModelSchema, getReplicateModel } from "@/lib/ai/personal-provider-marketplace"
import type { PersonalAIProvider } from "@/lib/ai/personal-credentials"

export type PersonalVideoMode = "text_to_video" | "image_to_video"

export type PersonalVideoRequest = {
  provider: PersonalAIProvider
  model: string
  secret: string
  prompt: string
  style?: string | null
  duration: number
  mode: PersonalVideoMode
  imageUrl?: string | null
  aspectRatio?: "16:9" | "9:16" | string | null
  resolution?: "720p" | "1080p" | "4k" | string | null
  withAudio?: boolean
  userId: string
  sourceJobId?: string | null
}

export type PersonalVideoResult = {
  ok: boolean
  status: "processing" | "completed" | "failed"
  provider: PersonalAIProvider
  model: string
  operationName?: string | null
  externalRequestId?: string | null
  videoUrl?: string | null
  assetId?: string | null
  error?: string | null
  raw?: Record<string, unknown> | null
}

function compactError(value: unknown) {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim().slice(0, 600)
  if (value && typeof value === "object") {
    const anyValue = value as any
    return String(anyValue?.detail || anyValue?.message || anyValue?.error || anyValue?.error?.message || JSON.stringify(value))
      .replace(/\s+/g, " ")
      .slice(0, 600)
  }
  return "Error desconocido"
}

function encodePart(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function decodePart(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function operation(provider: "fal" | "replicate", model: string, requestId: string) {
  return `personal:${provider}:${encodePart(model)}:${requestId}`
}

export function parsePersonalVideoOperation(value: string | null | undefined) {
  if (!value?.startsWith("personal:")) return null
  const parts = value.split(":")
  if (parts.length < 4) return null
  const provider = parts[1]
  if (provider !== "fal" && provider !== "replicate") return null
  try {
    return {
      provider: provider as "fal" | "replicate",
      model: decodePart(parts[2]),
      requestId: parts.slice(3).join(":"),
    }
  } catch {
    return null
  }
}

function dereferenceSchema(schema: any, root: any): any {
  if (!schema || typeof schema !== "object") return null
  if (schema.$ref && typeof schema.$ref === "string" && schema.$ref.startsWith("#/")) {
    const target = schema.$ref.slice(2).split("/").reduce((node: any, key: string) => node?.[key], root)
    return target ? dereferenceSchema(target, root) : null
  }
  return schema
}

function extractOpenApiInputProperties(openapi: any): Record<string, any> {
  if (!openapi || typeof openapi !== "object") return {}

  const paths = openapi.paths || {}
  for (const pathValue of Object.values(paths) as any[]) {
    const post = pathValue?.post
    const schema = dereferenceSchema(post?.requestBody?.content?.["application/json"]?.schema, openapi)
    if (schema?.properties) return schema.properties
  }

  const schemas = openapi?.components?.schemas || {}
  for (const [name, candidate] of Object.entries(schemas) as [string, any][]) {
    if (!/input|request/i.test(name)) continue
    const resolved = dereferenceSchema(candidate, openapi)
    if (resolved?.properties) return resolved.properties
  }

  return {}
}

function firstSupported(properties: Record<string, any>, names: string[]) {
  return names.find(name => Object.prototype.hasOwnProperty.call(properties, name)) || null
}

function normalizedDuration(value: number) {
  const safe = Number.isFinite(value) ? Math.round(value) : 5
  return Math.max(2, Math.min(20, safe))
}

function genericInput(input: PersonalVideoRequest, properties: Record<string, any>) {
  const result: Record<string, unknown> = {}
  const prompt = input.style?.trim() ? `${input.prompt}. Visual style: ${input.style.trim()}.` : input.prompt

  const promptKey = firstSupported(properties, ["prompt", "text", "description"])
  if (promptKey) result[promptKey] = prompt
  else result.prompt = prompt

  if (input.mode === "image_to_video" && input.imageUrl) {
    const imageKey = firstSupported(properties, [
      "image_url",
      "image",
      "input_image",
      "start_image_url",
      "first_frame_image",
      "first_frame",
      "start_image",
    ])
    if (imageKey) result[imageKey] = input.imageUrl
    else result.image_url = input.imageUrl
  }

  const durationKey = firstSupported(properties, ["duration", "duration_seconds", "video_length", "seconds", "num_seconds"])
  if (durationKey) result[durationKey] = normalizedDuration(input.duration)

  const aspectKey = firstSupported(properties, ["aspect_ratio", "ratio"])
  if (aspectKey) result[aspectKey] = input.aspectRatio === "9:16" ? "9:16" : "16:9"

  const resolutionKey = firstSupported(properties, ["resolution", "video_resolution"])
  if (resolutionKey && input.resolution) result[resolutionKey] = input.resolution

  const audioKey = firstSupported(properties, ["generate_audio", "with_audio", "audio", "include_audio"])
  if (audioKey) result[audioKey] = Boolean(input.withAudio)

  return result
}

function findRemoteVideoUrl(payload: any): string | null {
  const candidates: unknown[] = [
    payload?.video?.url,
    payload?.video_url,
    payload?.url,
    payload?.output?.video?.url,
    payload?.output?.video_url,
    payload?.output?.url,
    payload?.data?.video?.url,
    payload?.data?.video_url,
  ]

  if (Array.isArray(payload?.output)) candidates.push(...payload.output)
  if (Array.isArray(payload?.videos)) candidates.push(...payload.videos.map((item: any) => item?.url || item))

  for (const value of candidates) {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value
    if (value && typeof value === "object") {
      const nested = (value as any).url
      if (typeof nested === "string" && /^https?:\/\//i.test(nested)) return nested
    }
  }
  return null
}

async function startFal(input: PersonalVideoRequest): Promise<PersonalVideoResult> {
  try {
    const descriptor = await getFalModelSchema(input.secret, input.model).catch(() => null)
    const properties = extractOpenApiInputProperties(descriptor?.openapi)
    const body = genericInput(input, properties)

    const response = await fetch(`https://queue.fal.run/${input.model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${input.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    })
    const payload = await response.json().catch(() => null) as any
    if (!response.ok) {
      return { ok: false, status: "failed", provider: "fal", model: input.model, error: compactError(payload) || `fal HTTP ${response.status}`, raw: payload || { status: response.status } }
    }

    const requestId = String(payload?.request_id || "").trim()
    if (!requestId) return { ok: false, status: "failed", provider: "fal", model: input.model, error: "fal aceptó la solicitud pero no devolvió request_id.", raw: payload || null }

    return {
      ok: true,
      status: "processing",
      provider: "fal",
      model: input.model,
      operationName: operation("fal", input.model, requestId),
      externalRequestId: requestId,
      raw: { requestId, statusUrl: payload?.status_url || null, responseUrl: payload?.response_url || null },
    }
  } catch (error) {
    return { ok: false, status: "failed", provider: "fal", model: input.model, error: error instanceof Error ? error.message : "Error iniciando fal.ai" }
  }
}

async function pollFal(input: PersonalVideoRequest, requestId: string): Promise<PersonalVideoResult> {
  try {
    const base = `https://queue.fal.run/${input.model}/requests/${encodeURIComponent(requestId)}`
    const statusResponse = await fetch(`${base}/status`, {
      headers: { Authorization: `Key ${input.secret}` },
      signal: AbortSignal.timeout(18_000),
      cache: "no-store",
    })
    const statusPayload = await statusResponse.json().catch(() => null) as any
    if (!statusResponse.ok) return { ok: false, status: "failed", provider: "fal", model: input.model, operationName: operation("fal", input.model, requestId), externalRequestId: requestId, error: compactError(statusPayload) || `fal status HTTP ${statusResponse.status}`, raw: statusPayload || null }

    const state = String(statusPayload?.status || "").toUpperCase()
    if (state === "IN_QUEUE" || state === "IN_PROGRESS") {
      return { ok: true, status: "processing", provider: "fal", model: input.model, operationName: operation("fal", input.model, requestId), externalRequestId: requestId, raw: { state, queuePosition: statusPayload?.queue_position ?? null } }
    }
    if (state !== "COMPLETED") {
      return { ok: false, status: "failed", provider: "fal", model: input.model, operationName: operation("fal", input.model, requestId), externalRequestId: requestId, error: compactError(statusPayload?.error || statusPayload) || `fal terminó en ${state || "estado desconocido"}`, raw: statusPayload || null }
    }
    if (statusPayload?.error) {
      return { ok: false, status: "failed", provider: "fal", model: input.model, operationName: operation("fal", input.model, requestId), externalRequestId: requestId, error: compactError(statusPayload.error), raw: statusPayload }
    }

    const resultResponse = await fetch(`${base}/response`, {
      headers: { Authorization: `Key ${input.secret}` },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    })
    const resultPayload = await resultResponse.json().catch(() => null) as any
    if (!resultResponse.ok) return { ok: false, status: "failed", provider: "fal", model: input.model, operationName: operation("fal", input.model, requestId), externalRequestId: requestId, error: compactError(resultPayload) || `fal result HTTP ${resultResponse.status}`, raw: resultPayload || null }

    const remoteUrl = findRemoteVideoUrl(resultPayload)
    if (!remoteUrl) return { ok: false, status: "failed", provider: "fal", model: input.model, operationName: operation("fal", input.model, requestId), externalRequestId: requestId, error: "fal completó la generación pero EduAI no encontró una URL de video en la respuesta.", raw: resultPayload || null }

    const persisted = await persistRemoteVideo({
      remoteUrl,
      userId: input.userId,
      provider: "fal",
      model: input.model,
      prompt: input.prompt,
      sourceJobId: input.sourceJobId,
      metadata: { billingMode: "personal", externalRequestId: requestId },
    })
    return { ok: true, status: "completed", provider: "fal", model: input.model, operationName: operation("fal", input.model, requestId), externalRequestId: requestId, videoUrl: persisted.videoUrl, assetId: persisted.assetId, raw: { externalRequestId: requestId, storagePath: persisted.storagePath } }
  } catch (error) {
    return { ok: false, status: "failed", provider: "fal", model: input.model, operationName: operation("fal", input.model, requestId), externalRequestId: requestId, error: error instanceof Error ? error.message : "Error consultando fal.ai" }
  }
}

async function startReplicate(input: PersonalVideoRequest): Promise<PersonalVideoResult> {
  try {
    const model = await getReplicateModel(input.secret, input.model)
    const openapi = model?.latest_version?.openapi_schema || model?.latest_version?.openapi || null
    const properties = extractOpenApiInputProperties(openapi)
    const bodyInput = genericInput(input, properties)
    const [owner, name] = input.model.split("/")
    if (!owner || !name) throw new Error("Modelo Replicate inválido")

    let url: string
    let body: Record<string, unknown>
    if (model?.latest_version?.id) {
      url = "https://api.replicate.com/v1/predictions"
      body = { version: model.latest_version.id, input: bodyInput }
    } else {
      url = `https://api.replicate.com/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`
      body = { input: bodyInput }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    })
    const payload = await response.json().catch(() => null) as any
    if (!response.ok) return { ok: false, status: "failed", provider: "replicate", model: input.model, error: compactError(payload) || `Replicate HTTP ${response.status}`, raw: payload || null }

    const requestId = String(payload?.id || "").trim()
    if (!requestId) return { ok: false, status: "failed", provider: "replicate", model: input.model, error: "Replicate aceptó la solicitud pero no devolvió prediction id.", raw: payload || null }

    const state = String(payload?.status || "").toLowerCase()
    if (state === "succeeded") {
      const remoteUrl = findRemoteVideoUrl(payload)
      if (remoteUrl) {
        const persisted = await persistRemoteVideo({ remoteUrl, userId: input.userId, provider: "replicate", model: input.model, prompt: input.prompt, sourceJobId: input.sourceJobId, metadata: { billingMode: "personal", externalRequestId: requestId } })
        return { ok: true, status: "completed", provider: "replicate", model: input.model, externalRequestId: requestId, operationName: operation("replicate", input.model, requestId), videoUrl: persisted.videoUrl, assetId: persisted.assetId, raw: { externalRequestId: requestId, storagePath: persisted.storagePath } }
      }
    }

    if (["failed", "canceled"].includes(state)) return { ok: false, status: "failed", provider: "replicate", model: input.model, externalRequestId: requestId, operationName: operation("replicate", input.model, requestId), error: compactError(payload?.error || payload) }

    return { ok: true, status: "processing", provider: "replicate", model: input.model, externalRequestId: requestId, operationName: operation("replicate", input.model, requestId), raw: { state: state || "starting" } }
  } catch (error) {
    return { ok: false, status: "failed", provider: "replicate", model: input.model, error: error instanceof Error ? error.message : "Error iniciando Replicate" }
  }
}

async function pollReplicate(input: PersonalVideoRequest, requestId: string): Promise<PersonalVideoResult> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${input.secret}` },
      signal: AbortSignal.timeout(18_000),
      cache: "no-store",
    })
    const payload = await response.json().catch(() => null) as any
    if (!response.ok) return { ok: false, status: "failed", provider: "replicate", model: input.model, externalRequestId: requestId, operationName: operation("replicate", input.model, requestId), error: compactError(payload) || `Replicate status HTTP ${response.status}`, raw: payload || null }

    const state = String(payload?.status || "").toLowerCase()
    if (["starting", "processing"].includes(state)) return { ok: true, status: "processing", provider: "replicate", model: input.model, externalRequestId: requestId, operationName: operation("replicate", input.model, requestId), raw: { state } }
    if (state !== "succeeded") return { ok: false, status: "failed", provider: "replicate", model: input.model, externalRequestId: requestId, operationName: operation("replicate", input.model, requestId), error: compactError(payload?.error || payload) || `Replicate terminó en ${state || "estado desconocido"}`, raw: payload || null }

    const remoteUrl = findRemoteVideoUrl(payload)
    if (!remoteUrl) return { ok: false, status: "failed", provider: "replicate", model: input.model, externalRequestId: requestId, operationName: operation("replicate", input.model, requestId), error: "Replicate completó la predicción pero EduAI no encontró una URL de video.", raw: payload || null }

    const persisted = await persistRemoteVideo({
      remoteUrl,
      userId: input.userId,
      provider: "replicate",
      model: input.model,
      prompt: input.prompt,
      sourceJobId: input.sourceJobId,
      metadata: { billingMode: "personal", externalRequestId: requestId },
    })
    return { ok: true, status: "completed", provider: "replicate", model: input.model, externalRequestId: requestId, operationName: operation("replicate", input.model, requestId), videoUrl: persisted.videoUrl, assetId: persisted.assetId, raw: { externalRequestId: requestId, storagePath: persisted.storagePath } }
  } catch (error) {
    return { ok: false, status: "failed", provider: "replicate", model: input.model, externalRequestId: requestId, operationName: operation("replicate", input.model, requestId), error: error instanceof Error ? error.message : "Error consultando Replicate" }
  }
}

export async function startPersonalVideo(input: PersonalVideoRequest): Promise<PersonalVideoResult> {
  if (input.provider === "fal") return startFal(input)
  if (input.provider === "replicate") return startReplicate(input)
  return {
    ok: false,
    status: "failed",
    provider: input.provider,
    model: input.model,
    error: "Hugging Face Personal está disponible para explorar/conectar, pero la ejecución de video permanece en beta. Usa fal.ai o Replicate para generación premium personal.",
  }
}

export async function pollPersonalVideo(input: PersonalVideoRequest & { operationName: string }): Promise<PersonalVideoResult> {
  const parsed = parsePersonalVideoOperation(input.operationName)
  if (!parsed) return { ok: false, status: "failed", provider: input.provider, model: input.model, error: "Identificador de operación personal inválido." }
  const normalized = { ...input, provider: parsed.provider, model: parsed.model }
  return parsed.provider === "fal"
    ? pollFal(normalized, parsed.requestId)
    : pollReplicate(normalized, parsed.requestId)
}
