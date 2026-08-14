import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 60

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase admin no configurado")
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data } = await supabase.from("admin_emails").select("email").eq("email", user.email).maybeSingle()
  return data ? user : null
}

function parseDays(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("days") || 30)
  return [1, 7, 30, 90, 365].includes(raw) ? raw : 30
}

function number(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

  const admin = getAdminClient()
  const days = parseDays(req)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [requestsResult, modelsResult, healthResult, assetsResult, cacheResult] = await Promise.all([
    admin
      .from("ai_generation_requests")
      .select("id,owner_id,capability,source_module,provider,model,status,latency_ms,estimated_cost_usd,input_tokens,output_tokens,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10_000),
    admin
      .from("ai_provider_models")
      .select("provider,model,label,capabilities,is_enabled,is_default,priority,deprecated_at,shutdown_at,updated_at")
      .order("provider")
      .order("priority"),
    admin
      .from("ai_provider_health")
      .select("provider,model,capability,status,latency_ms,error_code,checked_at")
      .order("checked_at", { ascending: false })
      .limit(200),
    admin
      .from("eduai_assets")
      .select("asset_type,visibility,created_at", { count: "exact" })
      .is("deleted_at", null)
      .gte("created_at", since)
      .limit(10_000),
    admin
      .from("ai_generation_cache")
      .select("capability,provider,model,hit_count,created_at,last_hit_at")
      .gte("created_at", since)
      .limit(10_000),
  ])

  const migrationRequired = [requestsResult, modelsResult, healthResult, assetsResult, cacheResult]
    .some((result) => result.error && (result.error.code === "42P01" || /schema cache|does not exist/i.test(result.error.message)))

  if (migrationRequired) {
    return NextResponse.json({
      migrationRequired: true,
      message: "Aplica las migraciones EduAI AI Core en el proyecto Supabase correcto.",
      periodDays: days,
    })
  }

  const requests = requestsResult.data || []
  const completed = requests.filter((row) => row.status === "completed")
  const reused = requests.filter((row) => row.status === "reused")
  const failed = requests.filter((row) => row.status === "failed")
  const total = requests.length
  const realGenerations = completed.length
  const generationAvoided = reused.length
  const cacheHitRate = total > 0 ? Math.round((generationAvoided / total) * 1000) / 10 : 0

  const byCapability = new Map<string, { requests: number; generated: number; reused: number; failed: number; latency: number[] }>()
  const byProvider = new Map<string, { requests: number; generated: number; reused: number; failed: number; latency: number[]; cost: number }>()

  for (const row of requests) {
    const capability = row.capability || "unknown"
    const provider = row.provider || "unknown"
    if (!byCapability.has(capability)) byCapability.set(capability, { requests: 0, generated: 0, reused: 0, failed: 0, latency: [] })
    if (!byProvider.has(provider)) byProvider.set(provider, { requests: 0, generated: 0, reused: 0, failed: 0, latency: [], cost: 0 })

    const cap = byCapability.get(capability)!
    const prov = byProvider.get(provider)!
    cap.requests += 1
    prov.requests += 1
    if (row.status === "completed") { cap.generated += 1; prov.generated += 1 }
    if (row.status === "reused") { cap.reused += 1; prov.reused += 1 }
    if (row.status === "failed") { cap.failed += 1; prov.failed += 1 }
    if (number(row.latency_ms) > 0) { cap.latency.push(number(row.latency_ms)); prov.latency.push(number(row.latency_ms)) }
    prov.cost += number(row.estimated_cost_usd)
  }

  const cacheRows = cacheResult.data || []
  const totalPersistentHits = cacheRows.reduce((sum, row) => sum + number(row.hit_count), 0)
  const userIds = new Set(requests.map((row) => row.owner_id).filter(Boolean))

  const latestHealth = new Map<string, any>()
  for (const row of healthResult.data || []) {
    const key = `${row.provider}:${row.model || "*"}:${row.capability || "*"}`
    if (!latestHealth.has(key)) latestHealth.set(key, row)
  }

  return NextResponse.json({
    migrationRequired: false,
    periodDays: days,
    summary: {
      requests: total,
      realGenerations,
      generationsAvoided: generationAvoided,
      failures: failed.length,
      cacheHitRate,
      persistentCacheHits: totalPersistentHits,
      activeUsers: userIds.size,
      assetsCreated: assetsResult.count || 0,
      estimatedRecordedCostUsd: Math.round(requests.reduce((sum, row) => sum + number(row.estimated_cost_usd), 0) * 1_000_000) / 1_000_000,
    },
    byCapability: [...byCapability.entries()].map(([capability, row]) => ({
      capability,
      requests: row.requests,
      generated: row.generated,
      reused: row.reused,
      failed: row.failed,
      cacheHitRate: row.requests ? Math.round((row.reused / row.requests) * 1000) / 10 : 0,
      avgLatencyMs: row.latency.length ? Math.round(row.latency.reduce((a, b) => a + b, 0) / row.latency.length) : 0,
    })).sort((a, b) => b.requests - a.requests),
    byProvider: [...byProvider.entries()].map(([provider, row]) => ({
      provider,
      requests: row.requests,
      generated: row.generated,
      reused: row.reused,
      failed: row.failed,
      avgLatencyMs: row.latency.length ? Math.round(row.latency.reduce((a, b) => a + b, 0) / row.latency.length) : 0,
      estimatedRecordedCostUsd: Math.round(row.cost * 1_000_000) / 1_000_000,
    })).sort((a, b) => b.requests - a.requests),
    models: modelsResult.data || [],
    providerHealth: [...latestHealth.values()],
  })
}