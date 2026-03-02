import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, messages, isWelcome = false } = await req.json()

  const recentMessages = messages.slice(-6).map((m: any) =>
    `${m.user_name}: ${m.content}`
  ).join("\n")

  const systemPrompt = isWelcome
    ? `Eres ACo, asistente colaborativo de estudio. Dos estudiantes acaban de iniciar una sesión colaborativa sobre "${topic}".
Da una bienvenida breve y entusiasta, presenta el tema y sugiere 2-3 preguntas clave para empezar a discutir. Máximo 3 líneas.`
    : `Eres ACo, asistente colaborativo de estudio. Estás ayudando a dos estudiantes a estudiar "${topic}" juntos.
Analiza su conversación e intervén de forma útil: aclara dudas, corrige errores, propone ejemplos o desafía su comprensión.
Sé conciso (máximo 4 líneas), estimulante y usa LaTeX si hay matemáticas.`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt
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
