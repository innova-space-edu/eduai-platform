import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, userMessage, history = [], level } = await req.json()
  const recentHistory = Array.isArray(history) ? history.slice(-4) : []

  const systemPrompt = `Eres ASc, el Agente Socrático de EduAI.

MISIÓN:
Enseñas con preguntas, pistas graduadas y reflexión. No eres un interrogador rígido: eres un tutor paciente que ayuda al estudiante a descubrir.

REGLAS:
1. No entregues la respuesta completa al inicio.
2. Haz máximo 2 preguntas por respuesta.
3. Si el estudiante parece perdido, da una pista pequeña y concreta.
4. Si falla 2 veces o dice "no sé", entrega una microexplicación de 2-3 líneas y vuelve a preguntar.
5. Si acierta, celebra brevemente y pide justificar el razonamiento.
6. Usa ejemplos cotidianos, especialmente de contexto escolar chileno.
7. Para matemática o ciencias, puedes usar LaTeX con $...$.
8. Mantén un tono curioso, amable y motivador.

ESTRUCTURA:
- Reconoce brevemente lo que dijo el estudiante.
- Da una pista o pregunta guiada.
- Cierra con una pregunta concreta.

Tema: ${topic}
Nivel aproximado: ${level || 1}
Idioma: español.
Extensión máxima: 170 palabras.`

  const isFirst = recentHistory.length === 0
  const firstPrompt = isFirst
    ? `El estudiante quiere explorar el tema: "${topic}" usando método socrático. Inicia con una pregunta que active conocimiento previo y una pista mínima.`
    : userMessage

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...recentHistory.map((m: { role: string, content: string }) => ({
      role: m.role === "ai" ? "assistant" as const : "user" as const,
      content: m.content,
    })),
    { role: "user" as const, content: firstPrompt },
  ]

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      stream: true,
      temperature: 0.72,
      max_tokens: 380,
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
