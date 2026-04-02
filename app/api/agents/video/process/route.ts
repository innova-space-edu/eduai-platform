import { createClient as createAdminClient } from "@supabase/supabase-js"
import { executeVideoJob, setCachedCompletedVideo, type VideoJobRecord } from "@/lib/video-agent"
import type { NormalizedVideoRequest } from "@/lib/video-config"

function isAuthorized(req: Request) {
  const cronSecret = process.env.VIDEO_CRON_SECRET?.trim()
  if (!cronSecret) return true
  return req.headers.get("x-video-cron-secret") === cronSecret
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getAdmin()
    const limit = Math.max(1, Math.min(3, Number(new URL(req.url).searchParams.get("limit") || 1)))

    const { data: jobs, error } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (!jobs?.length) {
      return Response.json({ processed: 0, message: "No hay jobs pendientes." })
    }

    const results: Array<Record<string, unknown>> = []

    for (const job of jobs as VideoJobRecord[]) {
      await supabase
        .from("video_jobs")
        .update({
          status: "processing",
          attempts: (job.attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)

      const request = job.request_payload as NormalizedVideoRequest
      const providerResult = await executeVideoJob(request, job.id)

      if (providerResult.ok && providerResult.videoUrl) {
        const update = {
          status: "completed",
          provider: providerResult.provider,
          provider_model: providerResult.model,
          video_url: providerResult.videoUrl,
          audio_url: providerResult.audioUrl || null,
          preview_image_url: providerResult.previewImageUrl || null,
          error_message: null,
          updated_at: new Date().toISOString(),
        }

        const { data: updated } = await supabase
          .from("video_jobs")
          .update(update)
          .eq("id", job.id)
          .select("*")
          .single()

        if (updated) {
          await setCachedCompletedVideo(job.user_id, request, updated as VideoJobRecord)
        }

        results.push({ id: job.id, status: "completed", provider: providerResult.provider })
        continue
      }

      await supabase
        .from("video_jobs")
        .update({
          status: "failed",
          provider: providerResult.provider,
          provider_model: providerResult.model,
          error_message: providerResult.error || "Provider failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)

      results.push({ id: job.id, status: "failed", provider: providerResult.provider, error: providerResult.error })
    }

    return Response.json({ processed: results.length, results })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Unexpected error" }, { status: 500 })
  }
}
