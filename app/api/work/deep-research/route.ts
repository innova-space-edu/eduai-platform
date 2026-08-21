import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import { generationFingerprint } from "@/lib/ai/fingerprint"
import {
  createEduAIAsset,
  findReusableGeneration,
  finishGenerationRequest,
  recordGenerationStart,
  saveReusableGeneration,
} from "@/lib/ai/reuse"
import { getGoogleDeepResearch, hasGoogleDeepResearch, startGoogleDeepResearch } from "@/lib/ai/providers/google-deep-research"
import { retrieveRelevantChunks } from "@/lib/notebook/retrieval"
import type { WorkCitation } from "@/lib/work/types"

export const runtime = "nodejs"
export const maxDuration = 60

const MODULE = "open-work-deep-research"
const REUSE_POLICY = "exact_private" as const
const MAX_QUERY_CHARS = 12_000
const MAX_SOURCE_CONTEXT_CHARS = 24_000

type DeepResearchJob = {
  id: string
  owner_id: string
  notebook_id: string | null
  generation_request_id: string | null
  interaction_id: string
  agent: string
  query: string
  fingerprint: string
  status: string
  result_text: string | null
  citations: WorkCitation[] | null
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function dedupeCitations(citations: WorkCitation[]) {
  const seen = new Set<string>()
  return citations.filter((citation) => {
    const key = citation.sourceUrl || `${citation.sourceId}:${citation.chunkId || ""}`
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 30)
}

async function notebookContext(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  notebookId: string | null
  query: string
  includeSources: boolean
}) {
  if (!input.notebookId || !input.includeSources) return { text: "", citations: [] as WorkCitation[] }

  const { data: notebook } = await input.supabase
    .from("notebooks")
    .select("id")
    .eq("id", input.notebookId)
    .eq("user_id", input.userId)
    .maybeSingle()
  if (!notebook) throw Object.assign(new Error("Trabajo no encontrado"), { status: 404 })

  const { data: sourceRows } = await input.supabase
    .from("notebook_sources")
    .select("id,title,url,type")
    .eq("notebook_id", input.notebookId)
    .eq("is_active", true)
    .eq("status", "ready")
  const sourceMap = new Map((sourceRows || []).map((source) => [String(source.id), source]))
  const chunks = sourceRows?.length
    ? await retrieveRelevantChunks({ notebookId: input.notebookId, query: input.query, limit: 8 })
    : []

  const citations: WorkCitation[] = []
  const blocks = chunks.map((chunk, index) => {
    const source = sourceMap.get(String(chunk.source_id))
    const title = source?.title || source?.url || `Fuente ${index + 1}`
    citations.push({
      sourceId: String(chunk.source_id),
      sourceTitle: title,
      sourceUrl: source?.url || undefined,
      sourceType: source?.type || undefined,
      chunkId: chunk.id,
      snippet: chunk.chunk_text.replace(/\s+/g, " ").trim().slice(0, 280),
    })
    return `[FUENTE PRIVADA EDUAI ${index + 1}: ${title}]\n${chunk.chunk_text}`
  })

  return {
    text: blocks.join("\n\n---\n\n").slice(0, MAX_SOURCE_CONTEXT_CHARS),
    citations,
  }
}

function responseForStoredJob(job: DeepResearchJob) {
  return {
    jobId: job.id,
    status: job.status,
    agent: job.agent,
    text: job.result_text || "",
    citations: Array.isArray(job.citations) ? job.citations : [],
    error: job.error_message,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: job.completed_at,
    reused: false,
    generationAvoided: false,
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let requestId: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    const query = String(body?.message || body?.query || "").trim().slice(0, MAX_QUERY_CHARS)
    const notebookId = typeof body?.notebookId === "string" && body.notebookId.trim() ? body.notebookId.trim() : null
    const includeSources = body?.scope !== "web" && Boolean(notebookId)
    const visualization = body?.visualization === true
    const max = body?.max === true
    if (!query) return NextResponse.json({ error: "Escribe qué quieres investigar" }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    await assertAICapabilityAllowed({
      supabase,
      userId: user.id,
      capability: "research",
      provider: "google",
    })
    if (!hasGoogleDeepResearch()) {
      return NextResponse.json({ error: "Google Deep Research no está configurado" }, { status: 503 })
    }

    const local = await notebookContext({ supabase, userId: user.id, notebookId, query, includeSources })
    const agent = max && process.env.GOOGLE_DEEP_RESEARCH_MAX_ENABLED === "true"
      ? "deep-research-max-preview-04-2026"
      : "deep-research-preview-04-2026"
    const fingerprint = generationFingerprint({
      capability: "research",
      scopeKey: user.id,
      payload: {
        operation: "google-deep-research",
        query,
        notebookId,
        sourceContext: local.text,
        agent,
        visualization,
      },
    })

    const reusable = await findReusableGeneration({
      supabase,
      userId: user.id,
      fingerprint,
      capability: "research",
      reusePolicy: REUSE_POLICY,
    })
    const reusableReport = reusable?.result?.deepResearchReport as
      | { text?: string; citations?: WorkCitation[]; agent?: string }
      | undefined
    if (reusableReport?.text) {
      requestId = await recordGenerationStart({
        supabase,
        userId: user.id,
        capability: "research",
        fingerprint,
        module: MODULE,
        provider: reusable?.provider || "google",
        model: reusable?.model || agent,
        requestJson: { operation: "deep-research-cache-hit", notebookId, visualization },
        reusePolicy: REUSE_POLICY,
        workspaceId: notebookId,
      })
      await finishGenerationRequest({
        supabase,
        requestId,
        status: "reused",
        provider: reusable?.provider || "google",
        model: reusable?.model || agent,
        assetId: reusable?.assetId || null,
        latencyMs: Date.now() - startedAt,
        metadata: { cacheId: reusable?.id, generationAvoided: true, background: true },
      })
      return NextResponse.json({
        status: "completed",
        text: reusableReport.text,
        citations: Array.isArray(reusableReport.citations) ? reusableReport.citations : [],
        agent: reusableReport.agent || agent,
        reused: true,
        generationAvoided: true,
        assetId: reusable?.assetId || null,
      })
    }

    requestId = await recordGenerationStart({
      supabase,
      userId: user.id,
      capability: "research",
      fingerprint,
      module: MODULE,
      provider: "google",
      model: agent,
      requestJson: { operation: "deep-research", notebookId, includeSources, visualization, maxRequested: max },
      reusePolicy: REUSE_POLICY,
      workspaceId: notebookId,
    })

    const prompt = [
      "Realiza una investigación profunda, rigurosa y verificable. Responde en español.",
      "Distingue hechos, inferencias e incertidumbre. Incluye fuentes/citas verificables y una síntesis final accionable.",
      visualization ? "Cuando aporte valor, incluye visualizaciones o tablas comparativas." : "",
      `PREGUNTA DE INVESTIGACIÓN:\n${query}`,
      local.text ? `CONTEXTO PRIVADO DEL CUADERNO EDUAI (úsalo como evidencia adicional y diferéncialo de las fuentes web):\n${local.text}` : "",
    ].filter(Boolean).join("\n\n")

    const interaction = await startGoogleDeepResearch({ prompt, max, visualization })
    const admin = adminClient()
    const { data: job, error: insertError } = await admin
      .from("eduai_deep_research_jobs")
      .insert({
        owner_id: user.id,
        notebook_id: notebookId,
        generation_request_id: requestId,
        interaction_id: interaction.id,
        agent: interaction.agent,
        query,
        fingerprint,
        status: interaction.status === "failed" ? "failed" : "running",
        error_message: interaction.error,
        metadata: {
          local_citations: local.citations,
          include_sources: includeSources,
          visualization,
          google_status: interaction.rawStatus,
        },
      })
      .select("id,status,agent,created_at")
      .single()
    if (insertError || !job) throw new Error(`No se pudo registrar Deep Research: ${insertError?.message || "sin job"}`)

    if (interaction.status === "failed") {
      await finishGenerationRequest({
        supabase,
        requestId,
        status: "failed",
        provider: "google",
        model: interaction.agent,
        error: interaction.error || "Deep Research falló al iniciar",
        latencyMs: Date.now() - startedAt,
        metadata: { background: true, interactionId: interaction.id },
      })
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      agent: job.agent,
      reused: false,
      generationAvoided: false,
      createdAt: job.created_at,
    }, { status: 202 })
  } catch (error) {
    const typed = error as Error & { status?: number; code?: string }
    return NextResponse.json(
      { error: typed.message || "No fue posible iniciar Deep Research", code: typed.code || undefined },
      { status: typed.status || 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const jobId = request.nextUrl.searchParams.get("id")?.trim()
    if (!jobId) {
      const { data, error } = await supabase
        .from("eduai_deep_research_jobs")
        .select("id,notebook_id,agent,query,status,result_text,citations,error_message,created_at,updated_at,completed_at")
        .order("created_at", { ascending: false })
        .limit(20)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ jobs: data || [] })
    }

    const { data: rawJob, error: jobError } = await supabase
      .from("eduai_deep_research_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle()
    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })
    if (!rawJob) return NextResponse.json({ error: "Investigación no encontrada" }, { status: 404 })
    const job = rawJob as DeepResearchJob

    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return NextResponse.json(responseForStoredJob(job))
    }
    if (job.status === "finalizing") {
      return NextResponse.json({ ...responseForStoredJob(job), status: "finalizing" })
    }

    await assertAICapabilityAllowed({ supabase, userId: user.id, capability: "research", provider: "google" })
    const interaction = await getGoogleDeepResearch(job.interaction_id)
    const admin = adminClient()

    if (interaction.status === "running") {
      await admin.from("eduai_deep_research_jobs").update({
        status: "running",
        updated_at: new Date().toISOString(),
        metadata: { ...(job.metadata || {}), google_status: interaction.rawStatus },
      }).eq("id", job.id).eq("owner_id", user.id)
      return NextResponse.json({ ...responseForStoredJob(job), status: "running" })
    }

    if (interaction.status === "failed") {
      const errorMessage = interaction.error || "Google Deep Research falló"
      const now = new Date().toISOString()
      await admin.from("eduai_deep_research_jobs").update({
        status: "failed",
        error_message: errorMessage,
        updated_at: now,
        completed_at: now,
        metadata: { ...(job.metadata || {}), google_status: interaction.rawStatus },
      }).eq("id", job.id).eq("owner_id", user.id)
      await finishGenerationRequest({
        supabase,
        requestId: job.generation_request_id,
        status: "failed",
        provider: "google",
        model: job.agent,
        error: errorMessage,
        metadata: { background: true, interactionId: job.interaction_id },
      })
      return NextResponse.json({ ...responseForStoredJob(job), status: "failed", error: errorMessage })
    }

    const { data: claimed } = await admin
      .from("eduai_deep_research_jobs")
      .update({ status: "finalizing", updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("owner_id", user.id)
      .in("status", ["queued", "running"])
      .select("id")
      .maybeSingle()
    if (!claimed) {
      return NextResponse.json({ ...responseForStoredJob(job), status: "finalizing" })
    }

    const localCitations = Array.isArray(job.metadata?.local_citations)
      ? job.metadata?.local_citations as WorkCitation[]
      : []
    const googleCitations: WorkCitation[] = interaction.citations.map((citation, index) => ({
      sourceId: `deep-web-${index}`,
      sourceTitle: citation.title,
      sourceUrl: citation.uri,
      sourceType: "web",
    }))
    const citations = dedupeCitations([...localCitations, ...googleCitations])
    const text = interaction.text.trim()
    if (!text) throw new Error("Deep Research terminó sin un informe de texto")

    const assetId = await createEduAIAsset(supabase, {
      ownerId: user.id,
      assetType: "research-report",
      title: job.query.slice(0, 180),
      mimeType: "text/markdown",
      textContent: text,
      contentJson: { citations, agent: job.agent },
      sourceModule: MODULE,
      sourceId: job.interaction_id,
      generationRequestId: job.generation_request_id,
      fingerprint: job.fingerprint,
      visibility: "private",
      workspaceId: job.notebook_id,
      processingPurpose: "Conservar y reutilizar una investigación profunda solicitada por el usuario",
    })

    await saveReusableGeneration({
      supabase,
      userId: user.id,
      capability: "research",
      fingerprint: job.fingerprint,
      provider: "google",
      model: job.agent,
      assetId,
      reusePolicy: REUSE_POLICY,
      visibility: "private",
      workspaceId: job.notebook_id,
      result: { deepResearchReport: { text, citations, agent: job.agent } },
    })

    await finishGenerationRequest({
      supabase,
      requestId: job.generation_request_id,
      status: "completed",
      provider: "google",
      model: job.agent,
      assetId,
      metadata: { background: true, interactionId: job.interaction_id, deepResearch: true },
    })

    const now = new Date().toISOString()
    await admin.from("eduai_deep_research_jobs").update({
      status: "completed",
      result_text: text,
      citations,
      error_message: null,
      updated_at: now,
      completed_at: now,
      metadata: { ...(job.metadata || {}), google_status: interaction.rawStatus, asset_id: assetId },
    }).eq("id", job.id).eq("owner_id", user.id)

    return NextResponse.json({
      jobId: job.id,
      status: "completed",
      text,
      citations,
      agent: job.agent,
      assetId,
      reused: false,
      generationAvoided: false,
      completedAt: now,
    })
  } catch (error) {
    const typed = error as Error & { status?: number; code?: string }
    return NextResponse.json(
      { error: typed.message || "No fue posible consultar Deep Research", code: typed.code || undefined },
      { status: typed.status || 500 },
    )
  }
}
