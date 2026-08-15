import { GoogleGenAI } from "@google/genai"
import { createClient as createAdmin } from "@supabase/supabase-js"

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

function normalizePrompt(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function normalizeMode(value: string | null | undefined): VideoMode {
  return value === "image_to_video" ? "image_to_video" : "text_to_video"
}

function normalizeDuration(value: number | null | undefined): number {
  const safe = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 6
  if (safe <= 5) return 4
  if (safe <= 7) return 6
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
  if (matched) {
    return { blocked: true, reason: `Prompt bloqueado por moderación básica: ${matched}` }
  }
  return { blocked: false, reason: null }
}

function googleVideoKey(): string | null {
  return process.env.GEMINI_API_KEY_VIDEO || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null
}

function googleVideoModel(): string {
  return process.env.GOOGLE_VIDEO_MODEL_PRIMARY || "veo-3.1-generate-preview"
}

function googleClient() {
  const apiKey = googleVideoKey()
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada para Video Studio")
  return new GoogleGenAI({ apiKey })
}

async function fetchImageInput(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`No se pudo leer la imagen base: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer()).toString("base64")
  const mimeType = response.headers.get("content-type") || "image/png"
  return { imageBytes: bytes, mimeType }
}

async function startGoogleVeo(input: {
  prompt: string
  style: string
  duration: number
  mode: VideoMode
  imageUrl: string | null
  aspectRatio: "16:9" | "9:16"
  resolution: "720p" | "1080p" | "4k"
}): Promise<ProcessVideoJobResult> {
  const ai = googleClient()
  const model = googleVideoModel()
  const requestedResolution = input.resolution
  const durationSeconds = requestedResolution === "720p" ? input.duration : 8
  const prompt = input.style ? `${input.prompt}. Visual style: ${input.style}.` : input.prompt

  const image = input.mode === "image_to_video" && input.imageUrl
    ? await fetchImageInput(input.imageUrl)
    : undefined

  const operation = await ai.models.generateVideos({
    model,
    prompt,
    ...(image ? { image } : {}),
    config: {
      aspectRatio: input.aspectRatio,
      durationSeconds,
      resolution: requestedResolution,
      numberOfVideos: 1,
      ...(image ? { personGeneration: "allow_adult" } : {}),
    },
  } as any)

  const operationName = (operation as any)?.name || null
  if (!operationName) throw new Error("Google Veo no devolvió un operation name")

  return {
    ok: true,
    status: "processing",
    provider: "google",
    model,
    operationName,
    raw: {
      operationName,
      durationSeconds,
      resolution: requestedResolution,
      aspectRatio: input.aspectRatio,
      nativeAudio: true,
      phase: "submitted",
    },
  }
}

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdmin(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function persistGoogleVideo(input: {
  uri: string
  userId: string
  model: string
  prompt: string
  sourceJobId?: string | null
}) {
  const apiKey = googleVideoKey()
  if (!apiKey) throw new Error("Falta API key para descargar el video de Google")

  const response = await fetch(input.uri, {
    headers: { "x-goog-api-key": apiKey },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`No se pudo descargar el video de Google: HTTP ${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.byteLength) throw new Error("Google devolvió un video vacío")
  if (buffer.byteLength > 500 * 1024 * 1024) throw new Error("El video supera el límite de almacenamiento de EduAI")

  const supabase = getAdminSupabase()
  const path = `${input.userId}/video/${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`
  const { error: uploadError } = await supabase.storage
    .from("eduai-assets")
    .upload(path, buffer, { contentType: "video/mp4", upsert: false })
  if (uploadError) throw new Error(`No se pudo guardar el video en EduAI: ${uploadError.message}`)

  const { data: asset, error: assetError } = await supabase
    .from("eduai_assets")
    .insert({
      owner_id: input.userId,
      asset_type: "video",
      title: input.prompt.slice(0, 180),
      mime_type: "video/mp4",
      storage_bucket: "eduai-assets",
      storage_path: path,
      source_module: "video-studio",
      source_id: input.sourceJobId || null,
      visibility: "private",
      metadata: {
        provider: "google",
        model: input.model,
        synthid: true,
      },
    })
    .select("id")
    .maybeSingle()

  if (assetError) console.warn("[Video][Asset]", assetError.message)

  return {
    assetId: asset?.id || null,
    storagePath: path,
    videoUrl: `supabase://eduai-assets/${path}`,
  }
}

async function pollGoogleVeo(input: {
  operationName: string
  userId: string
  prompt: string
  sourceJobId?: string | null
}): Promise<ProcessVideoJobResult> {
  const ai = googleClient()
  const model = googleVideoModel()

  const operation = await ai.operations.getVideosOperation({
    operation: { name: input.operationName } as any,
  } as any)

  if (!(operation as any).done) {
    return {
      ok: true,
      status: "processing",
      provider: "google",
      model,
      operationName: input.operationName,
      raw: { operationName: input.operationName, phase: "polling" },
    }
  }

  const generatedVideo = (operation as any)?.response?.generatedVideos?.[0]
  const video = generatedVideo?.video
  const uri = video?.uri

  if (!uri) {
    const operationError = (operation as any)?.error
    return {
      ok: false,
      status: "failed",
      provider: "google",
      model,
      operationName: input.operationName,
      error: operationError?.message || "Google terminó la operación sin entregar un video.",
      raw: { operationName: input.operationName, phase: "completed_without_video", operationError },
    }
  }

  const persisted = await persistGoogleVideo({
    uri,
    userId: input.userId,
    model,
    prompt: input.prompt,
    sourceJobId: input.sourceJobId,
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
      operationName: input.operationName,
      phase: "persisted",
      assetId: persisted.assetId,
      storageBucket: "eduai-assets",
      storagePath: persisted.storagePath,
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
}): Promise<ProcessVideoJobResult> {
  const hfSpaceUrl = process.env.HF_SPACE_VIDEO_API_URL
  const hfSpaceToken = process.env.HF_SPACE_VIDEO_API_TOKEN
  if (!hfSpaceUrl) {
    return {
      ok: false,
      status: "failed",
      provider: "hf-space",
      error: "No hay un provider de respaldo de video configurado.",
      raw: { phase: "hf-space", configured: false },
    }
  }

  try {
    const response = await fetch(hfSpaceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(hfSpaceToken ? { Authorization: `Bearer ${hfSpaceToken}` } : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(50_000),
    })
    const raw = await response.json().catch(() => null)
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "hf-space",
        model: raw?.model || null,
        error: raw?.error || raw?.message || `El provider devolvió HTTP ${response.status}.`,
        raw: raw && typeof raw === "object" ? raw : { status: response.status },
      }
    }

    const videoUrl = raw?.videoUrl || raw?.video_url || raw?.output_url || raw?.url || null
    if (!videoUrl) {
      return {
        ok: false,
        status: "failed",
        provider: "hf-space",
        model: raw?.model || null,
        error: "El provider respondió, pero no entregó una URL de video.",
        raw: raw && typeof raw === "object" ? raw : null,
      }
    }

    return {
      ok: true,
      status: "completed",
      provider: "hf-space",
      model: raw?.model || null,
      videoUrl,
      thumbnailUrl: raw?.thumbnailUrl || raw?.thumbnail_url || raw?.poster_url || null,
      raw: raw && typeof raw === "object" ? raw : null,
    }
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      provider: "hf-space",
      error: error instanceof Error ? error.message : "Error inesperado en el provider de respaldo.",
      raw: { phase: "hf-space", exception: true },
    }
  }
}

