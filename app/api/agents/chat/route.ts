import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, studyType, userMessage, history, level } = await req.json()

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

  // Estrategia: solo los últimos 2 mensajes del historial
  const recentHistory = history.slice(-2)

  const systemPrompt = `Eres AGT, un tutor educativo experto y conversacional.

CONTEXTO:
- Tema: ${topic}
- Tipo de sesión: ${typeInstructions[studyType] || typeInstructions.theory}
- Nivel del estudiante: ${levelDesc[level] || levelDesc[1]}

REGLAS DE RESPUESTA:
- Responde SIEMPRE en español
- Máximo 250 palabras por respuesta
- Usa markdown para estructura: ## títulos, **negrita**, listas
- Para fórmulas matemáticas usa LaTeX: $formula$ para inline, $$formula$$ para bloque
- Para tablas usa markdown de tabla
- Al final incluye SIEMPRE una pregunta breve para continuar
- Sé motivador y didáctico

FORMATO EXACTO DE RESPUESTA:
[explicación en máximo 250 palabras]

[pregunta final]

---FOLLOWUPS---
["opción 1", "opción 2", "opción 3"]

Las opciones deben ser frases cortas (máximo 6 palabras).`

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
        } catch (e) {
          controller.error(e)
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
