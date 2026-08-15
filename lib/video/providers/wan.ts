import { persistRemoteVideo } from "@/lib/video/persist-remote-video"

export type WanVideoResult = {
  ok: boolean
  status: "processing" | "completed" | "failed"
  provider: "wan"
  model?: string | null
  operationName?: string | null
  videoUrl?: string | null
  assetId?: string | null
  error?: string | null
  raw?: Record<string, unknown> | null
}

function apiKey() {
  return process.env.WAN_VIDEO_API_KEY || process.env.DASHSCOPE_API_KEY || null
}

function apiBaseUrl() {
  const explicit = process.env.WAN_VIDEO_API_BASE_URL?.trim().replace(/\/$/, "")
  if (explicit) return explicit

  const region = (process.env.WAN_VIDEO_REGION || "singapore").trim().toLowerCase()
  const workspace = process.env.DASHSCOPE_WORKSPACE_ID || process.env.WAN_VIDEO_WORKSPACE_ID

  if (region === "us" || region === "virginia") {
    return "https://dashscope-us.aliyuncs.com/api/v1"
  }
  if (region === "beijing" || region === "cn") {
    return workspace
      ? `https://${workspace}.cn-beijing.maas.aliyuncs.com/api/v1`
      : "https://dashscope.aliyuncs.com/api/v1"
  }
  if (region === "frankfurt" || region === "eu") {
    return workspace
      ? `https://${workspace}.eu-central-1.maas.aliyuncs.com/api/v1`
      : null
  }

  return workspace
    ? `https://${workspace}.ap-southeast-1.maas.aliyuncs.com/api/v1`
    : "https://dashscope-intl.aliyuncs.com/api/v1"
}

export function isWanVideoConfigured() {
  return Boolean(apiKey() && apiBaseUrl())
}

function textModel() {
  return process.env.WAN_VIDEO_MODEL_TEXT || "wan2.7-t2v-2026-06-12"
}

function imageModel() {
  return process.env.WAN_VIDEO_MODEL_IMAGE || "wan2.7-i2v-2026-04-25"
}

function normalizeDuration(value: number) {
  const rounded = Math.round(Number.isFinite(value) ? value : 5)
  return Math.min(15, Math.max(2, rounded))
}

function normalizeResolution(value: string) {
  return value === "1080p" || value === "4k" ? "1080P" : "720P"
}

function parseOperationName(value: string) {
  return value.startsWith("wan:") ? value.slice(4) : value
}

function promptWithStyle(prompt: string, style?: string | null) {
  return style?.trim() ? `${prompt}. Visual style: ${style.trim()}.` : prompt
}

