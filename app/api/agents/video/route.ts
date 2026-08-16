import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import { generationFingerprint } from "@/lib/ai/fingerprint"
import { normalizeDuration, normalizeMode, VIDEO_MAX_DURATION } from "@/lib/video-config"

type VideoMode = "text_to_video" | "image_to_video"
type VideoPlan = "free" | "pro" | "pro_max"

type VideoRequestBody = {
  prompt?: string
  style?: string
  duration?: number
  withAudio?: boolean
  mode?: VideoMode
  imageUrl?: string | null
  aspectRatio?: "16:9" | "9:16"
  resolution?: "720p" | "1080p" | "4k"
}

type DailyLimitResult = {
  allowed: boolean
  plan: VideoPlan
  limit: number
  used: number
  remaining: number
}

const DAILY_LIMITS: Record<VideoPlan, number> = { free: 1, pro: 5, pro_max: 15 }

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizePrompt(input: string): string {
  return input.replace(/\s+/g, " ").trim()
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
  const blockedTerms = ["child sexual", "explicit minor", "rape", "bestiality", "sexual violence"]
  const matched = blockedTerms.find((term) => text.includes(term))
  return matched
    ? { blocked: true, reason: `Prompt bloqueado por moderación básica: ${matched}` }
    : { blocked: false, reason: null }
}

async function resolveUserPlan(_userId: string): Promise<VideoPlan> {
  return "free"
}

async function getDailyUsage(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  plan: VideoPlan
}): Promise<DailyLimitResult> {
  const today = getTodayIsoDate()
  const limit = DAILY_LIMITS[params.plan] ?? DAILY_LIMITS.free
  const start = today + "T00:00:00.000Z"
  const { count, error } = await params.supabase
    .from("video_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("status", "completed")
    .gte("completed_at", start)

  if (error) throw new Error(`No se pudo consultar el uso diario: ${error.message}`)
  const used = count ?? 0
  return { allowed: used < limit, plan: params.plan, limit, used, remaining: Math.max(0, limit - used) }
}

// Compatibilidad temporal con el contador histórico. El flujo actual no lo llama:
// el cupo se calcula desde video_jobs completados para que un fallo no consuma uso.
async function incrementDailyUsage(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  plan: VideoPlan
}) {
  const today = getTodayIsoDate()
  const { data: existing, error: fetchError } = await params.supabase
    .from("video_usage_daily")
    .select("id,videos_created")
    .eq("user_id", params.userId)
    .eq("usage_date", today)
    .maybeSingle()

  if (fetchError) throw new Error(`No se pudo leer el contador diario: ${fetchError.message}`)

  if (!existing) {
    const { error } = await params.supabase.from("video_usage_daily").insert({
      user_id: params.userId,
      usage_date: today,
      plan: params.plan,
      videos_created: 1,
    })
    if (error) throw new Error(`No se pudo crear el contador diario: ${error.message}`)
    return
  }

  const { error } = await params.supabase
    .from("video_usage_daily")
    .update({ videos_created: (existing.videos_created ?? 0) + 1, plan: params.plan })
    .eq("id", existing.id)
  if (error) throw new Error(`No se pudo actualizar el contador diario: ${error.message}`)
}

void incrementDailyUsage

function parseSupabaseAssetUrl(value: string | null | undefined) {
  if (!value?.startsWith("supabase://")) return null
  const remainder = value.slice("supabase://".length)
  const slash = remainder.indexOf("/")
  if (slash <= 0) return null
  return { bucket: remainder.slice(0, slash), path: remainder.slice(slash + 1) }
}

async function resolveVideoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stored: string | null | undefined
) {
  if (!stored) return null
  const parsed = parseSupabaseAssetUrl(stored)
  if (!parsed) return stored
  const { data } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 30)
  return data?.signedUrl || null
}

