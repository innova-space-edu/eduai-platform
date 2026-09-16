import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { runModelLabTextBenchmark } from "@/lib/ai/model-lab-benchmark"
import { supportsTextSmoke } from "@/lib/ai/model-lab-smoke"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

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

type Candidate = {
  id: string
  provider: string
  model: string
  label: string
  capabilities: string[]
  status: string
  release_channel: string
  priority: number
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS })

  const body = await request.json().catch(() => ({}))
  const requestedLimit = Number(body?.limit || 4)
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(6, Math.floor(requestedLimit))) : 4
  const provider = typeof body?.provider === "string" ? body.provider.trim().slice(0, 60) : ""
  const stableOnly = body?.stableOnly !== false

  try {
    const admin = adminClient()
    let query = admin
      .from("ai_model_candidates")
      .select("id,provider,model,label,capabilities,status,release_channel,priority")
      .in("status", ["queued", "discovered", "testing"])
      .order("priority", { ascending: true })
      .limit(24)

    if (provider) query = query.eq("provider", provider)
    if (stableOnly) query = query.eq("release_channel", "stable")

    const { data, error } = await query
    if (error) throw error

    const candidates = ((data || []) as Candidate[])
      .filter(item => supportsTextSmoke(item.capabilities || []))
      .slice(0, limit)

    const results: Array<Record<string, unknown>> = []
    for (const candidate of candidates) {
      const { data: evaluation, error: evaluationError } = await admin
        .from("ai_model_evaluations")
        .insert({
          candidate_id: candidate.id,
          user_id: user.id,
          suite: "model-lab-text-v1",
          status: "running",
          metrics: { provider: candidate.provider, model: candidate.model, version: 1, batch: true },
        })
        .select("id")
        .single()
      if (evaluationError) {
        results.push({ candidateId: candidate.id, model: candidate.model, status: "error", detail: evaluationError.message })
        continue
      }

      await admin.from("ai_model_candidates").update({ status: "testing", updated_at: new Date().toISOString() }).eq("id", candidate.id)
      const result = await runModelLabTextBenchmark(candidate.provider, candidate.model, candidate.capabilities || [])
      const evaluationStatus = result.supported ? (result.passed ? "passed" : "failed") : "blocked"
      const nextStatus = result.passed ? "validated" : (result.supported ? "testing" : candidate.status)

      await admin.from("ai_model_evaluations").update({
        status: evaluationStatus,
        latency_ms: result.averageLatencyMs,
        quality_score: result.qualityScore,
        reliability_score: result.reliabilityScore,
        notes: result.detail,
        metrics: {
          provider: result.provider,
          model: result.model,
          version: 1,
          batch: true,
          supported: result.supported,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          cases: result.cases,
        },
        completed_at: new Date().toISOString(),
      }).eq("id", evaluation.id)

      await admin.from("ai_model_candidates").update({
        status: nextStatus,
        last_evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", candidate.id)

      await admin.from("model_lab_audit_logs").insert({
        user_id: user.id,
        action: "model_candidate_batch_text_benchmark",
        provider: candidate.provider,
        model_id: candidate.model,
        decision: evaluationStatus,
        metadata: { candidate_id: candidate.id, evaluation_id: evaluation.id, next_status: nextStatus },
      })

      results.push({
        candidateId: candidate.id,
        provider: candidate.provider,
        model: candidate.model,
        label: candidate.label,
        status: evaluationStatus,
        nextStatus,
        qualityScore: result.qualityScore,
        reliabilityScore: result.reliabilityScore,
        averageLatencyMs: result.averageLatencyMs,
      })
    }

    return NextResponse.json({ success: true, requested: limit, tested: results.length, stableOnly, provider: provider || null, results }, { headers: HEADERS })
  } catch (error) {
    console.error("[Model candidate batch]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo ejecutar el lote de benchmarks" }, { status: 500, headers: HEADERS })
  }
}
