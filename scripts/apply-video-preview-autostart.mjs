import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const routePath = path.join(root, "app/api/agents/video/status/[jobId]/route.ts")

if (!fs.existsSync(routePath)) {
  console.log("[video-preview-autostart] status route not found; skipped")
  process.exit(0)
}

let source = fs.readFileSync(routePath, "utf8")

if (source.includes("[Video status][autostart]")) {
  console.log("[video-preview-autostart] already applied")
  process.exit(0)
}

const startMarker = "async function maybeAdvanceGoogleJob(job: VideoJobRow): Promise<VideoJobRow> {"
const endMarker = "\nexport async function GET("
const start = source.indexOf(startMarker)
const end = source.indexOf(endMarker, start)

if (start < 0 || end < 0) {
  throw new Error("[video-preview-autostart] function markers not found")
}

const replacement = `async function maybeAdvanceGoogleJob(job: VideoJobRow): Promise<VideoJobRow> {
  const admin = getAdminSupabase()
  if (!admin) return job

  let current = job

  // Preview deployments do not execute Vercel Cron Jobs. When the authenticated
  // owner polls a queued job, claim exactly that job and start it immediately.
  // Production can still use /api/agents/video/process through Vercel Cron.
  if (current.status === "queued") {
    const startedAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await admin
      .from("video_jobs")
      .update({
        status: "processing",
        provider: current.provider || "google",
        error_message: null,
        started_at: current.started_at || startedAt,
      })
      .eq("id", current.id)
      .eq("user_id", current.user_id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle()

    if (claimError) {
      console.warn("[Video status][autostart]", claimError.message)
      return current
    }

    // Another request may have claimed it milliseconds earlier. Reloading is not
    // necessary here; the next UI poll will receive the updated row.
    if (!claimed) return current

    current = {
      ...current,
      status: "processing",
      provider: current.provider || "google",
      started_at: current.started_at || startedAt,
      updated_at: startedAt,
    }

    try {
      const result = await processVideoJob({
        prompt: current.prompt || String(current.request_payload?.prompt || "Video EduAI"),
        style: current.style || String(current.request_payload?.style || ""),
        duration: current.duration_seconds ?? Number(current.request_payload?.duration || 6),
        withAudio: current.include_audio ?? Boolean(current.request_payload?.withAudio),
        mode: current.mode || String(current.request_payload?.mode || "text_to_video"),
        imageUrl: current.image_url || (typeof current.request_payload?.imageUrl === "string" ? current.request_payload.imageUrl : null),
        aspectRatio: typeof current.request_payload?.aspectRatio === "string" ? current.request_payload.aspectRatio : "16:9",
        resolution: typeof current.request_payload?.resolution === "string" ? current.request_payload.resolution : "720p",
        userId: current.user_id,
        sourceJobId: current.id,
      })

      const now = new Date().toISOString()

      if (result.ok && result.status === "processing") {
        const { error } = await admin
          .from("video_jobs")
          .update({
            status: "processing",
            provider: result.provider || current.provider || "google",
            model: result.model || current.model || null,
            operation_name: result.operationName || current.operation_name || null,
            response_payload: result.raw || current.response_payload || null,
            error_message: null,
          })
          .eq("id", current.id)
          .eq("user_id", current.user_id)

        if (error) console.warn("[Video status][autostart]", error.message)

        return {
          ...current,
          status: "processing",
          provider: result.provider || current.provider || "google",
          model: result.model || current.model || null,
          operation_name: result.operationName || current.operation_name || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: null,
          updated_at: now,
        }
      }

      if (result.ok && result.status === "completed" && result.videoUrl) {
        const { error } = await admin
          .from("video_jobs")
          .update({
            status: "completed",
            provider: result.provider || current.provider,
            model: result.model || current.model,
            operation_name: result.operationName || current.operation_name || null,
            asset_id: result.assetId || current.asset_id || null,
            video_url: result.videoUrl,
            thumbnail_url: result.thumbnailUrl || current.thumbnail_url || null,
            response_payload: result.raw || current.response_payload || null,
            error_message: null,
            completed_at: now,
          })
          .eq("id", current.id)
          .eq("user_id", current.user_id)

        if (error) console.warn("[Video status][autostart]", error.message)

        return {
          ...current,
          status: "completed",
          provider: result.provider || current.provider,
          model: result.model || current.model,
          operation_name: result.operationName || current.operation_name || null,
          asset_id: result.assetId || current.asset_id || null,
          video_url: result.videoUrl,
          thumbnail_url: result.thumbnailUrl || current.thumbnail_url || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: null,
          completed_at: now,
          updated_at: now,
        }
      }

      const failedStatus: JobStatus = result.status === "blocked" ? "blocked" : "failed"
      const errorMessage = result.moderationReason || result.error || "No fue posible iniciar el video."
      await admin
        .from("video_jobs")
        .update({
          status: failedStatus,
          provider: result.provider || current.provider || null,
          model: result.model || current.model || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: errorMessage,
          completed_at: now,
          retry_count: Number(current.retry_count || 0) + 1,
        })
        .eq("id", current.id)
        .eq("user_id", current.user_id)

      return {
        ...current,
        status: failedStatus,
        provider: result.provider || current.provider || null,
        model: result.model || current.model || null,
        response_payload: result.raw || current.response_payload || null,
        error_message: errorMessage,
        completed_at: now,
        retry_count: Number(current.retry_count || 0) + 1,
        updated_at: now,
      }
    } catch (error) {
      const now = new Date().toISOString()
      const message = error instanceof Error ? error.message : String(error)
      console.warn("[Video status][autostart]", message)
      await admin
        .from("video_jobs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: now,
          retry_count: Number(current.retry_count || 0) + 1,
        })
        .eq("id", current.id)
        .eq("user_id", current.user_id)

      return {
        ...current,
        status: "failed",
        error_message: message,
        completed_at: now,
        retry_count: Number(current.retry_count || 0) + 1,
        updated_at: now,
      }
    }
  }

  if (current.status !== "processing" || current.provider !== "google" || !current.operation_name) return current

  // Evitar golpear la API de operaciones en cada render/poll ultra rápido.
  const updatedAt = current.updated_at ? new Date(current.updated_at).getTime() : 0
  if (updatedAt && Date.now() - updatedAt < 5_000) return current

  try {
    const result = await processVideoJob({
      prompt: current.prompt || String(current.request_payload?.prompt || "Video EduAI"),
      operationName: current.operation_name,
      userId: current.user_id,
      sourceJobId: current.id,
    })

    if (result.ok && result.status === "completed" && result.videoUrl) {
      const completedAt = new Date().toISOString()
      const { error } = await admin
        .from("video_jobs")
        .update({
          status: "completed",
          provider: result.provider || current.provider,
          model: result.model || current.model,
          asset_id: result.assetId || current.asset_id || null,
          video_url: result.videoUrl,
          thumbnail_url: result.thumbnailUrl || current.thumbnail_url || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: null,
          completed_at: completedAt,
        })
        .eq("id", current.id)
        .eq("user_id", current.user_id)

      if (!error) {
        return {
          ...current,
          status: "completed",
          provider: result.provider || current.provider,
          model: result.model || current.model,
          asset_id: result.assetId || current.asset_id || null,
          video_url: result.videoUrl,
          thumbnail_url: result.thumbnailUrl || current.thumbnail_url || null,
          response_payload: result.raw || current.response_payload || null,
          error_message: null,
          completed_at: completedAt,
          updated_at: completedAt,
        }
      }
    }

    if (!result.ok && result.status === "failed") {
      const completedAt = new Date().toISOString()
      await admin
        .from("video_jobs")
        .update({
          status: "failed",
          error_message: result.error || "La operación de Google falló.",
          response_payload: result.raw || current.response_payload || null,
          completed_at: completedAt,
          retry_count: Number(current.retry_count || 0) + 1,
        })
        .eq("id", current.id)
        .eq("user_id", current.user_id)

      return {
        ...current,
        status: "failed",
        error_message: result.error || "La operación de Google falló.",
        response_payload: result.raw || current.response_payload || null,
        completed_at: completedAt,
        retry_count: Number(current.retry_count || 0) + 1,
        updated_at: completedAt,
      }
    }
  } catch (error) {
    console.warn("[Video status][poll]", error instanceof Error ? error.message : String(error))
  }

  return current
}
`

source = source.slice(0, start) + replacement + source.slice(end)
fs.writeFileSync(routePath, source)
console.log("[video-preview-autostart] authenticated queued jobs can start from status polling")
