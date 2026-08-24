import fs from "node:fs"

const MAX_QUEUED_AGE_MS_MARKER = "VIDEO_QUEUED_MAX_AGE_MS"

function patchProcessRoute() {
  const path = "app/api/agents/video/process/route.ts"
  let source = fs.readFileSync(path, "utf8")

  if (!source.includes(MAX_QUEUED_AGE_MS_MARKER)) {
    source = source.replace(
      "export const maxDuration = 60\n",
      `export const maxDuration = 60\n\nconst VIDEO_QUEUED_MAX_AGE_MS = 24 * 60 * 60 * 1000\n\nfunction queuedCutoffIso() {\n  return new Date(Date.now() - VIDEO_QUEUED_MAX_AGE_MS).toISOString()\n}\n`,
    )
  }

  if (!source.includes('.gte("created_at", queuedCutoffIso())')) {
    source = source.replace(
      `    .eq("status", "queued")\n    .order("created_at", { ascending: false })`,
      `    .eq("status", "queued")\n    .gte("created_at", queuedCutoffIso())\n    .order("created_at", { ascending: false })`,
    )
  }

  fs.writeFileSync(path, source)
}

function patchStatusRoute() {
  const path = "app/api/agents/video/status/[jobId]/route.ts"
  let source = fs.readFileSync(path, "utf8")

  if (!source.includes(MAX_QUEUED_AGE_MS_MARKER)) {
    source = source.replace(
      "export const maxDuration = 60\n",
      `export const maxDuration = 60\n\nconst VIDEO_QUEUED_MAX_AGE_MS = 24 * 60 * 60 * 1000\nconst VIDEO_QUEUE_EXPIRED_MESSAGE = "La solicitud de video expiró antes de iniciar. Vuelve a generar el video para crear una solicitud nueva."\n\nfunction isExpiredQueuedJob(createdAt: string | null | undefined) {\n  if (!createdAt) return false\n  const timestamp = new Date(createdAt).getTime()\n  return Number.isFinite(timestamp) && Date.now() - timestamp > VIDEO_QUEUED_MAX_AGE_MS\n}\n`,
    )
  }

  const marker = "  let current = job\n\n  // Preview deployments do not execute Vercel Cron Jobs."
  if (!source.includes("[Video status][expired-queue]")) {
    if (!source.includes(marker)) {
      throw new Error("[video-stale-queue] marker de status route no encontrado")
    }
    source = source.replace(
      marker,
      `  let current = job\n\n  if (current.status === "queued" && isExpiredQueuedJob(current.created_at)) {\n    const now = new Date().toISOString()\n    const { error } = await admin\n      .from("video_jobs")\n      .update({\n        status: "failed",\n        error_message: VIDEO_QUEUE_EXPIRED_MESSAGE,\n        completed_at: now,\n      })\n      .eq("id", current.id)\n      .eq("user_id", current.user_id)\n      .eq("status", "queued")\n\n    if (error) {\n      console.warn("[Video status][expired-queue]", error.message)\n      return current\n    }\n\n    return {\n      ...current,\n      status: "failed",\n      error_message: VIDEO_QUEUE_EXPIRED_MESSAGE,\n      completed_at: now,\n      updated_at: now,\n    }\n  }\n\n  // Preview deployments do not execute Vercel Cron Jobs.`,
    )
  }

  fs.writeFileSync(path, source)
}

patchProcessRoute()
patchStatusRoute()
console.log("[video-stale-queue] jobs queued >24h quedan fuera del worker y expiran al consultar estado")
