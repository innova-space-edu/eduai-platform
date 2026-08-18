import fs from "node:fs"
import path from "node:path"

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260818122935_generation_provider_health_events.sql",
)

if (!fs.existsSync(migrationPath)) {
  throw new Error("[test-provider-health-events] Falta migración 20260818122935")
}

const sql = fs.readFileSync(migrationPath, "utf8")
const executableSql = sql.replace(/--.*$/gm, "")

function requireText(value, label) {
  if (!sql.includes(value)) {
    throw new Error(`[test-provider-health-events] Falta ${label}: ${value}`)
  }
}

requireText("create or replace function public.capture_ai_generation_provider_health()", "función de captura")
requireText("security definer\nset search_path = ''", "función endurecida")
requireText("new.status not in ('completed', 'failed')", "filtro de estados finales")
requireText("new.status = 'reused'", "exclusión explícita de reutilización")
requireText("insert into public.ai_provider_health", "persistencia de salud")
requireText("like 'together%' then 'together'", "normalización de Together")
requireText("jsonb_build_object('source', 'ai_generation_requests')", "origen mínimo de telemetría")
requireText("create trigger ai_generation_requests_provider_health", "trigger de generaciones")
requireText("'backfill', true", "backfill histórico marcado")

for (const forbidden of ["new.request_json", "new.response_metadata", "r.request_json", "r.response_metadata"]) {
  if (executableSql.includes(forbidden)) {
    throw new Error(`[test-provider-health-events] La telemetría no debe copiar contenido sensible: ${forbidden}`)
  }
}

console.log("[test-provider-health-events] eventos finales de proveedor sin prompts/respuestas verificados")
