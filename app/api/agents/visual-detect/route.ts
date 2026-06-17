// app/api/agents/visual-detect/route.ts
// AGT-AIm v3 — detección visual pedagógica con especificación de aprendizaje

import { createClient } from "@/lib/supabase/server"

const VISUAL_TOPICS = [
  "anatomía", "biología", "célula", "órgano", "cuerpo humano", "tejido",
  "geografía", "mapa", "continente", "país", "ciudad", "río", "montaña", "relieve",
  "física", "fuerza", "movimiento", "óptica", "circuito", "onda", "energía", "campo",
  "química", "molécula", "átomo", "reacción", "elemento", "tabla periódica", "enlace", "orgánica", "carbono", "grupo funcional",
  "astronomía", "planeta", "estrella", "galaxia", "sistema solar", "universo", "órbita",
  "arquitectura", "construcción", "estructura", "edificio", "plano",
  "historia", "batalla", "guerra", "civilización", "artefacto", "mapa histórico", "línea de tiempo",
  "matemáticas", "geometría", "función", "gráfico", "diagrama", "derivada", "integral", "probabilidad", "estadística",
  "animales", "especie", "ecosistema", "hábitat", "cadena alimentaria",
  "tecnología", "máquina", "motor", "dispositivo", "circuito eléctrico", "red",
  "proceso", "ciclo", "etapas", "flujo", "diagrama de flujo", "algoritmo",
  "evolución", "cronología", "hitos",
]

function quickCheck(topic: string, context: string): boolean {
  const text = `${topic} ${context}`.toLowerCase()
  return VISUAL_TOPICS.some((keyword) => text.includes(keyword))
}

function safeJsonParse(text: string) {
  const clean = text.replace(/```json|```/g, "").trim()
  return JSON.parse(clean)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, context } = await req.json()
  const topicText = String(topic || "")
  const contextText = String(context || "")

  if (!quickCheck(topicText, contextText)) {
    return Response.json({ shouldGenerate: false })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return Response.json({ shouldGenerate: false })

  const systemPrompt = `You are AGT-AIm, the visual intelligence agent for EduAI.
Your task is to decide the most useful visual for an autonomous learning session.

PEDAGOGICAL PRIORITY:
- Choose the visual that reduces cognitive load and clarifies the concept.
- Prefer mermaid for processes, cycles, cause-effect and steps.
- Prefer chart for numerical data, comparison, probability, statistics and trends.
- Prefer table for classification, properties, examples vs non-examples.
- Prefer image for physical/scientific objects, molecules, anatomy, maps, historical scenes and concrete visual concepts.
- Return none for casual conversation or when a visual would distract.

IMAGE PROMPT RULES:
- Prompt must be in English.
- Use educational Canva-style, clean labels, soft colors, high contrast, no tiny text.
- Include age/level if inferable.
- For science, avoid scientifically incorrect decorations.
- For chemistry, choose molecular model, reaction diagram, or labeled infographic when useful.

Respond ONLY with valid JSON:
{
  "shouldGenerate": true,
  "type": "image|chart|mermaid|table|none",
  "learningGoal": "what the student should understand",
  "imagePrompt": "English prompt if type=image, else empty string",
  "mermaidCode": "flowchart code if type=mermaid, else empty string",
  "chartSpec": "JSON string for Chart.js or table {headers, rows}, else empty string",
  "caption": "Spanish caption explaining the visual",
  "confidence": 0.0
}`

  const userPrompt = `Topic: "${topicText}"
Educational content:
"${contextText.substring(0, 1400)}"

Select the best visual support for this learning moment.`

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
            temperature: 0.25,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(8000),
      },
    )

    if (!res.ok) return Response.json({ shouldGenerate: false })

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) return Response.json({ shouldGenerate: false })

    const parsed = safeJsonParse(text)
    if (!parsed.shouldGenerate || parsed.type === "none" || (parsed.confidence && parsed.confidence < 0.62)) {
      return Response.json({ shouldGenerate: false })
    }

    return Response.json({
      shouldGenerate: true,
      type: parsed.type || "image",
      learningGoal: parsed.learningGoal || "",
      imagePrompt: parsed.imagePrompt || "",
      mermaidCode: parsed.mermaidCode || "",
      chartSpec: parsed.chartSpec || "",
      caption: parsed.caption || parsed.learningGoal || "Visual educativo sugerido",
    })
  } catch (error: any) {
    console.warn("[AGT-AIm] Error:", error.message)
    return Response.json({ shouldGenerate: false })
  }
}
