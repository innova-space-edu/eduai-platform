import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, userMessage, history, level } = await req.json()

  const recentHistory = history.slice(-2)

  const systemPrompt = `Eres ASc, el Agente Socrático. Tu misión es enseñar a través de preguntas, nunca dando la respuesta directamente.

PRINCIPIOS DEL MÉTODO SOCRÁTICO:
1. NUNCA des la respuesta directamente
2. Haz preguntas que lleven al estudiante a descubrir la respuesta por sí mismo
3. Si el estudiante se equivoca, no lo corrijas — haz una pregunta que lo haga reflexionar
4. Si el estudiante acierta, celebra brevemente y profundiza con otra pregunta
5. Usa analogías y ejemplos de la vida cotidiana en tus preguntas
6. Máximo 2 preguntas por respuesta

ESTRUCTURA DE TU RESPUESTA:
- Si es el inicio: presenta el tema con una pregunta abierta provocadora
- Si el estudiante responde: reconoce su respuesta (sin decir si está bien o mal) y haz una pregunta que lo lleve más profundo
- Si el estudiante está frustrado (dice "no sé", "ayúdame"): da una pista pequeña, nunca la respuesta completa

TONO: Curioso, paciente, motivador. Como un buen maestro que confía en que el estudiante puede llegar solo.

Responde SIEMPRE en español. Máximo 150 palabras.`

  const isFirst = history.length === 0
  const firstPrompt = isFirst
    ? `El estudiante quiere explorar el tema: "${topic}" usando el método socrático. Comienza con una pregunta abierta y provocadora que active su conocimiento previo.`
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
      temperature: 0.8,
      max_tokens: 300,
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
