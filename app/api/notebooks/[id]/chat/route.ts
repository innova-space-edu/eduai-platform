import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callAI, callGeminiStream } from "@/lib/ai-router-v4"
import { getActiveChunks, retrieveRelevantChunks } from "@/lib/notebook/retrieval"
import { buildNotebookSystemPrompt } from "@/lib/notebook/prompts"
import type { NotebookChunk } from "@/lib/notebook/types"

export const runtime = "nodejs"
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

type SourceRow = {
  id: string
  title: string | null
  url: string | null
  type: string | null
  status: string | null
}

type Citation = {
  sourceId: string
  sourceTitle: string
  sourceUrl: string | null
  sourceType: string | null
  chunkId: string
  snippet: string
}

function normalizeHistory(value: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is { role: "user" | "assistant"; content: string } => {
      if (!item || typeof item !== "object") return false
      const row = item as Record<string, unknown>
      return (row.role === "user" || row.role === "assistant") && typeof row.content === "string"
    })
    .slice(-8)
}

function buildGroundedContext(chunks: NotebookChunk[], sources: SourceRow[]): string {
  const sourceMap = new Map(sources.map((source) => [source.id, source]))
  return chunks.map((chunk, index) => {
    const source = sourceMap.get(chunk.source_id)
    const title = source?.title || source?.url || `Fuente ${index + 1}`
    return `[FRAGMENTO ${index + 1} · ${title}]\n${chunk.chunk_text}`
  }).join("\n\n---\n\n")
}

function buildCitations(chunks: NotebookChunk[], sources: SourceRow[]): Citation[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source]))
  const seen = new Set<string>()
  const citations: Citation[] = []

  for (const chunk of chunks) {
    const key = `${chunk.source_id}:${chunk.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const source = sourceMap.get(chunk.source_id)
    citations.push({
      sourceId: chunk.source_id,
      sourceTitle: source?.title || source?.url || "Fuente",
      sourceUrl: source?.url || null,
      sourceType: source?.type || null,
      chunkId: chunk.id,
      snippet: chunk.chunk_text.replace(/\s+/g, " ").trim().slice(0, 240),
    })
    if (citations.length >= 6) break
  }

  return citations
}

async function saveMessage(
  notebookId: string,
  role: "user" | "assistant",
  content: string,
  citations: Citation[] = [],
) {
  const supabase = await createClient()
  await supabase.from("notebook_messages").insert({
    notebook_id: notebookId,
    role,
    content,
    citations_json: citations,
  })
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: notebook } = await supabase
      .from("notebooks")
      .select("id, title, specialist_role")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (!notebook) return NextResponse.json({ error: "Cuaderno no encontrado" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const message = String(body?.message || "").trim()
    const history = normalizeHistory(body?.history)
    if (!message) return NextResponse.json({ error: "Escribe una pregunta" }, { status: 400 })

    const { data: sourceData } = await supabase
      .from("notebook_sources")
      .select("id, title, url, type, status")
      .eq("notebook_id", id)
      .eq("is_active", true)
      .eq("status", "ready")
    const sources = (sourceData || []) as SourceRow[]
    if (!sources.length) {
      return NextResponse.json(
        { error: "No hay fuentes activas y procesadas. Agrega o activa una fuente para conversar." },
        { status: 422 },
      )
    }

    let chunks = await retrieveRelevantChunks({ notebookId: id, query: message, limit: 10 })
    if (!chunks.length) chunks = await getActiveChunks(id, 10_000)
    chunks = chunks.slice(0, 12)

    await saveMessage(id, "user", message)

    if (!chunks.length) {
      const text = "No encontré fragmentos suficientes en las fuentes activas para responder con seguridad. Reprocesa las fuentes o formula la pregunta con términos más específicos."
      await saveMessage(id, "assistant", text)
      return NextResponse.json({ text, citations: [] })
    }

    const citations = buildCitations(chunks, sources)
    const context = buildGroundedContext(chunks, sources)
    const systemPrompt = `${buildNotebookSystemPrompt(notebook.specialist_role)}

REGLAS OBLIGATORIAS DEL CUADERNO:
- Usa exclusivamente los FRAGMENTOS proporcionados abajo. No uses búsqueda web ni conocimiento externo.
- Distingue claramente entre hechos, interpretación e incertidumbre.
- Cuando una afirmación importante provenga de un fragmento, menciona el nombre de la fuente entre corchetes.
- Si las fuentes discrepan, presenta ambas posiciones sin forzar una conclusión.
- Si la evidencia es insuficiente, responde: "Eso no está cubierto suficientemente por las fuentes activas".
- No inventes autores, fechas, cifras, citas textuales ni resultados.

FUENTES ACTIVAS DEL CUADERNO:
${context}`

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ]

    const citationsHeader = Buffer.from(JSON.stringify(citations), "utf8").toString("base64")

    try {
      const stream = await callGeminiStream(messages, 2_200)
      let fullResponse = ""
      const transform = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk)
          fullResponse += text
          controller.enqueue(chunk)
        },
        async flush() {
          if (fullResponse.trim()) await saveMessage(id, "assistant", fullResponse.trim(), citations)
        },
      })

      return new Response(stream.pipeThrough(transform), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Citations-B64": citationsHeader,
          "Cache-Control": "no-cache, no-store",
        },
      })
    } catch (streamError) {
      console.warn("[Notebook chat] streaming fallback:", streamError)
      const response = await callAI(messages, { maxTokens: 2_200, preferProvider: "gemini" })
      const text = response.text.trim()
      await saveMessage(id, "assistant", text, citations)
      return NextResponse.json({ text, citations })
    }
  } catch (error) {
    console.error("[Notebook chat POST]", error)
    return NextResponse.json({ error: "Error interno del chat" }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: notebook } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (!notebook) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const { data } = await supabase
      .from("notebook_messages")
      .select("id, role, content, citations_json, created_at")
      .eq("notebook_id", id)
      .order("created_at", { ascending: true })
      .limit(120)

    return NextResponse.json({ messages: data || [] })
  } catch (error) {
    console.error("[Notebook chat GET]", error)
    return NextResponse.json({ messages: [] })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: notebook } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (!notebook) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const { error } = await supabase.from("notebook_messages").delete().eq("notebook_id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Notebook chat DELETE]", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
