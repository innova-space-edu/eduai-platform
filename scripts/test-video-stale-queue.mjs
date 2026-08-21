import fs from "node:fs"

const processRoute = fs.readFileSync("app/api/agents/video/process/route.ts", "utf8")
const statusRoute = fs.readFileSync("app/api/agents/video/status/[jobId]/route.ts", "utf8")
const migration = fs.readFileSync("supabase/migrations/20260818125831_expire_abandoned_video_jobs.sql", "utf8")

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`[test-video-stale-queue] Falta ${label}: ${value}`)
}

requireText(processRoute, "VIDEO_QUEUED_MAX_AGE_MS = 24 * 60 * 60 * 1000", "ventana máxima de cola")
requireText(processRoute, '.gte("created_at", queuedCutoffIso())', "cron ignora jobs antiguos")
requireText(statusRoute, "isExpiredQueuedJob(current.created_at)", "poll detecta cola expirada")
requireText(statusRoute, "[Video status][expired-queue]", "traza de expiración")
requireText(statusRoute, "VIDEO_QUEUE_EXPIRED_MESSAGE", "mensaje de reintento")
requireText(migration, "created_at < now() - interval '24 hours'", "backfill de jobs abandonados")
requireText(migration, "started_at is null", "solo jobs nunca iniciados")
requireText(migration, "operation_name is null", "no cerrar operación en curso")
requireText(migration, "provider_request_id is null", "no cerrar request de proveedor")

console.log("[test-video-stale-queue] cola de video expira sin borrar historial ni relanzar jobs antiguos")
