import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, messages, quizResults } = await req.json()

  const score = quizResults?.length > 0
    ? Math.round((quizResults.filter((r: any) => r.isCorrect).length / quizResults.length) * 100)
    : null

  const conversationText = messages
    .filter((m: any) => m.role === "ai")
    .map((m: any) => m.content)
    .join("\n\n")
    .slice(0, 2000)

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres ARe, el Agente de Resumen. Generas resúmenes estructurados y claros de sesiones de estudio.
Responde en español con formato markdown limpio.`
        },
        {
          role: "user",
          content: `Genera un resumen completo de la sesión de estudio sobre: "${topic}"

Contenido de la sesión:
${conversationText}

${score !== null ? `Resultado del quiz: ${score}%
Preguntas incorrectas: ${quizResults?.filter((r: any) => !r.isCorrect).map((r: any) => r.question).join(", ") || "ninguna"}` : ""}

El resumen debe incluir:
1. **Conceptos clave** explicados brevemente
2. **Fórmulas o definiciones** importantes  
3. **Puntos a recordar** (máximo 5)
4. **Para profundizar** (2-3 recursos o temas relacionados)

Formato: markdown estructurado, máximo 400 palabras. Sé específico y útil.`
        }
      ],
      temperature: 0.5,
      max_tokens: 600,
    })

    const summary = completion.choices[0]?.message?.content || ""
    return new Response(JSON.stringify({ summary, topic, score }), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
