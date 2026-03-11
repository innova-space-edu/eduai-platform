// src/app/api/agents/visual-detect/route.ts
// AGT-AIm v2 — Gemini 2.5 Flash-Lite + análisis contextual más profundo

import { createClient } from "@/lib/supabase/server"

// Temas con alta probabilidad de beneficiarse de un visual
const VISUAL_TOPICS = [
  "anatomía", "biología", "célula", "órgano", "cuerpo humano", "tejido",
  "geografía", "mapa", "continente", "país", "ciudad", "río", "montaña", "relieve",
  "física", "fuerza", "movimiento", "óptica", "circuito", "onda", "energía", "campo",
  "química", "molécula", "átomo", "reacción", "elemento", "tabla periódica", "enlace",
  "astronomía", "planeta", "estrella", "galaxia", "sistema solar", "universo", "órbita",
  "arquitectura", "construcción", "estructura", "edificio", "plano",
  "historia", "batalla", "guerra", "civilización", "artefacto", "mapa histórico",
  "matemáticas", "geometría", "función", "gráfico", "diagrama", "derivada", "integral",
  "animales", "especie", "ecosistema", "hábitat", "cadena alimentaria",
  "tecnología", "máquina", "motor", "dispositivo", "circuito eléctrico", "red",
  "estadística", "distribución", "porcentaje", "comparación", "datos", "tendencia",
  "proceso", "ciclo", "etapas", "flujo", "diagrama de flujo", "algoritmo",
  "evolución", "línea de tiempo", "cronología", "hitos",
]

function quickCheck(topic: string, context: string): boolean {
  const text = (topic + " " + context).toLowerCase()
  return VISUAL_TOPICS.some(kw => text.includes(kw))
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, context } = await req.json()

  // Quick check — evitar llamada a IA innecesaria
  if (!quickCheck(topic, context)) {
    return Response.json({ shouldGenerate: false })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return Response.json({ shouldGenerate: false })

  const systemPrompt = `You are AGT-AIm, the visual intelligence agent for EduAI.
Analyze educational content and decide what visual would most help understanding.

DECISION RULES:
- Generate image: physical concepts, organisms, historical events, places, objects
- Generate chart: numerical data, statistics, comparisons, trends, percentages
- Generate mermaid: processes, flows, cause-effect, algorithms, cycles
- Generate table: comparisons, properties, specifications, structured data
- Generate none: pure conversational, math without graphs, simple Q&A

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "shouldGenerate": true/false,
  "type": "image|chart|mermaid|table|none",
  "imagePrompt": "English prompt if type=image, else empty string",
  "mermaidCode": "flowchart code if type=mermaid, else empty string",
  "chartSpec": "JSON string of chart.js config if type=chart, else empty string",
  "caption": "Brief Spanish description of what the visual shows",
  "confidence": 0.0-1.0
}`

  const userPrompt = `Topic: "${topic}"
Educational content (first 800 chars):
"${context.substring(0, 800)}"

Analyze and decide what visual (if any) would most help a student understand this content:`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 600,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!res.ok) return Response.json({ shouldGenerate: false })

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) return Response.json({ shouldGenerate: false })

    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())

    // Solo generar si la confianza es alta
    if (!parsed.shouldGenerate || (parsed.confidence && parsed.confidence < 0.65)) {
      return Response.json({ shouldGenerate: false })
    }

    return Response.json({
      shouldGenerate: true,
      type: parsed.type || "image",
      imagePrompt: parsed.imagePrompt || "",
      mermaidCode: parsed.mermaidCode || "",
      chartSpec: parsed.chartSpec || "",
      caption: parsed.caption || "",
    })
  } catch (e: any) {
    console.warn("[AGT-AIm] Error:", e.message)
    return Response.json({ shouldGenerate: false })
  }
}
