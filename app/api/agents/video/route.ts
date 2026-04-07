import crypto from "crypto"
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  normalizeDuration,
  normalizeMode,
  VIDEO_MAX_DURATION,
} from "@/lib/video-config"

type VideoMode = "text_to_video" | "image_to_video"
type VideoPlan = "free" | "pro" | "pro_max"

type VideoRequestBody = {
  prompt?: string
  style?: string
  duration?: number
  withAudio?: boolean
  mode?: VideoMode
  imageUrl?: string | null
}

type DailyLimitResult = {
  allowed: boolean
  plan: VideoPlan
  limit: number
  used: number
  remaining: number
}

const DAILY_LIMITS: Record<VideoPlan, number> = {
  free: 1,
  pro: 5,
  pro_max: 15,
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizePrompt(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

function buildPromptHash(params: {
  userId: string
  prompt: string
  mode: VideoMode
  duration: number
  imageUrl: string | null
}) {
  const raw = [
    params.userId,
    normalizePrompt(params.prompt).toLowerCase(),
    params.mode,
    String(params.duration),
    params.imageUrl || "",
  ].join("|")
  return crypto.createHash("sha256").update(raw).digest("hex")
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

async function resolveUserPlan(_userId: string): Promise<VideoPlan> {
  // Fase 1: todos parten como free.
  // Más adelante lo conectamos con suscripciones reales.
  return "free"
}

async function getDailyUsage(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  plan: VideoPlan
}): Promise<DailyLimitResult> {
  const today = getTodayIsoDate()
  const limit = DAILY_LIMITS[params.plan] ?? DAILY_LIMITS.free

  const { data, error } = await params.supabase
    .from("video_usage_daily")
    .select("videos_created")
    .eq("user_id", params.userId)
    .eq("usage_date", today)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo consultar el uso diario: ${error.message}`)
  }

  const used = data?.videos_created ?? 0
  const remaining = Math.max(0, limit - used)

  return {
    allowed: used < limit,
    plan: params.plan,
    limit,
    used,
    remaining,
  }
}

async function incrementDailyUsage(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  plan: VideoPlan
}) {
  const today = getTodayIsoDate()

  const { data: existing, error: fetchError } = await params.supabase
    .from("video_usage_daily")
    .select("id, videos_created")
    .eq("user_id", params.userId)
    .eq("usage_date", today)
    .maybeSingle()

  if (fetchError) {
    throw new Error(`No se pudo leer el contador diario: ${fetchError.message}`)
  }

  if (!existing) {
    const { error: insertError } = await params.supabase
      .from("video_usage_daily")
      .insert({
        user_id: params.userId,
        usage_date: today,
        plan: params.plan,
        videos_created: 1,
      })

    if (insertError) {
      throw new Error(`No se pudo crear el contador diario: ${insertError.message}`)
    }
    return
  }

  const { error: updateError } = await params.supabase
    .from("video_usage_daily")
    .update({
      videos_created: (existing.videos_created ?? 0) + 1,
      plan: params.plan,
    })
    .eq("id", existing.id)

  if (updateError) {
    throw new Error(`No se pudo actualizar el contador diario: ${updateError.message}`)
  }
}

async function findRecentDuplicateJob(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  promptHash: string
}) {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { data, error } = await params.supabase
    .from("video_jobs")
    .select("id, status, plan, created_at, video_url, thumbnail_url")
    .eq("user_id", params.userId)
    .eq("prompt_hash", params.promptHash)
    .in("status", ["queued", "processing", "completed"])
    .gte("created_at", tenMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo revisar duplicados: ${error.message}`)
  }

  return data ?? null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return Response.json(
        {
          ok: false,
          error: "No autenticado.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      )
    }

    const body = (await req.json()) as VideoRequestBody

    const rawPrompt = body.prompt ?? ""
    const prompt = normalizePrompt(rawPrompt)
    const style = normalizePrompt(body.style ?? "")
    const mode = normalizeMode(body.mode ?? "text_to_video") as VideoMode
    const duration = normalizeDuration(body.duration ?? 6)
    const withAudio = Boolean(body.withAudio)
    const imageUrl =
      typeof body.imageUrl === "string" && body.imageUrl.trim().length > 0
        ? body.imageUrl.trim()
        : null

    if (!prompt || prompt.length < 8) {
      return Response.json(
        {
          ok: false,
          error: "El prompt es demasiado corto.",
          code: "INVALID_PROMPT",
        },
        { status: 400 }
      )
    }

    if (prompt.length > 2000) {
      return Response.json(
        {
          ok: false,
          error: "El prompt es demasiado largo.",
          code: "PROMPT_TOO_LONG",
        },
        { status: 400 }
      )
    }

    if (!["text_to_video", "image_to_video"].includes(mode)) {
      return Response.json(
        {
          ok: false,
          error: "Modo de video no válido.",
          code: "INVALID_MODE",
        },
        { status: 400 }
      )
    }

    if (duration < 2 || duration > VIDEO_MAX_DURATION) {
      return Response.json(
        {
          ok: false,
          error: `La duración debe estar entre 2 y ${VIDEO_MAX_DURATION} segundos.`,
          code: "INVALID_DURATION",
        },
        { status: 400 }
      )
    }

    if (mode === "image_to_video" && !imageUrl) {
      return Response.json(
        {
          ok: false,
          error: "Para imagen a video debes enviar una imagen base.",
          code: "IMAGE_REQUIRED",
        },
        { status: 400 }
      )
    }

    const moderation = basicModeration(prompt)

    if (moderation.blocked) {
      return Response.json(
        {
          ok: false,
          error: moderation.reason,
          code: "PROMPT_BLOCKED",
        },
        { status: 400 }
      )
    }

    const plan = await resolveUserPlan(user.id)

    const usage = await getDailyUsage({
      supabase,
      userId: user.id,
      plan,
    })

    if (!usage.allowed) {
      return Response.json(
        {
          ok: false,
          error: "Has alcanzado el límite diario de videos para tu plan.",
          code: "DAILY_LIMIT_REACHED",
          plan,
          limit: usage.limit,
          used: usage.used,
          remaining: usage.remaining,
        },
        { status: 429 }
      )
    }

    const promptHash = buildPromptHash({
      userId: user.id,
      prompt,
      mode,
      duration,
      imageUrl,
    })

    const duplicate = await findRecentDuplicateJob({
      supabase,
      userId: user.id,
      promptHash,
    })

    if (duplicate) {
      return Response.json({
        ok: true,
        jobId: duplicate.id,
        status: duplicate.status,
        deduplicated: true,
        plan: duplicate.plan ?? plan,
        remainingToday: usage.remaining,
        videoUrl: duplicate.video_url ?? null,
        thumbnailUrl: duplicate.thumbnail_url ?? null,
      })
    }

    const requestPayload = {
      prompt,
      style: style || null,
      duration,
      withAudio,
      mode,
      imageUrl,
    }

    const { data: insertedJob, error: insertError } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        status: "queued",
        plan,
        mode,
        prompt,
        prompt_hash: promptHash,
        style: style || null,
        duration_seconds: duration,
        include_audio: withAudio,
        image_url: imageUrl,
        provider: "wan-worker",
        model: null,
        request_payload: requestPayload,
        moderation_payload: {
          blocked: false,
          reason: null,
          phase: "basic",
        },
      })
      .select("id, status, plan")
      .single()

    if (insertError || !insertedJob) {
      return Response.json(
        {
          ok: false,
          error: insertError?.message || "No se pudo crear el job de video.",
          code: "JOB_CREATE_FAILED",
        },
        { status: 500 }
      )
    }

    await incrementDailyUsage({
      supabase,
      userId: user.id,
      plan,
    })

    return Response.json({
      ok: true,
      jobId: insertedJob.id,
      status: insertedJob.status,
      deduplicated: false,
      plan: insertedJob.plan,
      remainingToday: Math.max(0, usage.remaining - 1),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado al crear el video."

    return Response.json(
      {
        ok: false,
        error: message,
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    )
  }
}
