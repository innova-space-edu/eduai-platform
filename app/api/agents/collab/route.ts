import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, messages } = await req.json()

  const recentMessages = messages.slice(-6).map((m: any) =>
    `${m.user_name}: ${m.content}`
  ).join("\n")

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres ACo, el Agente Colaborativo. Moderas sesiones de estudio entre dos estudiantes sobre el tema "${topic}".

TU ROL:
- Observas la conversación y participas cuando puedes aportar valor
- Haces preguntas que involucren a AMBOS estudiantes
- Propones desafíos o debates entre ellos
- Corriges errores conceptuales con tacto
- Celebras cuando llegan a respuestas correctas juntos
- Sugiere que se hagan preguntas mutuamente

TONO: Animado, como un tutor que guía sin protagonizar.
Responde en español. Máximo 100 palabras.
Firma siempre como "🤖 ACo"`
        },
        {
          role: "user",
          content: `Conversación reciente:\n${recentMessages}\n\n¿Qué aporte puedes hacer ahora para enriquecer el aprendizaje colaborativo?`
        }
      ],
      temperature: 0.8,
      max_tokens: 200,
    })

    const response = completion.choices[0]?.message?.content || ""
    return Response.json({ message: response })
  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
