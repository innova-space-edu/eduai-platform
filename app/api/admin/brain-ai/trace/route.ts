import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { BrainAITrace } from "@/lib/brain-ai/types"

export const runtime = "nodejs"
export const maxDuration = 30

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

function migrationMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (error.code === "42P01" || /schema cache|does not exist/i.test(error.message || "")))
}

function clamp01(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(1, parsed))
}

function safeTrace(body: unknown): BrainAITrace | null {
  if (!body || typeof body !== "object") return null
  const candidate = (body as { trace?: unknown }).trace ?? body
  if (!candidate || typeof candidate !== "object") return null
  const trace = candidate as Partial<BrainAITrace>
  if (!trace.traceId || !trace.intent || !trace.route || !Array.isArray(trace.modalities) || !Array.isArray(trace.plan) || !Array.isArray(trace.gates)) return null
  return trace as BrainAITrace
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

  const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get("limit") || 40)))
  const admin = getAdminClient()
  const { data, error } = await admin
    .from("brain_ai_shadow_traces")
    .select("trace_id,modalities,intent,route,complexity,confidence,production_stage,locality,latency_class,plan_length,gate_pass_rate,metadata,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (migrationMissing(error)) return NextResponse.json({ migrationRequired: true, traces: [] }, { status: 503 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ traces: data || [] })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

  const trace = safeTrace(await req.json().catch(() => null))
  if (!trace) return NextResponse.json({ error: "Traza Brain AI inválida" }, { status: 400 })

  // Privacy boundary: intentionally exclude inputPreview, raw prompts, transcripts,
  // image/video data and memory content from persistent Shadow Mode telemetry.
  const passed = trace.gates.filter(gate => gate.passed).length
  const row = {
    user_id: user.id,
    trace_id: String(trace.traceId).slice(0, 180),
    modalities: trace.modalities.map(String).slice(0, 8),
    intent: String(trace.intent).slice(0, 80),
    route: String(trace.route).slice(0, 80),
    complexity: clamp01(trace.complexity),
    confidence: clamp01(trace.confidence),
    production_stage: String(trace.productionStage).slice(0, 80),
    locality: String(trace.estimatedLocality).slice(0, 40),
    latency_class: String(trace.expectedLatencyClass).slice(0, 40),
    plan_length: Math.max(0, Math.min(100, trace.plan.length)),
    gate_pass_rate: trace.gates.length ? clamp01(passed / trace.gates.length) : 0,
    metadata: {
      shadowMode: Boolean(trace.shadowMode),
      memoryKinds: trace.memoryPolicy?.read?.map(String).slice(0, 12) || [],
      capabilityIds: trace.plan.map(step => String(step.capabilityId)).slice(0, 30),
      predictionIds: trace.predictions?.map(item => String(item.id)).slice(0, 20) || [],
    },
  }

  const admin = getAdminClient()
  const { error } = await admin
    .from("brain_ai_shadow_traces")
    .upsert(row, { onConflict: "user_id,trace_id" })

  if (migrationMissing(error)) return NextResponse.json({ migrationRequired: true }, { status: 503 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

  const admin = getAdminClient()
  const { error } = await admin.from("brain_ai_shadow_traces").delete().eq("user_id", user.id)
  if (migrationMissing(error)) return NextResponse.json({ migrationRequired: true }, { status: 503 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
