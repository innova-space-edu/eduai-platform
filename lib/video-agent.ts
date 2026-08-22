import { fetchSafeRemoteBytes } from "@/lib/safe-remote-url"
import { isWanVideoConfigured, pollWanVideo, startWanVideo } from "@/lib/video/providers/wan"
import { isHFGradioVideoConfigured, pollHFGradioVideo, startHFGradioVideo } from "@/lib/video/providers/hf-gradio"
import { persistRemoteVideo } from "@/lib/video/persist-remote-video"

export type VideoMode = "text_to_video" | "image_to_video"

export type ProcessVideoJobInput = {
  prompt: string
  style?: string | null
  duration?: number | null
  withAudio?: boolean | null
  mode?: VideoMode | string | null
  imageUrl?: string | null
  aspectRatio?: "16:9" | "9:16" | string | null
  resolution?: "720p" | "1080p" | "4k" | string | null
  operationName?: string | null
  userId?: string | null
  sourceJobId?: string | null
  model?: string | null
  provider?: string | null
}

export type ProcessVideoJobResult = {
  ok: boolean
  status?: "processing" | "completed" | "failed" | "blocked"
  provider?: string | null
  model?: string | null
  videoUrl?: string | null
  thumbnailUrl?: string | null
  operationName?: string | null
  assetId?: string | null
  error?: string | null
  moderationReason?: string | null
  raw?: Record<string, unknown> | null
}

const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

