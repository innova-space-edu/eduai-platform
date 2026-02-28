import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { action, topic, level, numQuestions = 10, answers, questions } = await req.json()

  if (action === "generate") {
    // Generar examen completo
    const messages = [
      {
        role: "system" as const,
        content: `Eres un evaluador académico experto. Generas exámenes rigurosos y bien estructurados.
Responde SOLO con JSON válido, sin markdown ni texto adicional.`
      },
      {
        role: "user" as const,
        content: `Genera un examen de ${numQuestions} preguntas sobre: "${topic}"
Nivel de dificultad: ${level} (básico/intermedio/avanzado/universitario)

TIPOS DE PREGUNTAS (distribuir variedad):
- 40% opción múltiple (4 opciones, solo una correcta)
- 30% verdadero/falso con justificación
- 20% respuesta corta
- 10% problema/cálculo (si aplica al tema)

Para cada pregunta incluye:
- La pregunta clara y precisa
- Opciones si es múltiple
- Respuesta correcta
- Explicación breve de por qué es correcta
- Puntos (1-3 según dificultad)

JSON requerido:
{
  "title": "Examen de [tema]",
  "topic": "${topic}",
  "level": "${level}",
  "totalPoints": número,
  "timeMinutes": número sugerido,
  "questions": [
    {
      "id": 1,
      "type": "multiple|truefalse|short|problem",
      "question": "texto",
      "options": ["A)...", "B)...", "C)...", "D)..."] o null,
      "correctAnswer": "texto de la respuesta correcta",
      "explanation": "por qué es correcta",
      "points": 1-3,
      "difficulty": "easy|medium|hard"
    }
  ]
}`
      }
    ]
    try {
      const result = await callAI(messages, { maxTokens: 4000, preferProvider: "groq" })
      const clean = result.text.replace(/```json|```/g, "").trim()
      const exam = JSON.parse(clean)
      return Response.json(exam)
    } catch (e: any) {
      return new Response(e.message, { status: 500 })
    }
  }

  if (action === "evaluate") {
    // Evaluar respuestas del usuario
    const messages = [
      {
        role: "system" as const,
        content: `Eres un evaluador académico experto y justo. Evalúas respuestas con criterio pedagógico.
Responde SOLO con JSON válido.`
      },
      {
        role: "user" as const,
        content: `Evalúa estas respuestas de examen:

PREGUNTAS Y RESPUESTAS CORRECTAS:
${JSON.stringify(questions, null, 2)}

RESPUESTAS DEL ESTUDIANTE:
${JSON.stringify(answers, null, 2)}

Para cada pregunta:
- Determina si la respuesta es correcta, parcialmente correcta o incorrecta
- Asigna los puntos correspondientes
- Da feedback específico y constructivo

JSON requerido:
{
  "totalScore": número,
  "maxScore": número,
  "percentage": número,
  "grade": "Excelente|Muy bueno|Bueno|Suficiente|Insuficiente",
  "feedback": "retroalimentación general en 2-3 oraciones",
  "weakAreas": ["área 1", "área 2"],
  "strongAreas": ["área 1"],
  "results": [
    {
      "questionId": número,
      "correct": true/false/partial,
      "pointsEarned": número,
      "pointsMax": número,
      "feedback": "feedback específico"
    }
  ],
  "studyRecommendations": ["recomendación 1", "recomendación 2"]
}`
      }
    ]
    try {
      const result = await callAI(messages, { maxTokens: 3000, preferProvider: "groq" })
      const clean = result.text.replace(/```json|```/g, "").trim()
      const evaluation = JSON.parse(clean)
      return Response.json(evaluation)
    } catch (e: any) {
      return new Response(e.message, { status: 500 })
    }
  }

  return new Response("Invalid action", { status: 400 })
}
