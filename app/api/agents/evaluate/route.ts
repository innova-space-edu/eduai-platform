import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, level = 1, questionNumber = 1 } = await req.json()

  const bloomLevels: Record<number, string> = {
    1: "recordar y reconocer conceptos básicos",
    2: "comprender y parafrasear ideas",
    3: "aplicar en problemas simples",
    4: "analizar y comparar casos",
    5: "evaluar y resolver problemas complejos",
    6: "crear y sintetizar conocimiento",
  }

  // Posición aleatoria para la respuesta correcta
  const letters = ["A", "B", "C", "D"]
  const correctPosition = letters[Math.floor(Math.random() * 4)]

  const systemPrompt = `Eres AEv, un agente evaluador educativo experto.
Tu única tarea es generar UNA pregunta de evaluación en formato JSON válido.
Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`

  const userPrompt = `Genera una pregunta de evaluación sobre: "${topic}"

Nivel de dificultad: ${level}/6 — enfocada en ${bloomLevels[level] || bloomLevels[1]}
Número de pregunta en la sesión: ${questionNumber}

IMPORTANTE: La respuesta correcta debe estar en la opción ${correctPosition}.

Devuelve exactamente este JSON:
{
  "question": "texto de la pregunta clara y concisa",
  "type": "multiple_choice",
  "options": ["A) opción", "B) opción", "C) opción", "D) opción"],
  "correct": "${correctPosition}",
  "explanation": "explicación breve de por qué es correcta (máximo 2 oraciones)",
  "bloom": "remember|understand|apply|analyze",
  "difficulty": ${level}
}

La respuesta correcta DEBE estar en la opción ${correctPosition}.
Las opciones incorrectas deben ser plausibles y tentadoras.
La pregunta debe ser específica sobre el tema, no genérica.`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 400,
    })

    const text = completion.choices[0]?.message?.content || ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")

    const question = JSON.parse(jsonMatch[0])
    return Response.json(question)

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