function normalizePrompt(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function normalizeMode(value: string | null | undefined): VideoMode {
  return value === "image_to_video" ? "image_to_video" : "text_to_video"
}

function normalizeDuration(value: number | null | undefined): number {
  const safe = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 6
  return Math.min(10, Math.max(2, safe))
}

function normalizeVeoDuration(value: number, resolution: "720p" | "1080p" | "4k"): 4 | 6 | 8 {
  if (resolution !== "720p") return 8
  if (value <= 5) return 4
  if (value <= 7) return 6
  return 8
}

function normalizeAspectRatio(value: string | null | undefined): "16:9" | "9:16" {
  return value === "9:16" ? "9:16" : "16:9"
}

function normalizeResolution(value: string | null | undefined): "720p" | "1080p" | "4k" {
  if (value === "1080p") return "1080p"
  if (value === "4k") return "4k"
  return "720p"
}

function basicModeration(prompt: string) {
  const text = prompt.toLowerCase()
  const blockedTerms = [
    "child sexual",
    "explicit minor",
    "rape",
    "bestiality",
    "sexual violence",
  ]
  const matched = blockedTerms.find((term) => text.includes(term))
  if (matched) return { blocked: true, reason: `Prompt bloqueado por moderación básica: ${matched}` }
  return { blocked: false, reason: null }
}

function googleVideoKey(): string | null {
  return process.env.GEMINI_API_KEY_VIDEO || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null
}

function googleVideoModel(): string {
  return process.env.GOOGLE_VIDEO_MODEL_PRIMARY || "veo-3.1-generate-preview"
}

async function fetchImageInput(url: string) {
  const { buffer, mimeType } = await fetchSafeRemoteBytes({
    url,
    maxBytes: 25 * 1024 * 1024,
    timeoutMs: 20_000,
    maxRedirects: 4,
    userAgent: "EduAI-Veo-Image/1.0",
  })
  if (!mimeType.startsWith("image/")) throw new Error(`La imagen base no tiene un MIME de imagen válido (${mimeType}).`)
  return { data: buffer.toString("base64"), mimeType }
}

async function startGoogleVeo(input: {
  prompt: string
  style: string
  duration: number
  mode: VideoMode
  imageUrl: string | null
  aspectRatio: "16:9" | "9:16"
  resolution: "720p" | "1080p" | "4k"
  model?: string | null
}): Promise<ProcessVideoJobResult> {
  const key = googleVideoKey()
  if (!key) throw new Error("GEMINI_API_KEY no configurada para Video Studio")
  const model = input.model || googleVideoModel()
  const durationSeconds = normalizeVeoDuration(input.duration, input.resolution)
  const prompt = input.style ? `${input.prompt}. Visual style: ${input.style}.` : input.prompt

  const instance: Record<string, unknown> = { prompt }
  if (input.mode === "image_to_video") {
    if (!input.imageUrl) throw new Error("Veo imagen a video requiere una imagen base.")
    const image = await fetchImageInput(input.imageUrl)
    instance.image = { inlineData: { mimeType: image.mimeType, data: image.data } }
  }

  const response = await fetch(`${GOOGLE_BASE_URL}/models/${encodeURIComponent(model)}:predictLongRunning`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        aspectRatio: input.aspectRatio,
        durationSeconds: String(durationSeconds),
        resolution: input.resolution,
        personGeneration: input.mode === "image_to_video" ? "allow_adult" : "allow_all",
      },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  const raw = await response.json().catch(() => null) as any
  if (!response.ok) {
    throw new Error(raw?.error?.message || raw?.message || `Google Veo devolvió HTTP ${response.status}`)
  }

  const operationName = raw?.name
  if (!operationName) throw new Error("Google Veo no devolvió un operation name")

  return {
    ok: true,
    status: "processing",
    provider: "google",
    model,
    operationName,
    raw: {
      phase: "submitted",
      operationName,
      durationSeconds,
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
      nativeAudio: true,
      transport: "gemini-rest",
    },
  }
}

async function pollGoogleVeo(input: {
  operationName: string
  userId: string
  prompt: string
  sourceJobId?: string | null
  model?: string | null
}): Promise<ProcessVideoJobResult> {
  const key = googleVideoKey()
  if (!key) return { ok: false, status: "failed", provider: "google", error: "GEMINI_API_KEY dejó de estar configurada." }
  const model = input.model || googleVideoModel()
  const response = await fetch(`${GOOGLE_BASE_URL}/${input.operationName}`, {
    headers: { "x-goog-api-key": key },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  })
  const raw = await response.json().catch(() => null) as any
  if (!response.ok) {
    return {
      ok: false,
      status: "failed",
      provider: "google",
      model,
      operationName: input.operationName,
      error: raw?.error?.message || raw?.message || `Google polling devolvió HTTP ${response.status}`,
      raw: raw && typeof raw === "object" ? raw : { status: response.status },
    }
  }

  if (!raw?.done) {
    return {
      ok: true,
      status: "processing",
      provider: "google",
      model,
      operationName: input.operationName,
      raw: { ...(raw || {}), phase: "polling", transport: "gemini-rest" },
    }
  }

  const operationError = raw?.error
  if (operationError) {
    return {
      ok: false,
      status: "failed",
      provider: "google",
      model,
      operationName: input.operationName,
      error: operationError?.message || "Google Veo informó un error.",
      raw: raw && typeof raw === "object" ? raw : null,
    }
  }

  const remoteUrl =
    raw?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
    raw?.response?.generatedVideos?.[0]?.video?.uri ||
    raw?.response?.generatedVideos?.[0]?.video?.url ||
    null

  if (!remoteUrl) {
    return {
      ok: false,
      status: "failed",
      provider: "google",
      model,
      operationName: input.operationName,
      error: "Google terminó la operación sin entregar un video.",
      raw: raw && typeof raw === "object" ? raw : null,
    }
  }

  const persisted = await persistRemoteVideo({
    remoteUrl,
    userId: input.userId,
    provider: "google",
    model,
    prompt: input.prompt,
    sourceJobId: input.sourceJobId,
    headers: { "x-goog-api-key": key },
    metadata: { synthid: true, source: "gemini-veo-rest" },
  })

  return {
    ok: true,
    status: "completed",
    provider: "google",
    model,
    operationName: input.operationName,
    videoUrl: persisted.videoUrl,
    assetId: persisted.assetId,
    raw: {
      phase: "persisted",
      operationName: input.operationName,
      assetId: persisted.assetId,
      storageBucket: "eduai-assets",
      storagePath: persisted.storagePath,
      transport: "gemini-rest",
    },
  }
}

async function runHFSpaceProvider(input: {
  prompt: string
  style: string
  duration: number
  withAudio: boolean
  mode: VideoMode
  imageUrl: string | null
  userId?: string | null
  sourceJobId?: string | null
}): Promise<ProcessVideoJobResult> {
  const hfSpaceUrl = process.env.HF_SPACE_VIDEO_API_URL
  const hfSpaceToken = process.env.HF_SPACE_VIDEO_API_TOKEN
  if (!hfSpaceUrl) {
    return { ok: false, status: "failed", provider: "hf-space", error: "No hay un provider de respaldo de video configurado.", raw: { phase: "hf-space", configured: false } }
  }

  try {
    const response = await fetch(hfSpaceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(hfSpaceToken ? { Authorization: `Bearer ${hfSpaceToken}` } : {}),
      },
      body: JSON.stringify({
        prompt: input.prompt,
        style: input.style,
        duration: input.duration,
        withAudio: input.withAudio,
        mode: input.mode,
        imageUrl: input.imageUrl,
      }),
      signal: AbortSignal.timeout(50_000),
    })
    const raw = await response.json().catch(() => null) as any
    if (!response.ok) {
      return { ok: false, status: "failed", provider: "hf-space", model: raw?.model || null, error: raw?.error || raw?.message || `El provider devolvió HTTP ${response.status}.`, raw: raw && typeof raw === "object" ? raw : { status: response.status } }
    }

    const remoteVideoUrl = raw?.videoUrl || raw?.video_url || raw?.output_url || raw?.url || null
    if (!remoteVideoUrl) {
      return { ok: false, status: "failed", provider: "hf-space", model: raw?.model || null, error: "El provider respondió, pero no entregó una URL de video.", raw: raw && typeof raw === "object" ? raw : null }
    }

    if (input.userId) {
      const persisted = await persistRemoteVideo({
        remoteUrl: remoteVideoUrl,
        userId: input.userId,
        provider: "hf-space",
        model: raw?.model || null,
        prompt: input.prompt,
        sourceJobId: input.sourceJobId,
        metadata: { source: "hf-space-legacy", providerUrlExpires: true },
      })
      return {
        ok: true,
        status: "completed",
        provider: "hf-space",
        model: raw?.model || null,
        videoUrl: persisted.videoUrl,
        thumbnailUrl: raw?.thumbnailUrl || raw?.thumbnail_url || raw?.poster_url || null,
        assetId: persisted.assetId,
        raw: { ...(raw || {}), phase: "persisted", assetId: persisted.assetId, storageBucket: "eduai-assets", storagePath: persisted.storagePath },
      }
    }

    return { ok: true, status: "completed", provider: "hf-space", model: raw?.model || null, videoUrl: remoteVideoUrl, thumbnailUrl: raw?.thumbnailUrl || raw?.thumbnail_url || raw?.poster_url || null, raw: raw && typeof raw === "object" ? raw : null }
  } catch (error) {
    return { ok: false, status: "failed", provider: "hf-space", error: error instanceof Error ? error.message : "Error inesperado en el provider de respaldo.", raw: { phase: "hf-space", exception: true } }
  }
}

