import { persistRemoteVideo } from "@/lib/video/persist-remote-video"

export type HFGradioVideoResult = {
  ok: boolean
  status: "processing" | "completed" | "failed"
  provider: "hf-gradio"
  model?: string | null
  operationName?: string | null
  videoUrl?: string | null
  assetId?: string | null
  error?: string | null
  raw?: Record<string, unknown> | null
}

function baseUrl() {
  return process.env.HF_GRADIO_VIDEO_BASE_URL?.trim().replace(/\/$/, "") || null
}

function token() {
  return process.env.HF_GRADIO_VIDEO_TOKEN || process.env.HF_TOKEN || null
}

function apiName() {
  return (process.env.HF_GRADIO_VIDEO_API_NAME || "generate").replace(/^\//, "")
}

function modelName() {
  return process.env.HF_GRADIO_VIDEO_MODEL || "Wan-AI/Wan2.1-T2V-1.3B-Diffusers"
}

export function isHFGradioVideoConfigured() {
  return Boolean(baseUrl())
}

function headers(extra?: Record<string, string>) {
  const hfToken = token()
  return {
    ...(hfToken ? { Authorization: `Bearer ${hfToken}` } : {}),
    ...extra,
  }
}

function parseEventData(text: string) {
  const lines = text.split(/\r?\n/)
  let event = ""
  let data = ""
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim()
    if (line.startsWith("data:")) data = line.slice(5).trim()
  }
  if (!event) return null
  let parsed: unknown = data
  try { parsed = JSON.parse(data) } catch {}
  return { event, data: parsed }
}

function findVideoUrl(value: unknown): string | null {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrl(item)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>
    for (const key of ["url", "videoUrl", "video_url", "output_url"]) {
      const candidate = object[key]
      if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) return candidate
    }
    for (const candidate of Object.values(object)) {
      const found = findVideoUrl(candidate)
      if (found) return found
    }
  }
  return null
}

export async function startHFGradioVideo(input: {
  prompt: string
  style?: string | null
  duration: number
  mode: "text_to_video" | "image_to_video"
  imageUrl?: string | null
  aspectRatio: "16:9" | "9:16"
  resolution: "720p" | "1080p" | "4k"
}): Promise<HFGradioVideoResult> {
  const url = baseUrl()
  const model = modelName()
  if (!url) return { ok: false, status: "failed", provider: "hf-gradio", model, error: "Hugging Face Gradio no está configurado." }

  try {
    const response = await fetch(`${url}/gradio_api/call/${encodeURIComponent(apiName())}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        data: [
          input.prompt,
          input.style || "",
          input.duration,
          input.mode,
          input.imageUrl || "",
          input.aspectRatio,
          input.resolution,
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const raw = await response.json().catch(() => null) as any
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "hf-gradio",
        model,
        error: raw?.detail || raw?.message || `Hugging Face Space devolvió HTTP ${response.status}`,
        raw: raw && typeof raw === "object" ? raw : { status: response.status },
      }
    }

    const eventId = raw?.event_id
    if (!eventId) {
      return { ok: false, status: "failed", provider: "hf-gradio", model, error: "Hugging Face Space respondió sin event_id.", raw }
    }

    return {
      ok: true,
      status: "processing",
      provider: "hf-gradio",
      model,
      operationName: `hf:${eventId}`,
      raw: { phase: "submitted", eventId, apiName: apiName() },
    }
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      provider: "hf-gradio",
      model,
      error: error instanceof Error ? error.message : "Error inesperado enviando el trabajo al Space.",
      raw: { phase: "submit_exception" },
    }
  }
}

export async function pollHFGradioVideo(input: {
  operationName: string
  userId: string
  prompt: string
  sourceJobId?: string | null
  model?: string | null
}): Promise<HFGradioVideoResult> {
  const url = baseUrl()
  const model = input.model || modelName()
  const eventId = input.operationName.startsWith("hf:") ? input.operationName.slice(3) : input.operationName
  if (!url) return { ok: false, status: "failed", provider: "hf-gradio", model, error: "Hugging Face Gradio dejó de estar configurado." }

  try {
    const response = await fetch(`${url}/gradio_api/call/${encodeURIComponent(apiName())}/${encodeURIComponent(eventId)}`, {
      headers: headers(),
      signal: AbortSignal.timeout(12_000),
    })
    const text = await response.text()
    if (!response.ok) {
      return { ok: false, status: "failed", provider: "hf-gradio", model, operationName: `hf:${eventId}`, error: `Hugging Face polling devolvió HTTP ${response.status}`, raw: { body: text.slice(0, 2000) } }
    }

    const parsed = parseEventData(text)
    if (!parsed || parsed.event === "heartbeat" || parsed.event === "generating") {
      return { ok: true, status: "processing", provider: "hf-gradio", model, operationName: `hf:${eventId}`, raw: { phase: "polling", eventId } }
    }
    if (parsed.event === "error") {
      return { ok: false, status: "failed", provider: "hf-gradio", model, operationName: `hf:${eventId}`, error: typeof parsed.data === "string" ? parsed.data : "El Space devolvió un error.", raw: { event: parsed.event, data: parsed.data } }
    }
    if (parsed.event !== "complete") {
      return { ok: true, status: "processing", provider: "hf-gradio", model, operationName: `hf:${eventId}`, raw: { phase: parsed.event, data: parsed.data } }
    }

    const remoteUrl = findVideoUrl(parsed.data)
    if (!remoteUrl) {
      return { ok: false, status: "failed", provider: "hf-gradio", model, operationName: `hf:${eventId}`, error: "El Space completó la generación pero no entregó una URL de video.", raw: { event: parsed.event, data: parsed.data } }
    }

    const persisted = await persistRemoteVideo({
      remoteUrl,
      userId: input.userId,
      provider: "hf-gradio",
      model,
      prompt: input.prompt,
      sourceJobId: input.sourceJobId,
      metadata: { eventId, source: "hugging-face-space" },
    })

    return {
      ok: true,
      status: "completed",
      provider: "hf-gradio",
      model,
      operationName: `hf:${eventId}`,
      videoUrl: persisted.videoUrl,
      assetId: persisted.assetId,
      raw: {
        phase: "persisted",
        eventId,
        assetId: persisted.assetId,
        storageBucket: "eduai-assets",
        storagePath: persisted.storagePath,
      },
    }
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return { ok: true, status: "processing", provider: "hf-gradio", model, operationName: `hf:${eventId}`, raw: { phase: "waiting", eventId } }
    }
    return {
      ok: false,
      status: "failed",
      provider: "hf-gradio",
      model,
      operationName: `hf:${eventId}`,
      error: error instanceof Error ? error.message : "Error inesperado consultando el Space.",
      raw: { phase: "poll_exception", eventId },
    }
  }
}