async function findReusableJob(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  fingerprint: string
}) {
  const { data, error } = await params.supabase
    .from("video_jobs")
    .select("id,status,plan,created_at,video_url,thumbnail_url,asset_id,provider,model")
    .eq("user_id", params.userId)
    .eq("fingerprint", params.fingerprint)
    .in("status", ["queued", "processing", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!error) return data ?? null

  // Compatibilidad temporal si todavía no se aplicó la migración que agrega fingerprint.
  if (error.code === "42703" || /fingerprint/i.test(error.message)) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const fallback = await params.supabase
      .from("video_jobs")
      .select("id,status,plan,created_at,video_url,thumbnail_url,provider,model")
      .eq("user_id", params.userId)
      .eq("prompt_hash", params.fingerprint)
      .in("status", ["queued", "processing", "completed"])
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (fallback.error) throw new Error(`No se pudo revisar duplicados: ${fallback.error.message}`)
    return fallback.data ?? null
  }

  throw new Error(`No se pudo revisar reutilización: ${error.message}`)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return Response.json({ ok: false, error: "No autenticado.", code: "UNAUTHORIZED" }, { status: 401 })
    }

    const body = (await req.json()) as VideoRequestBody
    const prompt = normalizePrompt(body.prompt ?? "")
    const style = normalizePrompt(body.style ?? "")
    const mode = normalizeMode(body.mode ?? "text_to_video") as VideoMode
    const duration = normalizeDuration(body.duration ?? 6)
    const withAudio = Boolean(body.withAudio)
    const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null
    const aspectRatio = normalizeAspectRatio(body.aspectRatio)
    const resolution = normalizeResolution(body.resolution)

    if (!prompt || prompt.length < 8) {
      return Response.json({ ok: false, error: "El prompt es demasiado corto.", code: "INVALID_PROMPT" }, { status: 400 })
    }
    if (prompt.length > 2000) {
      return Response.json({ ok: false, error: "El prompt es demasiado largo.", code: "PROMPT_TOO_LONG" }, { status: 400 })
    }
    if (!["text_to_video", "image_to_video"].includes(mode)) {
      return Response.json({ ok: false, error: "Modo de video no válido.", code: "INVALID_MODE" }, { status: 400 })
    }
    if (duration < 2 || duration > VIDEO_MAX_DURATION) {
      return Response.json({ ok: false, error: `La duración debe estar entre 2 y ${VIDEO_MAX_DURATION} segundos.`, code: "INVALID_DURATION" }, { status: 400 })
    }
    if (mode === "image_to_video" && !imageUrl) {
      return Response.json({ ok: false, error: "Para imagen a video debes enviar una imagen base.", code: "IMAGE_REQUIRED" }, { status: 400 })
    }

    const moderation = basicModeration(prompt)
    if (moderation.blocked) {
      return Response.json({ ok: false, error: moderation.reason, code: "PROMPT_BLOCKED" }, { status: 400 })
    }

    try {
      await assertAICapabilityAllowed({ supabase, userId: user.id, capability: "video" })
    } catch (error) {
      const typed = error as Error & { status?: number; code?: string }
      return Response.json({ ok: false, error: typed.message, code: typed.code || "ACCESS_RESTRICTED" }, { status: typed.status || 403 })
    }

    const fingerprint = generationFingerprint({
      capability: "video",
      scopeKey: user.id,
      payload: { prompt, style, mode, duration, withAudio, imageUrl, aspectRatio, resolution },
    })

    const duplicate = await findReusableJob({ supabase, userId: user.id, fingerprint })
    if (duplicate) {
      return Response.json({
        ok: true,
        jobId: duplicate.id,
        status: duplicate.status,
        deduplicated: true,
        reused: duplicate.status === "completed",
        generationAvoided: true,
        plan: duplicate.plan ?? "free",
        videoUrl: await resolveVideoUrl(supabase, duplicate.video_url),
        thumbnailUrl: duplicate.thumbnail_url ?? null,
        assetId: "asset_id" in duplicate ? duplicate.asset_id ?? null : null,
        provider: duplicate.provider ?? null,
        model: duplicate.model ?? null,
      })
    }

    const plan = await resolveUserPlan(user.id)
    const usage = await getDailyUsage({ supabase, userId: user.id, plan })
    if (!usage.allowed) {
      return Response.json({
        ok: false,
        error: "Has alcanzado el límite diario de videos para tu plan.",
        code: "DAILY_LIMIT_REACHED",
        plan,
        limit: usage.limit,
        used: usage.used,
        remaining: usage.remaining,
      }, { status: 429 })
    }

    const requestPayload = {
      prompt,
      style: style || null,
      duration,
      withAudio,
      mode,
      imageUrl,
      aspectRatio,
      resolution,
    }

    const { data: insertedJob, error: insertError } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        status: "queued",
        plan,
        mode,
        prompt,
        prompt_hash: fingerprint,
        fingerprint,
        style: style || null,
        duration_seconds: duration,
        include_audio: withAudio,
        image_url: imageUrl,
        provider: null,
        model: null,
        request_payload: requestPayload,
        moderation_payload: { blocked: false, reason: null, phase: "basic" },
      })
      .select("id,status,plan")
      .single()

    if (insertError || !insertedJob) {
      return Response.json({ ok: false, error: insertError?.message || "No se pudo crear el job de video.", code: "JOB_CREATE_FAILED" }, { status: 500 })
    }

    return Response.json({
      ok: true,
      jobId: insertedJob.id,
      status: insertedJob.status,
      deduplicated: false,
      reused: false,
      plan: insertedJob.plan,
      remainingToday: usage.remaining,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al crear el video."
    return Response.json({ ok: false, error: message, code: "INTERNAL_ERROR" }, { status: 500 })
  }
}
