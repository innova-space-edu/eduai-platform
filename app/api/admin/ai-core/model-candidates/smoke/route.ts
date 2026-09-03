import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { runModelLabSmoke } from "@/lib/ai/model-lab-smoke"

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

    const { data: evaluation, error: evaluationError } = await admin
      .from("ai_model_evaluations")
      .insert({
        candidate_id: candidate.id,
        user_id: user.id,
        suite: "model-lab-smoke",
        status: "running",
        metrics: { provider: candidate.provider, model: candidate.model },
      })
      .select("id")
      .single()
    if (evaluationError) throw evaluationError

    await admin.from("ai_model_candidates").update({ status: "testing", updated_at: new Date().toISOString() }).eq("id", candidate.id)

    const result = await runModelLabSmoke(candidate.provider, candidate.model, candidate.capabilities || [])
    const evaluationStatus = result.supported ? (result.passed ? "passed" : "failed") : "blocked"

    const { error: resultError } = await admin
      .from("ai_model_evaluations")
      .update({
        status: evaluationStatus,
        latency_ms: result.latencyMs,
        quality_score: result.passed ? 1 : 0,
        reliability_score: result.passed ? 1 : 0,
        notes: result.detail,
        metrics: {
          provider: result.provider,
          model: result.model,
          status_code: result.statusCode,
          output_matched: result.outputMatched,
          supported: result.supported,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", evaluation.id)
    if (resultError) throw resultError

    await admin
      .from("ai_model_candidates")
      .update({
        status: result.supported ? "testing" : candidate.status,
        last_evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidate.id)

    await admin.from("model_lab_audit_logs").insert({
      user_id: user.id,
      action: "model_candidate_smoke_test",
      provider: candidate.provider,
      model_id: candidate.model,
      decision: evaluationStatus,
      metadata: { candidate_id: candidate.id, evaluation_id: evaluation.id, latency_ms: result.latencyMs, supported: result.supported },
    })

    return NextResponse.json({ success: true, evaluationId: evaluation.id, result }, { headers: HEADERS })
  } catch (error) {
    console.error("[Model candidate smoke]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo ejecutar smoke test" }, { status: 500, headers: HEADERS })
  }
}
