import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEADERS = { "Cache-Control": "no-store, max-age=0" }
const STATUSES = new Set(["discovered", "queued", "testing", "validated", "rejected", "implemented"])

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

function clean(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS })

  try {
    const admin = adminClient()
    const { data, error } = await admin
      .from("ai_model_candidates")
      .select("id,provider,model,label,capabilities,source_url,release_channel,status,priority,notes,metadata,last_evaluated_at,created_at,updated_at,ai_model_evaluations(id,status,suite,latency_ms,quality_score,reliability_score,cost_score,created_at,completed_at)")
      .order("priority", { ascending: true })
      .order("provider", { ascending: true })
      .order("model", { ascending: true })

    if (error) throw error
    return NextResponse.json({ candidates: data || [] }, { headers: HEADERS })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer la cola de modelos" }, { status: 500, headers: HEADERS })
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS })

  const body = await request.json().catch(() => ({}))
  const action = clean(body?.action, 40)

  try {
    const admin = adminClient()

    if (action === "sync_registry") {
      const { data: registered, error: registryError } = await admin
        .from("ai_provider_models")
        .select("provider,model,label,capabilities,priority")
      if (registryError) throw registryError

      if (registered?.length) {
        const { error } = await admin.from("ai_model_candidates").upsert(registered.map(row => ({
          provider: row.provider,
          model: row.model,
          label: row.label || row.model,
          capabilities: row.capabilities || [],
          release_channel: "unknown",
          status: "implemented",
          priority: row.priority ?? 100,
          metadata: { synced_from: "ai_provider_models" },
          updated_at: new Date().toISOString(),
        })), { onConflict: "provider,model" })
        if (error) throw error
      }

      return NextResponse.json({ success: true, synced: registered?.length || 0 }, { headers: HEADERS })
    }

    if (action === "queue_evaluation") {
      const candidateId = clean(body?.candidateId, 80)
      if (!candidateId) return NextResponse.json({ error: "candidateId requerido" }, { status: 400, headers: HEADERS })

      const { data: candidate, error: candidateError } = await admin
        .from("ai_model_candidates")
        .select("id,provider,model,status")
        .eq("id", candidateId)
        .maybeSingle()
      if (candidateError) throw candidateError
      if (!candidate) return NextResponse.json({ error: "Modelo candidato no encontrado" }, { status: 404, headers: HEADERS })
      if (candidate.status === "implemented") return NextResponse.json({ error: "El modelo ya está implementado; usa benchmark del registro activo." }, { status: 409, headers: HEADERS })

      const { data: evaluation, error: evaluationError } = await admin
        .from("ai_model_evaluations")
        .insert({ candidate_id: candidateId, user_id: user.id, suite: "model-lab-smoke", status: "queued", metrics: { source: "admin-model-lab" } })
        .select("id,status")
        .single()
      if (evaluationError) throw evaluationError

      const { error: updateError } = await admin
        .from("ai_model_candidates")
        .update({ status: "testing", updated_at: new Date().toISOString() })
        .eq("id", candidateId)
      if (updateError) throw updateError

      await admin.from("model_lab_audit_logs").insert({
        user_id: user.id,
        action: "queue_model_candidate_evaluation",
        provider: candidate.provider,
        model_id: candidate.model,
        decision: "testing",
        metadata: { candidate_id: candidateId, evaluation_id: evaluation.id, suite: "model-lab-smoke" },
      })

      return NextResponse.json({ success: true, evaluation }, { headers: HEADERS })
    }

    if (action === "add") {
      const provider = clean(body?.provider, 60).toLowerCase()
      const model = clean(body?.model, 180)
      const label = clean(body?.label, 180) || model
      const sourceUrl = clean(body?.sourceUrl, 500)
      const releaseChannel = clean(body?.releaseChannel, 30) || "unknown"
      const capabilities = Array.isArray(body?.capabilities)
        ? body.capabilities.map((item: unknown) => clean(item, 60)).filter(Boolean).slice(0, 20)
        : []

      if (!provider || !model || !["stable", "preview", "experimental", "unknown"].includes(releaseChannel)) {
        return NextResponse.json({ error: "provider, model y releaseChannel válidos son requeridos" }, { status: 400, headers: HEADERS })
      }

      const { data, error } = await admin
        .from("ai_model_candidates")
        .upsert({
          provider,
          model,
          label,
          capabilities,
          source_url: sourceUrl || null,
          release_channel: releaseChannel,
          status: "discovered",
          priority: 100,
          updated_at: new Date().toISOString(),
        }, { onConflict: "provider,model" })
        .select("*")
        .single()
      if (error) throw error

      return NextResponse.json({ success: true, candidate: data }, { headers: HEADERS })
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400, headers: HEADERS })
  } catch (error) {
    console.error("[AI model candidates]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la cola de modelos" }, { status: 500, headers: HEADERS })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: HEADERS })

  const body = await request.json().catch(() => ({}))
  const candidateId = clean(body?.candidateId, 80)
  const status = clean(body?.status, 30)
  const notes = clean(body?.notes, 1000)

  if (!candidateId || !STATUSES.has(status)) {
    return NextResponse.json({ error: "candidateId y status válidos son requeridos" }, { status: 400, headers: HEADERS })
  }

  try {
    const admin = adminClient()
    const { data: current, error: currentError } = await admin
      .from("ai_model_candidates")
      .select("provider,model")
      .eq("id", candidateId)
      .maybeSingle()
    if (currentError) throw currentError
    if (!current) return NextResponse.json({ error: "Modelo candidato no encontrado" }, { status: 404, headers: HEADERS })

    const { data, error } = await admin
      .from("ai_model_candidates")
      .update({ status, notes: notes || null, last_evaluated_at: ["validated", "rejected", "implemented"].includes(status) ? new Date().toISOString() : undefined, updated_at: new Date().toISOString() })
      .eq("id", candidateId)
      .select("*")
      .single()
    if (error) throw error

    await admin.from("model_lab_audit_logs").insert({
      user_id: user.id,
      action: "update_model_candidate_status",
      provider: current.provider,
      model_id: current.model,
      decision: status,
      metadata: { candidate_id: candidateId },
    })

    return NextResponse.json({ success: true, candidate: data }, { headers: HEADERS })
  } catch (error) {
    console.error("[AI model candidates]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el candidato" }, { status: 500, headers: HEADERS })
  }
}
