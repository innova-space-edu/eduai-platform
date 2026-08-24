import { NextRequest, NextResponse } from "next/server"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import { runAIText } from "@/lib/ai/gateway"
import { generateGoogleGroundedText, hasGoogleAI } from "@/lib/ai/providers/google"
import { retrieveRelevantChunks } from "@/lib/notebook/retrieval"
import { createClient } from "@/lib/supabase/server"
import type { ResearchScope, WorkCitation } from "@/lib/work/types"

export const runtime = "nodejs"
export const maxDuration = 60

type HistoryMessage = { role: "user" | "assistant"; content: string }
type SourceRow = { id: string; title: string | null; url: string | null; type: string | null }

function normalizeHistory(value: unknown): HistoryMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is HistoryMessage => (
      !!item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string"
    ))
    .slice(-8)
}

function dedupeCitations(citations: WorkCitation[]) {
  const seen = new Set<string>()
  return citations.filter((citation) => {
    const key = citation.sourceUrl || `${citation.sourceId}:${citation.chunkId || ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 12)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const message = String(body?.message || "").trim()
    const notebookId = typeof body?.notebookId === "string" ? body.notebookId : null
    const scope: ResearchScope = ["sources", "sources_web", "web"].includes(body?.scope)
      ? body.scope
      : "sources_web"
    const history = normalizeHistory(body?.history)

    if (!message) return NextResponse.json({ error: "Escribe una pregunta" }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    try {
      await assertAICapabilityAllowed({
        supabase,
        userId: user.id,
        capability: "research",
        provider: scope === "sources" ? null : "google",
      })
    } catch (accessError) {
      const typed = accessError as Error & { code?: string; status?: number }
      return NextResponse.json(
        { error: typed.message, code: typed.code || "ACCESS_RESTRICTED" },
        { status: typed.status || 403 },
      )
    }

    let sourceContext = ""
    const localCitations: WorkCitation[] = []

    if (notebookId && scope !== "web") {
      const { data: notebook } = await supabase
        .from("notebooks")
        .select("id, title")
        .eq("id", notebookId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!notebook) return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 })

      const { data: sourceData } = await supabase
        .from("notebook_sources")
        .select("id, title, url, type")
        .eq("notebook_id", notebookId)
        .eq("is_active", true)
        .eq("status", "ready")
      const sources = (sourceData ?? []) as SourceRow[]
      const sourceMap = new Map(sources.map((source) => [source.id, source]))
      const chunks = sources.length
        ? await retrieveRelevantChunks({ notebookId, query: message, limit: 10 })
        : []

      sourceContext = chunks.map((chunk, index) => {
        const source = sourceMap.get(chunk.source_id)
        const title = source?.title || source?.url || `Fuente ${index + 1}`
        localCitations.push({
          sourceId: chunk.source_id,
          sourceTitle: title,
          sourceUrl: source?.url,
          sourceType: source?.type,
          chunkId: chunk.id,
          snippet: chunk.chunk_text.replace(/\s+/g, " ").trim().slice(0, 280),
        })
        return `[FUENTE DEL CUADERNO ${index + 1}: ${title}]\n${chunk.chunk_text}`
      }).join("\n\n---\n\n")
    }

    const systemPrompt = `Eres Open EDUAI Work, un investigador y asistente educativo riguroso para Chile.
Responde en español claro. Distingue hechos, interpretación e incertidumbre.
Usa citas junto a las afirmaciones relevantes y termina con una síntesis accionable.
${scope === "sources"
  ? "Usa exclusivamente las fuentes del cuaderno entregadas. Si no alcanzan, indícalo."
  : scope === "web"
    ? "Usa búsqueda web actual y verificable."
    : "Combina las fuentes del cuaderno con búsqueda web actual y verificable; diferencia claramente ambos orígenes."}
No inventes fuentes, autores, páginas ni URLs.`

    const prompt = sourceContext
      ? `${message}\n\nFUENTES DEL CUADERNO:\n${sourceContext}`
      : message

    if (scope === "sources") {
      if (!sourceContext) {
        return NextResponse.json({ error: "Este trabajo no tiene fuentes activas procesadas" }, { status: 422 })
      }

      const result = await runAIText({
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: prompt },
        ],
        capability: "long_context",
        maxOutputTokens: 3_500,
        context: {
          userId: user.id,
          workspaceId: notebookId,
          module: "open-work-research",
          sourceId: notebookId,
          reusePolicy: "exact_private",
          visibility: "private",
        },
        supabase,
      })

      return NextResponse.json({
        text: result.data,
        provider: result.provider,
        model: result.model,
        usedWeb: false,
        reused: result.reused,
        generationAvoided: result.reused,
        citations: dedupeCitations(localCitations),
      })
    }

    if (hasGoogleAI("text")) {
      try {
        const grounded = await generateGoogleGroundedText({
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: prompt },
          ],
          maxOutputTokens: 4096,
          temperature: 0.35,
        })

        const webCitations: WorkCitation[] = grounded.sources.map((source, index) => ({
          sourceId: `web-${index}`,
          sourceTitle: source.title || source.uri,
          sourceUrl: source.uri,
          sourceType: "web",
        }))

        return NextResponse.json({
          text: grounded.text,
          provider: grounded.provider,
          model: grounded.model,
          usedWeb: grounded.usedSearch,
          searchQueries: grounded.searchQueries,
          reused: false,
          generationAvoided: false,
          citations: dedupeCitations([...localCitations, ...webCitations]),
        })
      } catch (groundingError) {
        console.warn("[Open EDUAI Work research] Google grounding fallback:", groundingError)
      }
    }

    const fallback = await runAIText({
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\nLa búsqueda web no está disponible en esta ejecución. No digas que verificaste información en internet y señala la limitación de actualidad.`,
        },
        ...history,
        { role: "user", content: prompt },
      ],
      capability: sourceContext ? "long_context" : "research",
      maxOutputTokens: 3_500,
      context: {
        userId: user.id,
        workspaceId: notebookId,
        module: "open-work-research-fallback",
        sourceId: notebookId,
        reusePolicy: "exact_private",
        visibility: "private",
      },
      supabase,
    })

    return NextResponse.json({
      text: `${fallback.data}\n\n> La búsqueda web no estuvo disponible en esta respuesta.`,
      provider: fallback.provider,
      model: fallback.model,
      usedWeb: false,
      searchQueries: [],
      reused: fallback.reused,
      generationAvoided: fallback.reused,
      citations: dedupeCitations(localCitations),
    })
  } catch (error) {
    console.error("[Open EDUAI Work research]", error)
    const typed = error as Error & { status?: number; code?: string }
    return NextResponse.json(
      { error: typed.message || "No fue posible completar la investigación", code: typed.code || undefined },
      { status: typed.status || 500 },
    )
  }
}
