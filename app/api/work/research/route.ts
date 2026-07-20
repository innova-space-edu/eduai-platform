import { NextRequest, NextResponse } from "next/server"
import { callAIv5 } from "@/lib/ai-router-v5"
import { retrieveRelevantChunks } from "@/lib/notebook/retrieval"
import { createClient } from "@/lib/supabase/server"
import type { ResearchScope, WorkCitation } from "@/lib/work/types"

export const runtime = "nodejs"
export const maxDuration = 60

const GEMINI_MODEL = process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash"

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

    let sourceContext = ""
    let localCitations: WorkCitation[] = []

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
Usa citas Markdown junto a las afirmaciones relevantes y termina con una síntesis accionable.
${scope === "sources" ? "Usa exclusivamente las fuentes del cuaderno entregadas. Si no alcanzan, indícalo." : "Combina las fuentes entregadas con búsqueda web actual y verificable."}
No inventes fuentes, autores, páginas ni URLs.`

    const prompt = sourceContext
      ? `${message}\n\nFUENTES DEL CUADERNO:\n${sourceContext}`
      : message

    if (scope === "sources") {
      if (!sourceContext) {
        return NextResponse.json({ error: "Este trabajo no tiene fuentes activas procesadas" }, { status: 422 })
      }
      const result = await callAIv5(
        [...history, { role: "user", content: prompt }],
        { task: "long_context", maxTokens: 3_500, systemPrompt },
      )
      return NextResponse.json({
        text: result.text,
        provider: result.provider,
        model: result.model,
        usedWeb: false,
        citations: dedupeCitations(localCitations),
      })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      const result = await callAIv5(
        [...history, { role: "user", content: prompt }],
        { task: "long_context", maxTokens: 3_500, systemPrompt: `${systemPrompt}\nLa búsqueda web no está disponible; dilo claramente.` },
      )
      return NextResponse.json({
        text: `${result.text}\n\n> La búsqueda web no estuvo disponible en esta respuesta.`,
        provider: result.provider,
        model: result.model,
        usedWeb: false,
        citations: dedupeCitations(localCitations),
      })
    }

    const contents = [
      ...history.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      })),
      { role: "user", parts: [{ text: prompt }] },
    ]

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(50_000),
      },
    )

    if (!response.ok) throw new Error(`Búsqueda web no disponible (${response.status})`)
    const data = await response.json()
    const candidate = data.candidates?.[0]
    const text = candidate?.content?.parts
      ?.filter((part: { text?: string }) => part.text)
      .map((part: { text: string }) => part.text)
      .join("")
      .trim()
    if (!text) throw new Error("La investigación no produjo una respuesta")

    const webCitations: WorkCitation[] = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .filter((chunk: { web?: { uri?: string } }) => chunk.web?.uri)
      .map((chunk: { web: { uri: string; title?: string } }, index: number) => ({
        sourceId: `web-${index}`,
        sourceTitle: chunk.web.title || chunk.web.uri,
        sourceUrl: chunk.web.uri,
        sourceType: "web",
      }))

    return NextResponse.json({
      text,
      provider: "Gemini + Google Search",
      model: GEMINI_MODEL,
      usedWeb: true,
      searchQueries: candidate?.groundingMetadata?.webSearchQueries ?? [],
      citations: dedupeCitations([...localCitations, ...webCitations]),
    })
  } catch (error) {
    console.error("[Open EDUAI Work research]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible completar la investigación" },
      { status: 500 },
    )
  }
}
