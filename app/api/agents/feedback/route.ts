import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, question, userAnswer, correctAnswer, explanation, isCorrect, currentLevel, streak } = await req.json()

  // AAD: lógica de ajuste de dificultad
  let newLevel = currentLevel
  let levelChange = ""

  if (isCorrect) {
    if (streak >= 2 && currentLevel < 6) {
      newLevel = currentLevel + 1
      levelChange = "⬆️ Subiste de nivel"
    }
  } else {
    if (currentLevel > 1) {
      newLevel = currentLevel - 1
      levelChange = "⬇️ Bajando dificultad"
    }
  }

  // XP ganado
  const xpGained = isCorrect ? (currentLevel * 10) : 0

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres un tutor educativo que da feedback motivador y preciso. 
Sé conciso (máximo 3 oraciones), claro y siempre positivo incluso en errores.
Responde en español.`
        },
        {
          role: "user",
          content: `Pregunta: "${question}"
Respuesta del estudiante: "${userAnswer}"
Respuesta correcta: "${correctAnswer}"
¿Correcto?: ${isCorrect ? "Sí" : "No"}
Explicación base: "${explanation}"

Genera un feedback breve y motivador en máximo 2 oraciones.
${isCorrect ? "Celebra el acierto y refuerza el concepto." : "Explica amablemente el error y da la clave para entenderlo."}`
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    })

    const feedbackText = completion.choices[0]?.message?.content || explanation

    return Response.json({
      isCorrect,
      feedback: feedbackText,
      newLevel,
      levelChange,
      xpGained,
    })

  } catch (e: any) {
    return Response.json({
      isCorrect,
      feedback: explanation,
      newLevel,
      levelChange: "",
      xpGained,
    })
  }
}
