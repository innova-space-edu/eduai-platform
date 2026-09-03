import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { buildBrainAIV6Cycle } from "@/lib/brain-ai/lifelong-learning"
import type { BrainAIStoredTrace } from "@/lib/brain-ai/telemetry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEADERS = { "Cache-Control": "no-store, max-age=0" }

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data } = await supabase.from("admin_emails").select("email").eq("email", user.email).maybeSingle()
  return data ? user : null
}

function traceFromRow(row: Record<string, any>): BrainAIStoredTrace {
  return {
    traceId: String(row.trace_id || ""),
    createdAt: String(row.created_at || new Date().toISOString()),
    modalities: Array.isArray(row.modalities) ? row.modalities : ["text"],
    intent: row.intent,
    route: row.route,
    complexity: Number(row.complexity || 0),
    confidence: Number(row.confidence || 0),
    productionStage: row.production_stage,
    estimatedLocality: row.locality,
    expectedLatencyClass: row.latency_class,
    planLength: Number(row.plan_length || 0),
    gatePassRate: Number(row.gate_pass_rate || 0),
  } as BrainAIStoredTrace
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS })

  try {
    const admin = adminClient()
    const [{ data: cycles, error: cyclesError }, { count: traceCount, error: traceError }] = await Promise.all([
      admin
        .from("brain_ai_v6_cycles")
        .select("id,generated_at,mode,readiness,gate_snapshot,experience_count,reflection_count,dream_count,skill_candidate_count,production_write_allowed,model_weight_update_allowed")
        .eq("user_id", user.id)
        .order("generated_at", { ascending: false })
        .limit(8),
      admin
        .from("brain_ai_shadow_traces")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ])

    if (cyclesError) throw cyclesError
    if (traceError) throw traceError

    return NextResponse.json({ cycles: cycles || [], persistedShadowTraces: traceCount || 0 }, { headers: HEADERS })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer Experience Store V6" }, { status: 500, headers: HEADERS })
  }
}

export async function POST() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS })

  try {
    const admin = adminClient()
    const { data: rows, error: traceError } = await admin
      .from("brain_ai_shadow_traces")
      .select("trace_id,created_at,modalities,intent,route,complexity,confidence,production_stage,locality,latency_class,plan_length,gate_pass_rate")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40)

    if (traceError) throw traceError

    const traces = (rows || []).map(row => traceFromRow(row as Record<string, any>))
    const report = buildBrainAIV6Cycle(traces)

    const { data: cycle, error: cycleError } = await admin
      .from("brain_ai_v6_cycles")
      .insert({
        user_id: user.id,
        generated_at: report.generatedAt,
        mode: report.mode,
        readiness: report.readiness,
        gate_snapshot: report.gates,
        experience_count: report.experiences.length,
        reflection_count: report.reflections.length,
        dream_count: report.dreams.length,
        skill_candidate_count: report.skillCandidates.length,
        production_write_allowed: false,
        model_weight_update_allowed: false,
      })
      .select("id")
      .single()

    if (cycleError) throw cycleError
    const cycleId = cycle.id as string

    if (report.experiences.length) {
      const { error } = await admin.from("brain_ai_v6_experiences").insert(report.experiences.map(item => ({
        cycle_id: cycleId,
        user_id: user.id,
        trace_id: item.traceId,
        intent: item.intent,
        route: item.route,
        modalities: item.modalities,
        locality: item.locality,
        complexity: item.complexity,
        confidence: item.confidence,
        gate_pass_rate: item.gatePassRate,
        plan_length: item.planLength,
        production_stage: item.productionStage,
        source_created_at: item.createdAt,
      })))
      if (error) throw error
    }

    if (report.reflections.length) {
      const { error } = await admin.from("brain_ai_v6_reflections").insert(report.reflections.map(item => ({
        cycle_id: cycleId,
        user_id: user.id,
        trace_id: item.traceId,
        kind: item.kind,
        observation: item.observation,
        confidence: item.confidence,
      })))
      if (error) throw error
    }

    if (report.dreams.length) {
      const { error } = await admin.from("brain_ai_v6_dream_hypotheses").insert(report.dreams.map(item => ({
        cycle_id: cycleId,
        user_id: user.id,
        dream_key: item.id,
        based_on_experience_ids: item.basedOnExperienceIds,
        intent: item.intent,
        hypothesis: item.hypothesis,
        counterfactual: item.counterfactual,
        confidence: item.confidence,
        origin: "simulated",
        truth_status: "hypothesis",
        eligible_for_fact_memory: false,
        eligible_for_production_promotion: false,
      })))
      if (error) throw error
    }

    if (report.skillCandidates.length) {
      const { error } = await admin.from("brain_ai_v6_skill_candidates").insert(report.skillCandidates.map(item => ({
        cycle_id: cycleId,
        user_id: user.id,
        skill_key: item.id,
        intent: item.intent,
        route: item.route,
        evidence_count: item.evidenceCount,
        average_gate_pass_rate: item.averageGatePassRate,
        average_confidence: item.averageConfidence,
        stage: "candidate",
        production_promotion_allowed: false,
      })))
      if (error) throw error
    }

    await admin.from("model_lab_audit_logs").insert({
      user_id: user.id,
      action: "brain_ai_v6_persist_cycle",
      provider: "brain-ai",
      model_id: "v6",
      decision: "lab-only",
      metadata: {
        cycle_id: cycleId,
        readiness: report.readiness,
        experience_count: report.experiences.length,
        dream_count: report.dreams.length,
        production_write_allowed: false,
      },
    })

    return NextResponse.json({ success: true, cycleId, report }, { headers: HEADERS })
  } catch (error) {
    console.error("[Brain AI V6 Experience Store]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo persistir el ciclo V6" }, { status: 500, headers: HEADERS })
  }
}