function videoProviderOrder(): string[] {
  const configured = (process.env.VIDEO_PROVIDER_ORDER || "google,hf-space")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    // Compatibilidad con la configuración anterior de EduAI. Replicate nunca tuvo
    // implementación en este motor; si todavía aparece en Vercel, migrarlo a Veo.
    .map((value) => value === "replicate" || value === "veo" ? "google" : value)
    .filter((value) => ["google", "hf-space", "ltx", "wan-worker"].includes(value))

  const order = Array.from(new Set(configured))
  if (!order.length) return googleVideoKey() ? ["google", "hf-space"] : ["hf-space"]
  return order
}

export async function processVideoJob(
  input: ProcessVideoJobInput
): Promise<ProcessVideoJobResult> {
  const prompt = normalizePrompt(input.prompt)
  const style = normalizePrompt(input.style ?? "")
  const duration = normalizeDuration(input.duration ?? 6)
  const withAudio = Boolean(input.withAudio)
  const mode = normalizeMode(input.mode)
  const imageUrl = typeof input.imageUrl === "string" && input.imageUrl.trim() ? input.imageUrl.trim() : null
  const aspectRatio = normalizeAspectRatio(input.aspectRatio)
  const resolution = normalizeResolution(input.resolution || process.env.GOOGLE_VIDEO_RESOLUTION || "720p")

  if (!prompt || prompt.length < 8) {
    return { ok: false, status: "failed", error: "El prompt es demasiado corto para generar el video.", raw: { validation: "prompt_too_short" } }
  }
  if (prompt.length > 2000) {
    return { ok: false, status: "failed", error: "El prompt es demasiado largo.", raw: { validation: "prompt_too_long" } }
  }
  if (mode === "image_to_video" && !imageUrl) {
    return { ok: false, status: "failed", error: "El modo imagen a video requiere una imagen base.", raw: { validation: "image_required" } }
  }

  const moderation = basicModeration(prompt)
  if (moderation.blocked) {
    return {
      ok: false,
      status: "blocked",
      moderationReason: moderation.reason,
      error: moderation.reason,
      raw: { moderation: "blocked", reason: moderation.reason },
    }
  }

  if (input.operationName) {
    if (!input.userId) return { ok: false, status: "failed", provider: "google", error: "Falta userId para persistir el video terminado." }
    return pollGoogleVeo({
      operationName: input.operationName,
      userId: input.userId,
      prompt,
      sourceJobId: input.sourceJobId,
    })
  }

  const errors: string[] = []
  for (const provider of videoProviderOrder()) {
    if (provider === "google") {
      if (!googleVideoKey()) {
        errors.push("google: GEMINI_API_KEY no configurada")
        continue
      }
      try {
        return await startGoogleVeo({ prompt, style, duration, mode, imageUrl, aspectRatio, resolution })
      } catch (error) {
        errors.push(`google: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }
    }

    if (provider === "hf-space" || provider === "ltx" || provider === "wan-worker") {
      const result = await runHFSpaceProvider({ prompt, style, duration, withAudio, mode, imageUrl })
      if (result.ok) return result
      errors.push(`${provider}: ${result.error || "falló"}`)
    }
  }

  return {
    ok: false,
    status: "failed",
    error: `No se pudo iniciar la generación de video. ${errors.join(" | ")}`,
    raw: { providers: videoProviderOrder(), errors },
  }
}