// app/api/notebooks/[id]/chat/route.ts  v3
// Mejoras:
// - Si los chunks recuperados tienen score bajo, usa el Investigador para enriquecer contexto
// - Streaming con fallback no-stream robusto

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGeminiStream, callAI } from "@/lib/ai-router-v4"
import { retrieveRelevantChunks, buildContextFromChunks } from "@/lib/notebook/retrieval"
import { buildNotebookSystemPrompt } from "@/lib/notebook/prompts"

export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

// ─── Enriquecer con Investigador cuando no hay suficientes fuentes ────────────
// Solo se llama si hay pocos chunks o todos tienen score bajo

async function enrichWithInvestigador(
  query: string,
  notebookTitle: string,
  specialistRole: string
): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return ""

    const GEMINI_MODEL = process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash"
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `Eres ${specialistRole} investigando sobre "${notebookTitle}". 
Responde de forma concisa y académica. Máximo 150 palabras.`
            }]
          },
          contents: [{ role: "user", parts: [{ text: query }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    )
    if (!res.ok) return ""
    const data   = await res.json()
    const parts  = data.candidates?.[0]?.content?.parts ?? []
    const text   = parts.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join("")
    return text ? `\n\n[Contexto web en tiempo real]\n${text}` : ""
  } catch {
    return ""
  }
}

// ─── POST — responder pregunta ────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: nb } = await supabase
      .from("notebooks").select("id, title, specialist_role").eq("id", id).eq("user_id", user.id).single()
    if (!nb) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const { message, history = [] } = body as {
      message: string
      history: Array<{ role: "user" | "assistant"; content: string }>
    }

    if (!message?.trim()) return NextResponse.json({ error: "message requerido" }, { status: 400 })

    // 1. Hybrid retrieval (vector + BM25 RRF)
    const chunks = await retrieveRelevantChunks({ notebookId: id, query: message, limit: 8 })

    // 2. Fuentes para contexto
    const { data: sources } = await supabase
      .from("notebook_sources").select("id, title").eq("notebook_id", id).eq("is_active", true)

    let contextText = chunks.length > 0
      ? buildContextFromChunks(chunks, sources ?? [])
      : ""

    // 3. Si no hay suficientes chunks (< 2) y hay Gemini, enriquecer con investigador
    const avgScore = chunks.reduce((sum, c) => sum + (c.score ?? 0), 0) / (chunks.length || 1)
    const needsWebEnrichment = chunks.length < 2 || avgScore < 0.3

    if (needsWebEnrichment) {
      const webContext = await enrichWithInvestigador(message, nb.title, nb.specialist_role)
      if (webContext) {
        contextText += webContext
      }
    }

    // 4. Construir prompt
    const systemPrompt = buildNotebookSystemPrompt(nb.specialist_role)
    const contextBlock = contextText
      ? `\n\n--- FUENTES ACTIVAS ---\n${contextText}\n--- FIN DE FUENTES ---`
      : "\n\n[No hay fuentes activas. Responde desde tu conocimiento como especialista, indicando claramente que no proviene de fuentes del cuaderno.]"

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt + contextBlock },
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ]

    // 5. Guardar mensaje usuario
    await supabase.from("notebook_messages").insert({
      notebook_id: id, role: "user", content: message, citations_json: [],
    })

    const citations = chunks.slice(0, 3).map((c) => ({
      sourceId:    c.source_id,
      sourceTitle: sources?.find((s) => s.id === c.source_id)?.title ?? "Fuente",
      chunkId:     c.id,
      snippet:     c.chunk_text.slice(0, 120),
    }))

    // 6. Streaming
    try {
      const stream = await callGeminiStream(messages, 2000)
      let fullResponse = ""

      const transformStream = new TransformStream({
        transform(chunk, controller) {
          const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
          fullResponse += text
          controller.enqueue(chunk)
        },
        flush: async () => {
          if (fullResponse.trim()) {
            await supabase.from("notebook_messages").insert({
              notebook_id: id, role: "assistant",
              content: fullResponse.trim(), citations_json: citations,
            })
          }
        },
      })

      return new Response(stream.pipeThrough(transformStream), {
        headers: {
          "Content-Type":  "text/plain; charset=utf-8",
          "X-Citations":   JSON.stringify(citations),
          "Cache-Control": "no-cache",
        },
      })
    } catch {
      // Fallback no-stream
      const response = await callAI(messages, { maxTokens: 2000 })
      await supabase.from("notebook_messages").insert({
        notebook_id: id, role: "assistant",
        content: response.text.trim(), citations_json: citations,
      })
      return NextResponse.json({ text: response.text, citations })
    }

  } catch (err) {
    console.error("[NotebookChat]", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// ─── GET — historial ──────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: nb } = await supabase
      .from("notebooks").select("id").eq("id", id).eq("user_id", user.id).single()
    if (!nb) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const { data } = await supabase
      .from("notebook_messages")
      .select("id, role, content, citations_json, created_at")
      .eq("notebook_id", id)
      .order("created_at", { ascending: true })
      .limit(100)

    return NextResponse.json({ messages: data ?? [] })
  } catch (err) {
    console.error("[NotebookChat GET]", err)
    return NextResponse.json({ messages: [] })
  }
}
