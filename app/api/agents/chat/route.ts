import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, studyType, userMessage, history, level } = await req.json()

  const recentHistory = history.slice(-2)

  // Obtener memoria larga del tema
  const { data: memory } = await supabase
    .from("long_memory")
    .select("*")
    .eq("user_id", user.id)
    .eq("topic", topic)
    .single()

  const typeInstructions: Record<string, string> = {
    theory:    "Explica la teoría del concepto de forma clara y estructurada.",
    examples:  "Muestra ejemplos resueltos paso a paso, numerados y detallados.",
    exercises: "Propón un ejercicio y guía al estudiante para resolverlo.",
    summary:   "Da un resumen conciso con los puntos más importantes.",
  }

  const levelDesc: Record<number, string> = {
    1: "principiante absoluto",
    2: "con nociones básicas",
    3: "nivel intermedio",
    4: "nivel avanzado",
    5: "experto",
    6: "maestro",
  }

  // Contexto de memoria larga
  const memoryContext = memory ? `
HISTORIAL DEL ESTUDIANTE CON ESTE TEMA:
- Ha estudiado este tema ${memory.study_count} veces
- Puntuación más reciente: ${memory.last_score}%
- Lo que ya domina: ${memory.strong_points?.join(", ") || "en evaluación"}
- Sus puntos débiles: ${memory.weak_points?.join(", ") || "en evaluación"}
- Resumen de conocimiento: ${memory.summary || "primera sesión"}

Usa este contexto para personalizar tu explicación. Si tiene puntos débiles, enfócate en ellos. Si ya domina algo, no lo repitas.` : ""

  const systemPrompt = `Eres AGT, un tutor educativo experto y conversacional.

CONTEXTO:
- Tema: ${topic}
- Tipo de sesión: ${typeInstructions[studyType] || typeInstructions.theory}
- Nivel del estudiante: ${levelDesc[level] || levelDesc[1]}
${memoryContext}

REGLAS DE RESPUESTA:
- Responde SIEMPRE en español
- Máximo 250 palabras por respuesta
- Usa markdown: ## títulos, **negrita**, listas
- Para fórmulas usa LaTeX: $formula$ inline, $$formula$$ bloque
- Al final incluye SIEMPRE una pregunta breve para continuar
- Sé motivador y didáctico
- Si el estudiante ya estudió este tema antes, reconócelo y construye sobre ese conocimiento

FORMATO EXACTO:
[explicación en máximo 250 palabras]

[pregunta final]

---FOLLOWUPS---
["opción 1", "opción 2", "opción 3"]`

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...recentHistory.map((m: { role: string, content: string }) => ({
      role: m.role === "ai" ? "assistant" as const : "user" as const,
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ]

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 600,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ""
            if (text) controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      }
    })
  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
