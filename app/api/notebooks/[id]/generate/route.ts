// app/api/notebooks/[id]/generate/route.ts  v2
// Mejoras:
// - Podcast: usa el agente podcast-wav del sistema para audio real
// - Infografía: llama a visual-detect para decidir si necesita imagen
// - Mapa mental: JSON compatible con React Flow

import { NextRequest, NextResponse } from "next/server"
import { createClient }   from "@/lib/supabase/server"
import { callAI }         from "@/lib/ai-router-v4"
import { getActiveChunks, buildContextFromChunks } from "@/lib/notebook/retrieval"
import {
  buildInfographicPrompt, buildMindmapPrompt, buildQuizPrompt,
  buildPodcastPrompt, buildFlashcardsPrompt, buildTimelinePrompt,
} from "@/lib/notebook/prompts"
import type { NotebookOutputFormat } from "@/lib/notebook/types"

export const maxDuration = 90

type Params = { params: Promise<{ id: string }> }

// ─── Detectar si el tema necesita imagen ─────────────────────────────────────

async function shouldGenerateImage(topic: string, summary: string): Promise<boolean> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return false

    const GEMINI_MODEL = process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash"
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: `¿El siguiente tema educativo se beneficia de una imagen visual?
Tema: "${topic}"
Resumen: "${summary.slice(0, 200)}"
Responde SOLO: true o false` }]
          }],
          generationConfig: { maxOutputTokens: 10, temperature: 0 },
        }),
        signal: AbortSignal.timeout(5_000),
      }
    )
    if (!res.ok) return false
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    return text.trim().toLowerCase().includes("true")
  } catch {
    return false
  }
}

// ─── Normalizar segmentos para podcast-wav ───────────────────────────────────

function normalizePodcastSegments(
  segments: Array<{ speaker: string; text: string; type?: string }>
): Array<{ speaker: "A" | "B"; text: string }> {
  return segments
    .filter((s) => s.text?.trim().length > 5)
    .map((s) => ({
      speaker: (s.speaker === "Álvaro" || s.speaker === "A") ? "A" : "B" as "A" | "B",
      text: s.text.trim(),
    }))
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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
    const { format, topicHint } = body as { format: NotebookOutputFormat; topicHint?: string }

    const VALID: NotebookOutputFormat[] = [
      "infographic","mindmap","quiz","podcast","flashcards","timeline",
      "presentation","cornell","glossary","story","lessonplan",
    ]
    if (!VALID.includes(format)) {
      return NextResponse.json({ error: `formato inválido: ${format}` }, { status: 400 })
    }

    // Resumen existente
    const { data: summaryRow } = await supabase
      .from("notebook_summaries").select("*").eq("notebook_id", id).single()

    const summary    = summaryRow?.summary_markdown ?? ""
    const keyPoints: string[] = Array.isArray(summaryRow?.key_points) ? summaryRow.key_points : []

    // Chunks activos (para formatos que necesitan detalle)
    let contextChunks = ""
    const needsDetail: NotebookOutputFormat[] = ["quiz","flashcards","timeline","podcast","cornell"]
    if (needsDetail.includes(format) || !summary) {
      const { data: sources } = await supabase
        .from("notebook_sources").select("id, title").eq("notebook_id", id).eq("is_active", true)
      const chunks = await getActiveChunks(id, 12_000)
      contextChunks = buildContextFromChunks(chunks, sources ?? [])
    }

    const contentBase = summary || contextChunks.slice(0, 4000)

    // ─── Construir prompt según formato ──────────────────────────────────────

    let prompt = ""
    switch (format) {
      case "infographic":
        prompt = buildInfographicPrompt({ summary: contentBase, keyPoints, specialistRole: nb.specialist_role, topicHint })
        break
      case "mindmap":
        prompt = buildMindmapPrompt({ summary: contentBase, keyPoints, specialistRole: nb.specialist_role })
        break
      case "quiz":
        prompt = buildQuizPrompt({ chunks: contextChunks || summary, specialistRole: nb.specialist_role })
        break
      case "podcast":
        prompt = buildPodcastPrompt({ summary: contentBase, keyPoints, specialistRole: nb.specialist_role })
        break
      case "flashcards":
        prompt = buildFlashcardsPrompt({ chunks: contextChunks || summary, specialistRole: nb.specialist_role })
        break
      case "timeline":
        prompt = buildTimelinePrompt({ chunks: contextChunks || summary, specialistRole: nb.specialist_role })
        break
      default:
        prompt = `Eres ${nb.specialist_role}. Basándote en este contenido, genera un ${format} educativo en JSON.
CONTENIDO: ${contentBase.slice(0, 5000)}
Responde SOLO en JSON bien estructurado.`
    }

    // ─── Llamar AI ────────────────────────────────────────────────────────────

    let outputJson: Record<string, unknown>
    try {
      const response = await callAI(
        [{ role: "user", content: prompt }],
        { maxTokens: 4000, preferProvider: "gemini" }
      )
      const raw = response.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      outputJson = JSON.parse(raw)
    } catch (err) {
      console.error("[Generate] AI/parse failed:", err)
      return NextResponse.json({ error: "Error generando contenido" }, { status: 500 })
    }

    // ─── Enriquecimientos por formato ─────────────────────────────────────────

    // PODCAST: normalizar segmentos para podcast-wav
    if (format === "podcast") {
      const rawSegs = (outputJson.segments as Array<{ speaker: string; text: string; type?: string }>) ?? []
      const normalizedSegments = normalizePodcastSegments(rawSegs)
      outputJson._podcastWavSegments = normalizedSegments
      // Instrucción para el frontend de cómo obtener el audio
      outputJson._audioEndpoint = "/api/agents/podcast-wav"
    }

    // INFOGRAFÍA: verificar si el tema necesita imagen
    if (format === "infographic") {
      const topic = (outputJson.title as string) ?? nb.title
      const needsImg = await shouldGenerateImage(topic, summary)
      if (needsImg) {
        // Agregar prompt de imagen sugerido para que el Studio lo ofrezca
        outputJson._imagePrompt = `Imagen educativa ilustrativa sobre: ${topic}. Estilo infográfico profesional, sin texto.`
        outputJson._hasImageSuggestion = true
      }
    }

    // ─── Guardar output ────────────────────────────────────────────────────────

    const { data: saved } = await supabase
      .from("notebook_outputs")
      .insert({
        notebook_id: id, format,
        title: (outputJson.title as string) ?? nb.title,
        output_json: outputJson, version: 1,
      })
      .select().single()

    return NextResponse.json({
      ok: true, output: outputJson, savedId: saved?.id ?? null, format,
    })

  } catch (err) {
    console.error("[Generate] Unhandled:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
