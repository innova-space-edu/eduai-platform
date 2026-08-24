import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { AICapability, AIProviderId } from "./capabilities"

type ProviderHealthStatus = "healthy" | "degraded" | "down" | "unknown"

type HealthInput = {
  provider: AIProviderId
  model?: string | null
  capability: AICapability
  status: ProviderHealthStatus
  latencyMs?: number | null
  errorCode?: string | null
  metadata?: Record<string, unknown>
}

let adminClient: SupabaseClient | null | undefined

function getAdminClient(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    adminClient = null
    return null
  }

  adminClient = createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  return adminClient
}

function safeLatency(value?: number | null) {
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(Math.round(value as number), 2_147_483_647))
}

function safeCode(value?: string | null) {
  if (!value) return null
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 120)
}

/**
 * Telemetría server-only preparada para el AI Gateway.
 * No persiste prompts, respuestas, tokens ni secretos. La activación del
 * registro por intento se hará junto al circuit-breaker para no alterar aún
 * el hot path estable del Gateway.
 */
export async function recordProviderHealth(input: HealthInput): Promise<void> {
  const supabase = getAdminClient()
  if (!supabase) return

  try {
    const { error } = await supabase.from("ai_provider_health").insert({
      provider: input.provider,
      model: input.model || null,
      capability: input.capability,
      status: input.status,
      latency_ms: safeLatency(input.latencyMs),
      error_code: safeCode(input.errorCode),
      metadata: input.metadata || {},
    })

    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[AI provider health] telemetry insert failed", error.code || error.message)
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[AI provider health] telemetry unavailable",
        error instanceof Error ? error.name : "unknown",
      )
    }
  }
}

export function providerErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown_error"
  const typed = error as { code?: unknown; status?: unknown; name?: unknown }
  if (typeof typed.code === "string" && typed.code) return typed.code
  if (typeof typed.status === "number") return `http_${typed.status}`
  if (typeof typed.name === "string" && typed.name) return typed.name
  return "provider_error"
}
