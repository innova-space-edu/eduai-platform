import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPersonalCredentialSecret, type PersonalAIProvider } from "@/lib/ai/personal-credentials"
import { updatePersonalSpend } from "@/lib/ai/personal-spend"
import { parsePersonalVideoOperation, pollPersonalVideo, type PersonalVideoMode } from "@/lib/video/personal-video-router"

export const runtime = "nodejs"
export const maxDuration = 45

function parseSupabaseAssetUrl(value: string | null | undefined) {
  if (!value?.startsWith("supabase://")) return null
  const rest = value.slice("supabase://".length)
  const slash = rest.indexOf("/")
  if (slash <= 0) return null
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
}

async function resolveUrl(supabase: Awaited<ReturnType<typeof createClient>>, value: string | null | undefined) {
  if (!value) return null
  const parsed = parseSupabaseAssetUrl(value)
  if (!parsed) return value
  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 30)
  return error ? null : data?.signedUrl || null
}

function progress(status: string) {
  if (status === "queued") return 10
  if (status === "processing") return 60
  return 100
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 })

  const { jobId } = await context.params
  const { data: loaded, error } = await supabase
    .from("video_jobs")
    .select("id,user_id,status,plan,mode,prompt,style,duration_seconds,include_audio,image_url,provider,model,operation_name,asset_id,video_url,thumbnail_url,error_message,request_payload,response_payload,started_at,completed_at,created_at,updated_at,reuse_count")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!loaded) return NextResponse.json({ ok: false, error: "Job no encontrado" }, { status: 404 })
  if (loaded.plan !== "personal") return NextResponse.json({ ok: false, error: "Este job no pertenece al modo Premium Personal" }, { status: 409 })

  let job: any = loaded

  if (job.status === "processing" && job.operation_name) {
    const operation = parsePersonalVideoOperation(job.operation_name)
    const payload = (job.request_payload || {}) as Record<string, any>
    const provider = (operation?.provider || payload.personalProvider || job.provider) as PersonalAIProvider
    const model = operation?.model || payload.personalModel || job.model

    if (provider && model && (provider === "fal" || provider === "replicate")) {
      const credential = await getPersonalCredentialSecret(user.id, provider).catch(() => null)
      if (!credential) {
        return NextResponse.json({
          ok: true,
          jobId: job.id,
          status: job.status,
          progress: progress(job.status),
          provider,
          model,
          billingMode: "personal",
          errorMessage: "La conexión personal está desactivada o eliminada. Reactívala para continuar consultando este video.",
        })
      }

      const result = await pollPersonalVideo({
        provider,
        model,
        secret: credential.secret,
        prompt: job.prompt || payload.prompt || "Video EduAI",
        style: job.style || payload.style || "",
        duration: job.duration_seconds || payload.duration || 5,
        mode: (job.mode === "image_to_video" ? "image_to_video" : "text_to_video") as PersonalVideoMode,
        imageUrl: job.image_url || payload.imageUrl || null,
        aspectRatio: payload.aspectRatio || "16:9",
        resolution: payload.resolution || "720p",
        withAudio: Boolean(job.include_audio),
        userId: user.id,
        sourceJobId: job.id,
        operationName: job.operation_name,
      })

      if (result.ok && result.status === "completed" && result.videoUrl) {
        const now = new Date().toISOString()
        const { error: updateError } = await supabase.from("video_jobs").update({
          status: "completed",
          provider: result.provider,
          model: result.model,
          asset_id: result.assetId || job.asset_id || null,
          video_url: result.videoUrl,
          response_payload: result.raw || job.response_payload || null,
          error_message: null,
          completed_at: now,
        }).eq("id", job.id).eq("user_id", user.id)
        if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })

        await updatePersonalSpend({
          userId: user.id,
          provider,
          spendEventId: payload.spendEventId || null,
          externalRequestId: result.externalRequestId || payload.externalRequestId || null,
          status: "completed",
          metadata: { ...(payload.pricing ? { pricing: payload.pricing } : {}), jobId: job.id, assetId: result.assetId || null },
        }).catch(() => null)

        job = { ...job, status: "completed", provider: result.provider, model: result.model, asset_id: result.assetId || job.asset_id, video_url: result.videoUrl, response_payload: result.raw || job.response_payload, error_message: null, completed_at: now, updated_at: now }
      } else if (!result.ok) {
        const now = new Date().toISOString()
        const message = result.error || "El proveedor personal no pudo completar el video"
        await supabase.from("video_jobs").update({
          status: "failed",
          error_message: message,
          response_payload: result.raw || job.response_payload || null,
          completed_at: now,
        }).eq("id", job.id).eq("user_id", user.id)

        await updatePersonalSpend({
          userId: user.id,
          provider,
          spendEventId: payload.spendEventId || null,
          externalRequestId: result.externalRequestId || payload.externalRequestId || null,
          status: "failed",
          metadata: { ...(payload.pricing ? { pricing: payload.pricing } : {}), jobId: job.id, error: message.slice(0, 300) },
        }).catch(() => null)

        job = { ...job, status: "failed", error_message: message, response_payload: result.raw || job.response_payload, completed_at: now, updated_at: now }
      }
    }
  }

  const requestPayload = (job.request_payload || {}) as Record<string, any>
  return NextResponse.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    progress: progress(job.status),
    provider: job.provider || requestPayload.personalProvider || null,
    model: job.model || requestPayload.personalModel || null,
    billingMode: "personal",
    estimatedCostUsd: typeof requestPayload.estimatedCostUsd === "number" ? requestPayload.estimatedCostUsd : null,
    priceIsEstimate: true,
    assetId: job.asset_id || null,
    videoUrl: await resolveUrl(supabase, job.video_url),
    thumbnailUrl: await resolveUrl(supabase, job.thumbnail_url),
    reusable: Boolean(job.asset_id || job.video_url),
    reuseCount: job.reuse_count || 0,
    errorMessage: job.error_message || null,
    startedAt: job.started_at || null,
    completedAt: job.completed_at || null,
    createdAt: job.created_at || null,
    updatedAt: job.updated_at || null,
  })
}
