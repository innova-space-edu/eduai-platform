import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { runModelLabTextBenchmark } from "@/lib/ai/model-lab-benchmark"

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

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS })

  const body = await request.json().catch(() => ({}))
  const candidateId = typeof body?.candidateId === "string" ? body.candidateId.trim().slice(0, 80) : ""
  if (!candidateId) return NextResponse.json({ error: "candidateId requerido" }, { status: 400, headers: HEADERS })

  try {
    const admin = adminClient()
    const { data: candidate, error: candidateError } = await admin
      .from("ai_model_candidates")
      .select("id,provider,model,label,capabilities,status")
      .eq("id", candidateId)
      .maybeSingle()
    if (candidateError) throw candidateError
    if (!candidate) return NextResponse.json({ error: "Modelo candidato no encontrado" }, { status: 404, headers: HEADERS })
    if (candidate.status === "implemented") return NextResponse.json({ error: "El modelo ya está implementado; usa el benchmark del registro activo." }, { status: 409, headers: HEADERS })

    const { data: evaluation, error: evaluationError } = await admin
      .from("ai_model_evaluations")
      .insert({
        candidate_id: candidate.id,
        user_id: user.id,
        suite: "model-lab-text-v1",
        status: "running",
        metrics: { provider: candidate.provider, model: candidate.model, version: 1 },
      })
      .select("id")
      .single()
    if (evaluationError) throw evaluationError

    await admin.from("ai_model_candidates").update({ status: "testing", updated_at: new Date().toISOString() }).eq("id", candidate.id)

    const result = await runModelLabTextBenchmark(candidate.provider, candidate.model, candidate.capabilities || [])
    const evaluationStatus = result.supported ? (result.passed ? "passed" : "failed") : "blocked"

    const { error: resultError } = await admin
      .from("ai_model_evaluations")
      .update({
        status: evaluationStatus,
        latency_ms: result.averageLatencyMs,
        quality_score: result.qualityScore,
        reliability_score: result.reliabilityScore,
        notes: result.detail,
        metrics: {
          provider: result.provider,
          model: result.model,
          version: 1,
          supported: result.supported,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          cases: result.cases,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", evaluation.id)
    if (resultError) throw resultError

    const nextStatus = result.passed ? "validated" : (result.supported ? "testing" : candidate.status)
    await admin
      .from("ai_model_candidates")
      .update({ status: nextStatus, last_evaluated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", candidate.id)

    await admin.from("model_lab_audit_logs").insert({
      user_id: user.id,
      action: "model_candidate_text_benchmark",
      provider: candidate.provider,
      model_id: candidate.model,
      decision: evaluationStatus,
      metadata: {
        candidate_id: candidate.id,
        evaluation_id: evaluation.id,
        quality_score: result.qualityScore,
        reliability_score: result.reliabilityScore,
        average_latency_ms: result.averageLatencyMs,
      },
    })

    return NextResponse.json({ success: true, evaluationId: evaluation.id, nextStatus, result }, { headers: HEADERS })
  } catch (error) {
    console.error("[Model candidate benchmark]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo ejecutar benchmark" }, { status: 500, headers: HEADERS })
  }
}
