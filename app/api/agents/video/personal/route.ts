import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import { generationFingerprint } from "@/lib/ai/fingerprint"
import {
  assertPersonalBudget,
  getPersonalCredentialSecret,
  markCredentialUsed,
  recordPersonalSpend,
  type PersonalAIProvider,
} from "@/lib/ai/personal-credentials"
import { estimateFalVideoCost } from "@/lib/ai/personal-provider-marketplace"
import { startPersonalVideo, type PersonalVideoMode } from "@/lib/video/personal-video-router"

export const runtime = "nodejs"
export const maxDuration = 45

type Body = {
  provider?: PersonalAIProvider
  model?: string
  prompt?: string
  style?: string
  duration?: number
  withAudio?: boolean
  mode?: PersonalVideoMode
  imageUrl?: string | null
  aspectRatio?: "16:9" | "9:16"
  resolution?: "720p" | "1080p" | "4k"
  expectedCostUsd?: number | null
}

const PROVIDERS = new Set<PersonalAIProvider>(["fal", "huggingface", "replicate"])

function prompt(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function duration(value: unknown) {
  const number = Math.round(Number(value || 5))
  return Math.max(2, Math.min(20, Number.isFinite(number) ? number : 5))
}

function parseSupabaseAssetUrl(value: string | null | undefined) {
  if (!value?.startsWith("supabase://")) return null
  const rest = value.slice("supabase://".length)
  const slash = rest.indexOf("/")
  if (slash <= 0) return null
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
}

async function signedVideoUrl(supabase: Awaited<ReturnType<typeof createClient>>, value: string | null | undefined) {
  if (!value) return null
  const parsed = parseSupabaseAssetUrl(value)
  if (!parsed) return value
  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 30)
  return error ? null : data?.signedUrl || null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida" }, { status: 400 })
  }

  const provider = String(body.provider || "").toLowerCase() as PersonalAIProvider
  const model = String(body.model || "").trim()
  const cleanPrompt = prompt(body.prompt)
  const cleanStyle = prompt(body.style)
  const seconds = duration(body.duration)
  const mode: PersonalVideoMode = body.mode === "image_to_video" ? "image_to_video" : "text_to_video"
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null
  const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9"
  const resolution = body.resolution === "1080p" || body.resolution === "4k" ? body.resolution : "720p"

  if (!PROVIDERS.has(provider)) return NextResponse.json({ ok: false, error: "Proveedor personal no compatible" }, { status: 400 })
  if (!model || model.length > 220) return NextResponse.json({ ok: false, error: "Selecciona un modelo válido" }, { status: 400 })
  if (cleanPrompt.length < 8 || cleanPrompt.length > 2000) return NextResponse.json({ ok: false, error: "El prompt debe tener entre 8 y 2000 caracteres" }, { status: 400 })
  if (mode === "image_to_video" && !imageUrl) return NextResponse.json({ ok: false, error: "Imagen a video requiere una imagen base" }, { status: 400 })
  if (provider === "huggingface") {
    return NextResponse.json({ ok: false, error: "Hugging Face Personal está disponible como catálogo/conexión beta. Para generar video ahora usa fal.ai o Replicate." }, { status: 409 })
  }

  try {
    await assertAICapabilityAllowed({ supabase, userId: user.id, capability: "video" })
  } catch (error) {
    const typed = error as Error & { status?: number; code?: string }
    return NextResponse.json({ ok: false, error: typed.message, code: typed.code || "ACCESS_RESTRICTED" }, { status: typed.status || 403 })
  }

  try {
    const credential = await getPersonalCredentialSecret(user.id, provider)
    if (!credential) return NextResponse.json({ ok: false, error: "Conecta y habilita tu API key antes de generar" }, { status: 403 })

    let estimatedCostUsd: number | null = null
    let pricing: Record<string, unknown> | null = null
    if (provider === "fal") {
      const estimate = await estimateFalVideoCost(credential.secret, model, seconds).catch(() => null)
      if (estimate) {
        estimatedCostUsd = estimate.estimatedCostUsd ?? null
        pricing = estimate
      }
    } else if (typeof body.expectedCostUsd === "number" && Number.isFinite(body.expectedCostUsd) && body.expectedCostUsd >= 0) {
      // Replicate's final charge remains controlled by the user's Replicate account.
      // A UI estimate can be carried for budgeting, but EduAI never treats it as an invoice.
      estimatedCostUsd = Math.round(body.expectedCostUsd * 1_000_000) / 1_000_000
    }

    await assertPersonalBudget({
      userId: user.id,
      provider,
      estimatedCostUsd,
      maxRequestUsd: credential.maxRequestUsd,
      dailyBudgetUsd: credential.dailyBudgetUsd,
    })

    const fingerprint = generationFingerprint({
      capability: "video",
      scopeKey: user.id,
      payload: {
        billingMode: "personal",
        provider,
        model,
        prompt: cleanPrompt,
        style: cleanStyle,
        duration: seconds,
        withAudio: Boolean(body.withAudio),
        mode,
        imageUrl,
        aspectRatio,
        resolution,
      },
    })

    const { data: duplicate, error: duplicateError } = await supabase
      .from("video_jobs")
      .select("id,status,video_url,thumbnail_url,asset_id,provider,model,operation_name,created_at")
      .eq("user_id", user.id)
      .eq("fingerprint", fingerprint)
      .in("status", ["queued", "processing", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (duplicateError) throw new Error(duplicateError.message)

    if (duplicate) {
      return NextResponse.json({
        ok: true,
        jobId: duplicate.id,
        status: duplicate.status,
        provider: duplicate.provider,
        model: duplicate.model,
        deduplicated: true,
        reused: duplicate.status === "completed",
        generationAvoided: true,
        assetId: duplicate.asset_id || null,
        videoUrl: await signedVideoUrl(supabase, duplicate.video_url),
        thumbnailUrl: duplicate.thumbnail_url || null,
        estimatedCostUsd: 0,
        billingMode: "personal",
      })
    }

    const requestPayload: Record<string, unknown> = {
      billingMode: "personal",
      personalProvider: provider,
      personalModel: model,
      prompt: cleanPrompt,
      style: cleanStyle || null,
      duration: seconds,
      withAudio: Boolean(body.withAudio),
      mode,
      imageUrl,
      aspectRatio,
      resolution,
      estimatedCostUsd,
      pricing,
    }

    const { data: job, error: insertError } = await supabase
      .from("video_jobs")
      .insert({
        user_id: user.id,
        status: "queued",
        plan: "personal",
        mode,
        prompt: cleanPrompt,
        prompt_hash: fingerprint,
        fingerprint,
        style: cleanStyle || null,
        duration_seconds: seconds,
        include_audio: Boolean(body.withAudio),
        image_url: imageUrl,
        provider,
        model,
        request_payload: requestPayload,
        moderation_payload: { blocked: false, phase: "personal-provider" },
      })
      .select("id")
      .single()
    if (insertError || !job) throw new Error(insertError?.message || "No fue posible crear el job personal")

    const result = await startPersonalVideo({
      provider,
      model,
      secret: credential.secret,
      prompt: cleanPrompt,
      style: cleanStyle,
      duration: seconds,
      mode,
      imageUrl,
      aspectRatio,
      resolution,
      withAudio: Boolean(body.withAudio),
      userId: user.id,
      sourceJobId: job.id,
    })

    if (!result.ok) {
      await supabase.from("video_jobs").update({
        status: "failed",
        error_message: result.error || "El proveedor personal rechazó la solicitud",
        response_payload: result.raw || null,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id).eq("user_id", user.id)
      return NextResponse.json({ ok: false, jobId: job.id, status: "failed", provider, model, error: result.error || "No se pudo iniciar la generación" }, { status: 502 })
    }

    let spendEventId: string | null = null
    if (result.externalRequestId) {
      spendEventId = await recordPersonalSpend({
        userId: user.id,
        credentialId: credential.id,
        provider,
        capability: "video",
        model,
        externalRequestId: result.externalRequestId,
        status: result.status === "completed" ? "completed" : "submitted",
        estimatedCostUsd,
        metadata: { jobId: job.id, billingMode: "personal", pricing },
      })
    }
    await markCredentialUsed(user.id, provider)

    const updatedPayload = { ...requestPayload, spendEventId, externalRequestId: result.externalRequestId || null }
    const completedAt = result.status === "completed" ? new Date().toISOString() : null
    const { error: updateError } = await supabase.from("video_jobs").update({
      status: result.status,
      operation_name: result.operationName || null,
      provider,
      model,
      asset_id: result.assetId || null,
      video_url: result.videoUrl || null,
      request_payload: updatedPayload,
      response_payload: result.raw || null,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: completedAt,
    }).eq("id", job.id).eq("user_id", user.id)
    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: result.status,
      provider,
      model,
      billingMode: "personal",
      estimatedCostUsd,
      spendEventId,
      deduplicated: false,
      reused: false,
      videoUrl: result.videoUrl ? await signedVideoUrl(supabase, result.videoUrl) : null,
      assetId: result.assetId || null,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No fue posible crear el video personal" }, { status: 500 })
  }
}
