// app/api/agents/investigador/route.ts
// AGT-Investigador — Google Search grounding + EduAI AI Gateway fallback.

import { createClient } from "@/lib/supabase/server"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import { generationFingerprint } from "@/lib/ai/fingerprint"
import { runAIText } from "@/lib/ai/gateway"
import { generateGoogleGroundedText, hasGoogleAI } from "@/lib/ai/providers/google"
import { finishGenerationRequest, recordGenerationStart } from "@/lib/ai/reuse"

const SYSTEM_PROMPT = `Eres AGT-Investigador, un investigador académico experto con acceso a búsqueda web en tiempo real.

COMPORTAMIENTO:
- SIEMPRE usa la herramienta de búsqueda para obtener información actualizada y verificada cuando esté disponible.
- Distingue claramente entre hechos verificados con fuentes y análisis/inferencia.
- Estructura las respuestas con secciones claras usando ## para títulos.
- No inventes enlaces ni fuentes.
- Si la búsqueda no retorna resultados útiles, indícalo explícitamente.
- Usa **negrita** para conceptos clave.
- Responde siempre en español, salvo que el usuario pida otro idioma.
- Sé riguroso, preciso y equilibrado. No especules sin indicarlo.

FORMATO DE RESPUESTA:
## 🔍 Hallazgos principales
[Resumen]

## 📚 Análisis detallado
[Desarrollo]

## 💡 Conclusión
[Síntesis]`

type HistoryItem = { role: "user" | "assistant"; content: string }

function normalizeHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is HistoryItem => {
      if (!item || typeof item !== "object") return false
      const row = item as Partial<HistoryItem>
      return (row.role === "user" || row.role === "assistant") && typeof row.content === "string"
    })
    .slice(-8)
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const body = await req.json().catch(() => ({}))
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const history = normalizeHistory(body?.history)
  if (!message) return Response.json({ error: "Escribe qué deseas investigar." }, { status: 400 })

  try {
    await assertAICapabilityAllowed({
      supabase,
      userId: user.id,
      capability: "research",
      provider: "google",
    })
  } catch (error) {
    const typed = error as Error & { status?: number; code?: string }
    return Response.json(
      { error: typed.message, code: typed.code || "ACCESS_RESTRICTED" },
      { status: typed.status || 403 },
    )
  }

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history,
    { role: "user" as const, content: message },
  ]

  const fingerprint = generationFingerprint({
    capability: "research",
    scopeKey: user.id,
    payload: {
      message,
      history,
      freshnessBucket: new Date().toISOString().slice(0, 10),
      searchGrounding: true,
    },
  })

  const requestId = await recordGenerationStart({
    supabase,
    userId: user.id,
    capability: "research",
    fingerprint,
    module: "investigador",
    provider: "google",
    reusePolicy: "never",
    requestJson: { message, searchGrounding: true },
  })

  if (hasGoogleAI("text")) {
    try {
      const grounded = await generateGoogleGroundedText({
        messages,
        maxOutputTokens: 4096,
        temperature: 0.4,
      })

      const uniqueSources = Array.from(
        new Map(grounded.sources.map((source) => [source.uri, source])).values(),
      ).slice(0, 12)

      const sourcesBlock = uniqueSources.length
        ? `\n\n---\n## 🔗 Fuentes verificadas\n${uniqueSources.map((source) => `- [${source.title}](${source.uri})`).join("\n")}`
        : ""
      const badge = grounded.usedSearch
        ? "\n\n> 🔍 *Búsqueda web activa — respuesta respaldada con Google Search grounding.*"
        : "\n\n> 📚 *No se obtuvieron fuentes web útiles para esta consulta.*"
      const finalText = `${grounded.text}${badge}${sourcesBlock}`

      await finishGenerationRequest({
        supabase,
        requestId,
        status: "completed",
        provider: grounded.provider,
        model: grounded.model,
        latencyMs: Date.now() - startedAt,
        metadata: {
          usedSearch: grounded.usedSearch,
          sourceCount: uniqueSources.length,
          searchQueries: grounded.searchQueries,
        },
      })

      return Response.json({
        text: finalText,
        provider: grounded.provider,
        model: grounded.model,
        usedSearch: grounded.usedSearch,
        searchQueries: grounded.searchQueries,
        sources: uniqueSources,
        reused: false,
      })
    } catch (error) {
      console.warn("[Investigador] Google Search grounding falló, usando Gateway:", error)
    }
  }

  try {
    const fallback = await runAIText({
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nLa búsqueda web no está disponible. No afirmes que verificaste información en internet. Indica las limitaciones de actualidad cuando correspondan.`,
        },
        ...history,
        { role: "user", content: message },
      ],
      capability: "research",
      maxOutputTokens: 3000,
      context: {
        userId: user.id,
        module: "investigador-fallback",
        reusePolicy: "exact_private",
        visibility: "private",
      },
      supabase,
    })

    await finishGenerationRequest({
      supabase,
      requestId,
      status: "completed",
      provider: fallback.provider,
      model: fallback.model,
      latencyMs: Date.now() - startedAt,
      metadata: { usedSearch: false, fallback: true, reusedFallback: fallback.reused },
    })

    return Response.json({
      text: `${fallback.data}\n\n> 📚 *Respuesta sin búsqueda web activa.*`,
      provider: fallback.provider,
      model: fallback.model,
      usedSearch: false,
      searchQueries: [],
      sources: [],
      reused: fallback.reused,
      generationAvoided: fallback.reused,
    })
  } catch (error) {
    const typed = error as Error & { code?: string; status?: number }
    await finishGenerationRequest({
      supabase,
      requestId,
      status: "failed",
      error: typed.message,
      latencyMs: Date.now() - startedAt,
    })
    return Response.json(
      { error: typed.message || "No fue posible completar la investigación.", code: typed.code },
      { status: typed.status || 500 },
    )
  }
}