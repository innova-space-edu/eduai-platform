import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import { generationFingerprint } from "@/lib/ai/fingerprint"
import { ensureWallet, getAdminSupabase, getBillingSettings } from "@/lib/credits/server"
import { normalizeDuration, normalizeMode, VIDEO_MAX_DURATION } from "@/lib/video-config"
import {
  endpointForMode,
  estimateProviderUsd,
  getVideoStudioModel,
  validateVideoModelSelection,
  type StudioResolution,
} from "@/lib/video/premium-models"

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
  resolution?: StudioResolution
  modelKey?: string
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

function normalizeResolution(value: string | null | undefined): StudioResolution {
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
    .eq("plan", params.plan)
    .gte("completed_at", start)

  if (error) throw new Error(`No se pudo consultar el uso diario: ${error.message}`)
  const used = count ?? 0
  return { allowed: used < limit, plan: params.plan, limit, used, remaining: Math.max(0, limit - used) }
}

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
    const selectedModel = getVideoStudioModel(body.modelKey)
    const prompt = normalizePrompt(body.prompt ?? "")
    const style = normalizePrompt(body.style ?? "")
    const mode = normalizeMode(body.mode ?? "text_to_video") as VideoMode
    const requestedDuration = Number.isFinite(Number(body.duration)) ? Math.round(Number(body.duration)) : 6
    const duration = selectedModel.provider === "auto" ? normalizeDuration(requestedDuration) : requestedDuration
    const withAudio = Boolean(body.withAudio)
    const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null
    const aspectRatio = normalizeAspectRatio(body.aspectRatio)
    const resolution = normalizeResolution(body.resolution || selectedModel.resolutions[0])

    if (!prompt || prompt.length < 8) return Response.json({ ok: false, error: "El prompt es demasiado corto.", code: "INVALID_PROMPT" }, { status: 400 })
    if (prompt.length > 2000) return Response.json({ ok: false, error: "El prompt es demasiado largo.", code: "PROMPT_TOO_LONG" }, { status: 400 })
    if (mode === "image_to_video" && !imageUrl) return Response.json({ ok: false, error: "Para imagen a video debes enviar una imagen base.", code: "IMAGE_REQUIRED" }, { status: 400 })

    if (selectedModel.provider === "auto") {
      if (duration < 2 || duration > VIDEO_MAX_DURATION) {
        return Response.json({ ok: false, error: `La duración debe estar entre 2 y ${VIDEO_MAX_DURATION} segundos.`, code: "INVALID_DURATION" }, { status: 400 })
      }
    } else {
      const modelValidation = validateVideoModelSelection({ model: selectedModel, mode, duration, resolution })
      if (modelValidation) return Response.json({ ok: false, error: modelValidation, code: "INVALID_MODEL_CONFIGURATION" }, { status: 400 })
    }

    const moderation = basicModeration(prompt)
    if (moderation.blocked) return Response.json({ ok: false, error: moderation.reason, code: "PROMPT_BLOCKED" }, { status: 400 })

    try {
      await assertAICapabilityAllowed({ supabase, userId: user.id, capability: "video" })
    } catch (error) {
      const typed = error as Error & { status?: number; code?: string }
      return Response.json({ ok: false, error: typed.message, code: typed.code || "ACCESS_RESTRICTED" }, { status: typed.status || 403 })
    }

    const fingerprint = generationFingerprint({
      capability: "video",
      scopeKey: user.id,
      payload: { modelKey: selectedModel.key, prompt, style, mode, duration, withAudio, imageUrl, aspectRatio, resolution },
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
        estimatedCredits: 0,
      })
    }

    let plan: VideoPlan | "credits" = "free"
    let remainingToday: number | null = null
    let estimatedCredits = 0
    let estimatedUsd = 0
    let provider: string | null = null
    let providerModel: string | null = null

    if (selectedModel.provider === "auto") {
      plan = await resolveUserPlan(user.id)
      const usage = await getDailyUsage({ supabase, userId: user.id, plan })
      if (!usage.allowed) {
        return Response.json({ ok: false, error: "Has alcanzado el límite diario de videos para tu plan.", code: "DAILY_LIMIT_REACHED", plan, limit: usage.limit, used: usage.used, remaining: usage.remaining }, { status: 429 })
      }
      remainingToday = usage.remaining
    } else {
      const settings = await getBillingSettings()
      if (!settings.premiumVideoEnabled || !process.env.FAL_KEY?.trim()) {
        return Response.json({ ok: false, error: "El proveedor premium no está configurado en el servidor.", code: "PREMIUM_PROVIDER_UNAVAILABLE" }, { status: 503 })
      }
      estimatedUsd = estimateProviderUsd({ modelKey: selectedModel.key, duration, resolution, withAudio })
      estimatedCredits = Math.max(settings.minGenerationCredits, Math.ceil(estimatedUsd * settings.usdToClp * settings.markupMultiplier * settings.creditsPerClp))
      plan = "credits"
      provider = "fal"
      providerModel = endpointForMode(selectedModel, mode) || null
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
      modelKey: selectedModel.key,
      billingMode: selectedModel.provider === "auto" ? "free" : "credits",
      estimatedCredits,
      estimatedUsd,
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
        provider,
        model: providerModel,
        provider_model: providerModel,
        request_payload: requestPayload,
        moderation_payload: { blocked: false, reason: null, phase: "basic" },
      })
      .select("id,status,plan")
      .single()

    if (insertError || !insertedJob) {
      return Response.json({ ok: false, error: insertError?.message || "No se pudo crear el job de video.", code: "JOB_CREATE_FAILED" }, { status: 500 })
    }

    let availableCredits: number | null = null
    if (plan === "credits") {
      const { data: reservation, error: reserveError } = await supabase.rpc("eduai_reserve_generation_credits", {
        p_job_id: insertedJob.id,
        p_credits: estimatedCredits,
        p_model_key: selectedModel.key,
        p_provider: "fal",
        p_estimate_usd: estimatedUsd,
      })

      if (reserveError) {
        const admin = getAdminSupabase()
        await admin.from("video_jobs").update({ status: "canceled", error_message: reserveError.message, completed_at: new Date().toISOString() }).eq("id", insertedJob.id)
        const wallet = await ensureWallet(user.id)
        const insufficient = /insufficient_credits/i.test(reserveError.message)
        return Response.json({
          ok: false,
          error: insufficient ? "No tienes créditos suficientes para esta generación." : reserveError.message,
          code: insufficient ? "INSUFFICIENT_CREDITS" : "CREDIT_RESERVATION_FAILED",
          requiredCredits: estimatedCredits,
          availableCredits: wallet.availableCredits,
        }, { status: insufficient ? 402 : 500 })
      }
      const row = Array.isArray(reservation) ? reservation[0] : reservation
      availableCredits = Number(row?.available_after ?? (await ensureWallet(user.id)).availableCredits)
    }

    return Response.json({
      ok: true,
      jobId: insertedJob.id,
      status: insertedJob.status,
      deduplicated: false,
      reused: false,
      plan: insertedJob.plan,
      remainingToday,
      estimatedCredits,
      estimatedUsd,
      availableCredits,
      modelKey: selectedModel.key,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al crear el video."
    return Response.json({ ok: false, error: message, code: "INTERNAL_ERROR" }, { status: 500 })
  }
}