function videoProviderOrder(): string[] {
  const configured = (process.env.VIDEO_PROVIDER_ORDER || "wan,hf-gradio,hf-space,google")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value === "replicate" || value === "veo" ? "google" : value)
    .filter((value) => ["wan", "hf-gradio", "google", "hf-space", "ltx", "wan-worker"].includes(value))

  const order = Array.from(new Set(configured))
  if (isWanVideoConfigured() && !order.includes("wan")) order.unshift("wan")
  if (isHFGradioVideoConfigured() && !order.includes("hf-gradio")) order.splice(order[0] === "wan" ? 1 : 0, 0, "hf-gradio")
  if (process.env.HF_SPACE_VIDEO_API_URL && !order.includes("hf-space")) {
    const googleIndex = order.indexOf("google")
    if (googleIndex >= 0) order.splice(googleIndex, 0, "hf-space")
    else order.push("hf-space")
  }

  const premiumConfigured = order.includes("google") || Boolean(googleVideoKey())
  const freeFirst = order.filter((provider) => provider !== "google")
  if (premiumConfigured) freeFirst.push("google")

  if (!freeFirst.length) {
    const fallback: string[] = []
    if (isWanVideoConfigured()) fallback.push("wan")
    if (isHFGradioVideoConfigured()) fallback.push("hf-gradio")
    if (process.env.HF_SPACE_VIDEO_API_URL) fallback.push("hf-space")
    if (googleVideoKey()) fallback.push("google")
    return fallback
  }
  return freeFirst
}

