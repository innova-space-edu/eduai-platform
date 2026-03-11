// app/api/agents/investigador/route.ts
// AGT-Investigador v2 — Gemini 2.5 Flash + Google Search Tool
// Busca en la web real antes de responder. Cita fuentes con URL y fecha.

import { createClient } from "@/lib/supabase/server"

const GEMINI_MODEL = process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash"

const SYSTEM_PROMPT = `Eres AGT-Investigador, un investigador académico experto con acceso a búsqueda web en tiempo real.

COMPORTAMIENTO:
- SIEMPRE usa la herramienta de búsqueda para obtener información actualizada y verificada
- Distingue claramente entre hechos verificados (con fuente) y tu conocimiento base
- Estructura las respuestas con secciones claras usando ## para títulos
- Cita fuentes con formato: [Nombre fuente](URL) — Fecha
- Si la búsqueda no retorna resultados útiles, indícalo y responde desde tu conocimiento base
- Usa **negrita** para conceptos clave
- Responde siempre en español, salvo que el usuario pida otro idioma
- Sé riguroso, preciso y equilibrado. No especules sin indicarlo.

FORMATO DE RESPUESTA:
## 🔍 Hallazgos principales
[Resumen de lo encontrado con búsqueda]

## 📚 Análisis detallado
[Desarrollo del tema con datos verificados]

## 🔗 Fuentes consultadas
[Lista de fuentes con URLs cuando estén disponibles]

## 💡 Conclusión
[Síntesis y reflexión final]`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { message, history = [] } = await req.json()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return new Response("GEMINI_API_KEY missing", { status: 500 })

  // Construir historial de conversación para Gemini
  const conversationHistory = history.map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  // Mensaje actual del usuario
  conversationHistory.push({
    role: "user",
    parts: [{ text: message }],
  })

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: conversationHistory,
    tools: [
      {
        google_search: {},
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
    },
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error("[Investigador] Gemini error:", errText)

      // Fallback: responder sin búsqueda si falla Google Search
      return fallbackResponse(message, history, apiKey)
    }

    const data = await res.json()
    const candidate = data.candidates?.[0]
    if (!candidate) return new Response("Sin respuesta del modelo", { status: 500 })

    // Extraer texto de la respuesta (puede venir en múltiples partes si usó search)
    const parts = candidate.content?.parts || []
    let text = parts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("")

    // Extraer grounding metadata (fuentes reales usadas)
    const groundingMeta = candidate.groundingMetadata
    let sourcesBlock = ""

    if (groundingMeta?.groundingChunks?.length) {
      const sources = groundingMeta.groundingChunks
        .filter((chunk: any) => chunk.web?.uri)
        .map((chunk: any) => {
          const title = chunk.web.title || chunk.web.uri
          const uri   = chunk.web.uri
          return `- [${title}](${uri})`
        })

      if (sources.length > 0) {
        sourcesBlock = `\n\n---\n**🌐 Fuentes verificadas por búsqueda web:**\n${sources.join("\n")}`
      }
    }

    // Indicar si se usó búsqueda web
    const usedSearch = !!groundingMeta?.webSearchQueries?.length
    const searchBadge = usedSearch
      ? `\n\n> 🔍 *Búsqueda web activa — información verificada en tiempo real*`
      : `\n\n> 📚 *Respuesta desde conocimiento base — sin búsqueda web activa*`

    const finalText = text + searchBadge + sourcesBlock

    return Response.json({
      text: finalText,
      provider: "Gemini",
      model: GEMINI_MODEL,
      usedSearch,
      searchQueries: groundingMeta?.webSearchQueries || [],
    })

  } catch (e: any) {
    console.error("[Investigador] Error:", e.message)
    return fallbackResponse(message, history, apiKey)
  }
}

// ── Fallback sin Google Search (si el tool falla o no está disponible) ─────────
async function fallbackResponse(
  message: string,
  history: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<Response> {
  const fallbackSystem = `Eres AGT-Investigador, un investigador académico experto.
Responde con rigor académico. Si no tienes información actualizada sobre algo, indícalo claramente.
Usa ## para títulos, **negrita** para conceptos clave. Responde en español.`

  const messages = [
    { role: "user" as const, parts: [{ text: fallbackSystem + "\n\n" + message }] },
    ...history.slice(-4).map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: message }] },
  ]

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: messages,
        generationConfig: { temperature: 0.5, maxOutputTokens: 3000 },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  )

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta disponible."

  return Response.json({
    text: text + "\n\n> 📚 *Respuesta desde conocimiento base — búsqueda web no disponible*",
    provider: "Gemini",
    model: GEMINI_MODEL,
    usedSearch: false,
    searchQueries: [],
  })
}
