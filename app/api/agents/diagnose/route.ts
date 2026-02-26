import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, quizResults } = await req.json()

  const wrongAnswers = quizResults.filter((r: any) => !r.isCorrect)

  if (wrongAnswers.length === 0) {
    return Response.json({
      hasGaps: false,
      message: "¡Excelente! No se detectaron lagunas de conocimiento.",
      gaps: [],
      recommendations: [],
    })
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres ADL, el Agente Diagnóstico de Lagunas. Analizas errores en evaluaciones para identificar conceptos que el estudiante no domina.
Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.`
        },
        {
          role: "user",
          content: `Tema general: "${topic}"

Preguntas que el estudiante respondió incorrectamente:
${wrongAnswers.map((r: any, i: number) => `
${i + 1}. Pregunta: ${r.question}
   Respondió: ${r.userAnswer}
   Correcta: ${r.correct}
`).join("")}

Analiza estos errores y devuelve este JSON:
{
  "hasGaps": true,
  "gaps": [
    {
      "concept": "nombre del concepto no dominado",
      "severity": "alta|media|baja",
      "explanation": "por qué el estudiante probablemente falló aquí (1 oración)",
      "emoji": "emoji relevante"
    }
  ],
  "recommendations": [
    "recomendación concreta de estudio 1",
    "recomendación concreta de estudio 2",
    "recomendación concreta de estudio 3"
  ],
  "summary": "resumen breve del diagnóstico (2 oraciones máximo)"
}`
        }
      ],
      temperature: 0.5,
      max_tokens: 600,
    })

    const text = completion.choices[0]?.message?.content || ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")

    const diagnosis = JSON.parse(jsonMatch[0])
    return Response.json(diagnosis)

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