export async function processVideoJob(input: ProcessVideoJobInput): Promise<ProcessVideoJobResult> {
  const prompt = normalizePrompt(input.prompt)
  const style = normalizePrompt(input.style ?? "")
  const duration = normalizeDuration(input.duration ?? 6)
  const withAudio = Boolean(input.withAudio)
  const mode = normalizeMode(input.mode)
  const imageUrl = typeof input.imageUrl === "string" && input.imageUrl.trim() ? input.imageUrl.trim() : null
  const aspectRatio = normalizeAspectRatio(input.aspectRatio)
  const resolution = normalizeResolution(input.resolution || process.env.GOOGLE_VIDEO_RESOLUTION || "720p")

  if (!prompt || prompt.length < 8) return { ok: false, status: "failed", error: "El prompt es demasiado corto para generar el video.", raw: { validation: "prompt_too_short" } }
  if (prompt.length > 2000) return { ok: false, status: "failed", error: "El prompt es demasiado largo.", raw: { validation: "prompt_too_long" } }
  if (mode === "image_to_video" && !imageUrl) return { ok: false, status: "failed", error: "El modo imagen a video requiere una imagen base.", raw: { validation: "image_required" } }

  const moderation = basicModeration(prompt)
  if (moderation.blocked) {
    return { ok: false, status: "blocked", moderationReason: moderation.reason, error: moderation.reason, raw: { moderation: "blocked", reason: moderation.reason } }
  }

  if (input.operationName) {
    if (!input.userId) return { ok: false, status: "failed", provider: input.provider || null, error: "Falta userId para persistir el video terminado." }
    if (input.provider === "wan" || input.operationName.startsWith("wan:")) {
      return pollWanVideo({ operationName: input.operationName, userId: input.userId, prompt, sourceJobId: input.sourceJobId, model: input.model })
    }
    if (input.provider === "hf-gradio" || input.operationName.startsWith("hf:")) {
      return pollHFGradioVideo({ operationName: input.operationName, userId: input.userId, prompt, sourceJobId: input.sourceJobId, model: input.model })
    }
    return pollGoogleVeo({ operationName: input.operationName, userId: input.userId, prompt, sourceJobId: input.sourceJobId, model: input.model })
  }

  const errors: string[] = []
  for (const provider of videoProviderOrder()) {
    if (provider === "wan") {
      if (!isWanVideoConfigured()) { errors.push("wan: proveedor no configurado"); continue }
      const result = await startWanVideo({ prompt, style, duration, mode, imageUrl, aspectRatio, resolution })
      if (result.ok) return result
      errors.push(`wan: ${result.error || "falló"}`)
      continue
    }

    if (provider === "hf-gradio") {
      if (!isHFGradioVideoConfigured()) { errors.push("hf-gradio: proveedor no configurado"); continue }
      const result = await startHFGradioVideo({ prompt, style, duration, mode, imageUrl, aspectRatio, resolution })
      if (result.ok) return result
      errors.push(`hf-gradio: ${result.error || "falló"}`)
      continue
    }

    if (provider === "hf-space" || provider === "ltx" || provider === "wan-worker") {
      const result = await runHFSpaceProvider({ prompt, style, duration, withAudio, mode, imageUrl, userId: input.userId, sourceJobId: input.sourceJobId })
      if (result.ok) return result
      errors.push(`${provider}: ${result.error || "falló"}`)
      continue
    }

    if (provider === "google") {
      if (!googleVideoKey()) { errors.push("google: GEMINI_API_KEY no configurada"); continue }
      try {
        return await startGoogleVeo({ prompt, style, duration, mode, imageUrl, aspectRatio, resolution, model: input.model })
      } catch (error) {
        errors.push(`google: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  return {
    ok: false,
    status: "failed",
    error: `No se pudo iniciar la generación de video. ${errors.join(" | ")}`,
    raw: { providers: videoProviderOrder(), errors },
  }
}
