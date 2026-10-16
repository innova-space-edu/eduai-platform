import "server-only";
import { createClient as adminSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type IncidentCategory = "provider_quota" | "provider_auth" | "provider_timeout" | "provider_down" | "provider_error" | "storage" | "configuration" | "task" | "runtime";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentInput = {
  fingerprint: string; category: IncidentCategory; severity: IncidentSeverity;
  module: string; provider?: string; title: string; message: string;
};

function managementClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return adminSupabase(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireIncidentAdmin() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email) return { ok: false, status: 401, client: null };
  const { data: admin, error: adminError } = await client.from("admin_emails")
    .select("email").eq("email", user.email).maybeSingle();
  if (adminError || !admin) return { ok: false, status: 403, client: null };
  const elevated = managementClient();
  if (!elevated) return { ok: false, status: 503, client: null };
  return { ok: true, status: 200, client: elevated };
}

export async function recordAdminIncident(input: IncidentInput): Promise<boolean> {
  const db = managementClient();
  if (!db) return false;
  const clean = (s: string, n: number) => s.slice(0, n);
  const safeFingerprint = clean(input.fingerprint.toLowerCase().replace(/[^a-z0-9:_-]/g, "-"), 180);
  try {
    const { error } = await db.rpc("eduai_record_admin_incident", {
      p_fingerprint: safeFingerprint,
      p_category: input.category,
      p_severity: input.severity,
      p_module: clean(input.module, 80),
      p_provider: clean(input.provider || "", 64),
      p_title: clean(input.title, 180),
      p_message: clean(input.message, 500),
      p_metadata: {}, // NEVER store provider raw errors, prompts or keys.
    });
    if (error) {
      console.warn("[EDUAI Claw] incident persistence failed", error.code || "database_error");
      return false;
    }
    return true;
  } catch {
    console.warn("[EDUAI Claw] incident store unavailable");
    return false;
  }
}

export function classifyProviderFailure(provider: string, errorText: string): IncidentInput | null {
  const normalizedProvider = provider.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  if (!normalizedProvider) return null;
  const text = errorText.toLowerCase();
  const kind: IncidentCategory =
    /429|resource_exhausted|quota|credit|billing|insufficient_balance|limit.exceeded/.test(text)
      ? "provider_quota"
      : /401|403|unauthorized|forbidden|api.?key|token invalid|auth/.test(text)
        ? "provider_auth"
        : /time.?out|timed out|timeout|abort/.test(text)
          ? "provider_timeout"
          : /502|503|504|unavailable|connection refused|dns|offline/.test(text)
            ? "provider_down"
            : "provider_error";
  const labels: Record<IncidentCategory, string> = {
    provider_quota: "Cuota o créditos agotados",
    provider_auth: "Credenciales o permisos",
    provider_timeout: "Tiempo de espera",
    provider_down: "Servicio no disponible",
    provider_error: "Error de generación",
    storage: "Almacenamiento", configuration: "Configuración",
    task: "Tarea pendiente", runtime: "Runtime",
  };
  return {
    fingerprint: "image:" + normalizedProvider + ":" + kind,
    provider: normalizedProvider,
    module: "image-studio",
    category: kind,
    severity: kind === "provider_quota" || kind === "provider_auth" ? "high" : "medium",
    title: normalizedProvider + " · " + labels[kind],
    message: "Image Studio registró un fallo del proveedor. Verifica sus cuotas, credenciales y disponibilidad en el panel correspondiente.",
  };
}

export async function recordImageProviderFailures(attempts: Array<{provider: string; error: string}>) {
  // A provider attempt is one verified failure. Existing fingerprint is updated instead of a new alert.
  await Promise.allSettled(attempts.slice(0, 8).map((attempt) => {
    const incident = classifyProviderFailure(attempt.provider, attempt.error);
    return incident ? recordAdminIncident(incident) : Promise.resolve(false);
  }));
}

export async function getEduClawSnapshot(db: SupabaseClient) {
  const [incidentsResult, tasksResult, healthResult] = await Promise.all([
    db.from("eduai_admin_incidents").select("id,fingerprint,category,severity,module,provider,title,message,status,occurrences,first_seen_at,last_seen_at,acknowledged_at,resolved_at")
      .neq("status", "resolved").order("last_seen_at", { ascending: false }).limit(100),
    db.from("eduai_admin_tasks").select("id,task_key,module,title,detail,priority,status,created_at,updated_at")
      .in("status", ["pending", "in_progress"]).order("created_at", { ascending: true }).limit(60),
    db.from("ai_provider_health").select("provider,capability,status,error_code,checked_at")
      .order("checked_at", { ascending: false }).limit(30),
  ]);
  if (incidentsResult.error || tasksResult.error) throw new Error("La base de datos de incidencias no está preparada");
  const incidents = incidentsResult.data || [];
  const tasks = tasksResult.data || [];
  // Only measured provider signals; no polling of external APIs or unverified "online" claims.
  const latestByProvider = new Map<string, {provider:string;capability:string;status:string;error_code:string|null;checked_at:string}>();
  for (const row of healthResult.data || []) {
    const id = row.capability + ":" + row.provider;
    if (!latestByProvider.has(id)) latestByProvider.set(id, row);
  }
  return {
    checkedAt: new Date().toISOString(),
    monitor: "Edu Claw · evaluación determinista con telemetría disponible",
    completeSystemAudit: false,
    incidents, tasks, providers: [...latestByProvider.values()],
    counts: {
      open: incidents.filter((i) => i.status === "open").length,
      acknowledged: incidents.filter((i) => i.status === "acknowledged").length,
      high: incidents.filter((i) => i.severity === "high" || i.severity === "critical").length,
      pendingTasks: tasks.length,
    },
    limitations: [
      "La actualización no ejecuta comprobaciones externas ni asegura cobertura de servicios sin telemetría.",
      "La antigüedad se calcula desde la primera detección del incidente abierto.",
    ],
  };
}
