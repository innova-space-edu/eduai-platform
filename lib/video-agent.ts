export type VideoMode = "text_to_video" | "image_to_video"

export type ProcessVideoJobInput = {
  prompt: string
  style?: string | null
  duration?: number | null
  withAudio?: boolean | null
  mode?: VideoMode | string | null
  imageUrl?: string | null
}

export type ProcessVideoJobResult = {
  ok: boolean
  status?: "completed" | "failed" | "blocked"
  provider?: string | null
  model?: string | null
  videoUrl?: string | null
  thumbnailUrl?: string | null
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
  if (safe < 2) return 2
  if (safe > 10) return 10
  return safe
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
    return {
      blocked: true,
      reason: `Prompt bloqueado por moderación básica: ${matched}`,
    }
  }

  return {
    blocked: false,
    reason: null,
  }
}

/**
 * Provider temporal.
 * En esta fase dejamos una estructura limpia para luego reemplazarla
 * por Wan worker / ComfyUI sin romper process/route.ts.
 */
async function runTemporaryProvider(input: {
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
      provider: "wan-worker",
      model: null,
      error:
        "Aún no hay un provider de video configurado. Falta conectar el worker externo o HF_SPACE_VIDEO_API_URL.",
      raw: {
        phase: "temporary-provider",
        configured: false,
      },
    }
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
        style: input.style || null,
        duration: input.duration,
        withAudio: input.withAudio,
        mode: input.mode,
        imageUrl: input.imageUrl,
      }),
    })

    const raw = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "hf-space",
        model: (raw && raw.model) || null,
        error:
          (raw && (raw.error || raw.message)) ||
          `El provider devolvió HTTP ${response.status}.`,
        raw: raw && typeof raw === "object" ? raw : { status: response.status },
      }
    }

    const videoUrl =
      raw?.videoUrl ||
      raw?.video_url ||
      raw?.output_url ||
      raw?.url ||
      null

    const thumbnailUrl =
      raw?.thumbnailUrl ||
      raw?.thumbnail_url ||
      raw?.poster_url ||
      null

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
      thumbnailUrl,
      raw: raw && typeof raw === "object" ? raw : null,
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error inesperado en el provider temporal."

    return {
      ok: false,
      status: "failed",
      provider: "hf-space",
      model: null,
      error: message,
      raw: {
        phase: "temporary-provider",
        exception: true,
      },
    }
  }
}

export async function processVideoJob(
  input: ProcessVideoJobInput
): Promise<ProcessVideoJobResult> {
  const prompt = normalizePrompt(input.prompt)
  const style = normalizePrompt(input.style ?? "")
  const duration = normalizeDuration(input.duration ?? 6)
  const withAudio = Boolean(input.withAudio)
  const mode = normalizeMode(input.mode)
  const imageUrl =
    typeof input.imageUrl === "string" && input.imageUrl.trim().length > 0
      ? input.imageUrl.trim()
      : null

  if (!prompt || prompt.length < 8) {
    return {
      ok: false,
      status: "failed",
      provider: null,
      model: null,
      error: "El prompt es demasiado corto para generar el video.",
      raw: {
        validation: "prompt_too_short",
      },
    }
  }

  if (prompt.length > 2000) {
    return {
      ok: false,
      status: "failed",
      provider: null,
      model: null,
      error: "El prompt es demasiado largo.",
      raw: {
        validation: "prompt_too_long",
      },
    }
  }

  if (mode === "image_to_video" && !imageUrl) {
    return {
      ok: false,
      status: "failed",
      provider: null,
      model: null,
      error: "El modo imagen a video requiere una imagen base.",
      raw: {
        validation: "image_required",
      },
    }
  }

  const moderation = basicModeration(prompt)

  if (moderation.blocked) {
    return {
      ok: false,
      status: "blocked",
      provider: null,
      model: null,
      moderationReason: moderation.reason,
      error: moderation.reason,
      raw: {
        moderation: "blocked",
        reason: moderation.reason,
      },
    }
  }

  return await runTemporaryProvider({
    prompt,
    style,
    duration,
    withAudio,
    mode,
    imageUrl,
  })
}
