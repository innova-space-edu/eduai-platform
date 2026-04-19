// app/api/notebooks/[id]/chat/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGeminiStream } from "@/lib/ai-router-v4"
import { retrieveRelevantChunks, buildContextFromChunks } from "@/lib/notebook/retrieval"
import { buildNotebookSystemPrompt } from "@/lib/notebook/prompts"

export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data: nb } = await supabase
    .from("notebooks")
    .select("id, specialist_role")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  if (!nb) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const { message, history = [] } = body as {
    message: string
    history: Array<{ role: "user" | "assistant"; content: string }>
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: "message requerido" }, { status: 400 })
  }

  // 1. Recuperar chunks relevantes
  const chunks = await retrieveRelevantChunks({
    notebookId: id,
    query: message,
    limit: 6,
  })

  // 2. Obtener títulos de fuentes para contexto
  const { data: sources } = await supabase
    .from("notebook_sources")
    .select("id, title")
    .eq("notebook_id", id)
    .eq("is_active", true)

  const contextText = chunks.length > 0
    ? buildContextFromChunks(chunks, sources ?? [])
    : ""

  // 3. Construir prompt con contexto
  const systemPrompt = buildNotebookSystemPrompt(nb.specialist_role)

  const contextBlock = contextText
    ? `\n\n--- FUENTES ACTIVAS ---\n${contextText}\n--- FIN DE FUENTES ---`
    : "\n\n[No hay fuentes activas o relevantes para esta pregunta. Indica al usuario que agregue fuentes.]"

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt + contextBlock },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ]

  // 4. Guardar mensaje del usuario
  await supabase.from("notebook_messages").insert({
    notebook_id: id,
    role: "user",
    content: message,
    citations_json: [],
  })

  // 5. Stream de respuesta
  try {
    const stream = await callGeminiStream(messages, 2000)

    // Collect full text to save after stream
    let fullResponse = ""
    const citations = chunks.slice(0, 3).map((c) => ({
      sourceId:    c.source_id,
      sourceTitle: sources?.find((s) => s.id === c.source_id)?.title ?? "Fuente",
      chunkId:     c.id,
      snippet:     c.chunk_text.slice(0, 120),
    }))

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
        fullResponse += text
        controller.enqueue(chunk)
      },
      flush: async () => {
        // Guardar respuesta del asistente
        if (fullResponse.trim()) {
          await supabase.from("notebook_messages").insert({
            notebook_id:   id,
            role:          "assistant",
            content:       fullResponse.trim(),
            citations_json: citations,
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
    const { callAI } = await import("@/lib/ai-router-v4")
    const response = await callAI(messages, { maxTokens: 2000 })
    const fullText = response.text

    const citations = chunks.slice(0, 3).map((c) => ({
      sourceId:    c.source_id,
      sourceTitle: sources?.find((s) => s.id === c.source_id)?.title ?? "Fuente",
      chunkId:     c.id,
      snippet:     c.chunk_text.slice(0, 120),
    }))

    await supabase.from("notebook_messages").insert({
      notebook_id:   id,
      role:          "assistant",
      content:       fullText.trim(),
      citations_json: citations,
    })

    return NextResponse.json({
      text: fullText,
      citations,
    })
  }
}

// GET — historial de mensajes
export async function GET(_req: NextRequest, { params }: Params) {
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
}