export async function startWanVideo(input: {
  prompt: string
  style?: string | null
  duration: number
  mode: "text_to_video" | "image_to_video"
  imageUrl?: string | null
  aspectRatio: "16:9" | "9:16"
  resolution: "720p" | "1080p" | "4k"
}): Promise<WanVideoResult> {
  const key = apiKey()
  const baseUrl = apiBaseUrl()
  if (!key || !baseUrl) {
    return {
      ok: false,
      status: "failed",
      provider: "wan",
      error: "WAN no está configurado. Falta DASHSCOPE_API_KEY o un endpoint regional válido de Model Studio.",
      raw: { configured: false },
    }
  }

  if (input.mode === "image_to_video" && !input.imageUrl) {
    return { ok: false, status: "failed", provider: "wan", error: "WAN imagen a video requiere una imagen base." }
  }

  const model = input.mode === "image_to_video" ? imageModel() : textModel()
  const prompt = promptWithStyle(input.prompt, input.style)
  const requestBody = input.mode === "image_to_video"
    ? {
        model,
        input: {
          prompt,
          media: [{ type: "first_frame", url: input.imageUrl }],
        },
        parameters: {
          resolution: normalizeResolution(input.resolution),
          duration: normalizeDuration(input.duration),
          prompt_extend: true,
          watermark: process.env.WAN_VIDEO_WATERMARK !== "false",
        },
      }
    : {
        model,
        input: { prompt },
        parameters: {
          resolution: normalizeResolution(input.resolution),
          ratio: input.aspectRatio,
          duration: normalizeDuration(input.duration),
          prompt_extend: true,
          watermark: process.env.WAN_VIDEO_WATERMARK !== "false",
        },
      }

  try {
    const response = await fetch(`${baseUrl}/services/aigc/video-generation/video-synthesis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(25_000),
    })
    const raw = await response.json().catch(() => null) as any
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "wan",
        model,
        error: raw?.message || raw?.code || `WAN devolvió HTTP ${response.status}`,
        raw: raw && typeof raw === "object" ? raw : { status: response.status },
      }
    }

    const taskId = raw?.output?.task_id
    if (!taskId) {
      return {
        ok: false,
        status: "failed",
        provider: "wan",
        model,
        error: "WAN respondió sin task_id.",
        raw: raw && typeof raw === "object" ? raw : null,
      }
    }

    return {
      ok: true,
      status: "processing",
      provider: "wan",
      model,
      operationName: `wan:${taskId}`,
      raw: {
        ...(raw && typeof raw === "object" ? raw : {}),
        phase: "submitted",
        taskId,
        duration: normalizeDuration(input.duration),
        resolution: normalizeResolution(input.resolution),
      },
    }
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      provider: "wan",
      model,
      error: error instanceof Error ? error.message : "Error inesperado al iniciar WAN.",
      raw: { phase: "submit_exception" },
    }
  }
}

export async function pollWanVideo(input: {
  operationName: string
  userId: string
  prompt: string
  sourceJobId?: string | null
  model?: string | null
}): Promise<WanVideoResult> {
  const key = apiKey()
  const baseUrl = apiBaseUrl()
  const taskId = parseOperationName(input.operationName)
  const model = input.model || textModel()

  if (!key || !baseUrl) {
    return { ok: false, status: "failed", provider: "wan", model, error: "WAN dejó de estar configurado mientras el job estaba en proceso." }
  }

  try {
    const response = await fetch(`${baseUrl}/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    })
    const raw = await response.json().catch(() => null) as any
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "wan",
        model,
        operationName: `wan:${taskId}`,
        error: raw?.message || raw?.code || `WAN polling devolvió HTTP ${response.status}`,
        raw: raw && typeof raw === "object" ? raw : { status: response.status },
      }
    }

    const state = String(raw?.output?.task_status || "UNKNOWN").toUpperCase()
    if (state === "PENDING" || state === "RUNNING") {
      return {
        ok: true,
        status: "processing",
        provider: "wan",
        model,
        operationName: `wan:${taskId}`,
        raw: { ...(raw || {}), phase: "polling", taskId, taskStatus: state },
      }
    }

    if (state !== "SUCCEEDED") {
      return {
        ok: false,
        status: "failed",
        provider: "wan",
        model,
        operationName: `wan:${taskId}`,
        error: raw?.output?.message || raw?.message || `WAN terminó con estado ${state}`,
        raw: { ...(raw || {}), phase: "failed", taskId, taskStatus: state },
      }
    }

    const remoteUrl = raw?.output?.video_url
    if (!remoteUrl) {
      return {
        ok: false,
        status: "failed",
        provider: "wan",
        model,
        operationName: `wan:${taskId}`,
        error: "WAN terminó correctamente pero no entregó video_url.",
        raw: { ...(raw || {}), phase: "completed_without_video", taskId },
      }
    }

    const persisted = await persistRemoteVideo({
      remoteUrl,
      userId: input.userId,
      provider: "wan",
      model,
      prompt: input.prompt,
      sourceJobId: input.sourceJobId,
      metadata: {
        taskId,
        source: "alibaba-model-studio",
        providerUrlExpires: true,
      },
    })

    return {
      ok: true,
      status: "completed",
      provider: "wan",
      model,
      operationName: `wan:${taskId}`,
      videoUrl: persisted.videoUrl,
      assetId: persisted.assetId,
      raw: {
        ...(raw || {}),
        phase: "persisted",
        taskId,
        assetId: persisted.assetId,
        storageBucket: "eduai-assets",
        storagePath: persisted.storagePath,
      },
    }
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      provider: "wan",
      model,
      operationName: `wan:${taskId}`,
      error: error instanceof Error ? error.message : "Error inesperado consultando WAN.",
      raw: { phase: "poll_exception", taskId },
    }
  }
}
