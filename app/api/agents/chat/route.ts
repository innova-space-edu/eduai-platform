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
- Al final de tu respuesta incluye SIEMPRE una pregunta breve para verificar comprensión o invitar a profundizar
- Sé motivador y didáctico
- Si el estudiante escribe algo confuso, pídele que aclare

FORMATO DE RESPUESTA:
[tu explicación en máximo 250 palabras con LaTeX si aplica]

[pregunta final para continuar]

---FOLLOWUPS---
["opción corta 1", "opción corta 2", "opción corta 3"]

Las opciones de followup deben ser frases cortas (máximo 6 palabras) que el estudiante podría querer explorar a continuación.`

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m: { role: string, content: string }) => ({
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
