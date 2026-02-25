import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic } = await req.json()

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres un asistente educativo. Tu única tarea es sugerir 4 subtemas específicos para estudiar dado un tema general. 
Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, sin explicaciones.`
        },
        {
          role: "user",
          content: `Tema: "${topic}"

Devuelve exactamente este JSON con 4 subtemas específicos y concisos:
{
  "topic": "${topic}",
  "suggestions": [
    { "id": 1, "title": "subtema 1", "description": "una línea de qué cubre", "emoji": "emoji relevante" },
    { "id": 2, "title": "subtema 2", "description": "una línea de qué cubre", "emoji": "emoji relevante" },
    { "id": 3, "title": "subtema 3", "description": "una línea de qué cubre", "emoji": "emoji relevante" },
    { "id": 4, "title": "subtema 4", "description": "una línea de qué cubre", "emoji": "emoji relevante" }
  ]
}`
        }
      ],
      temperature: 0.7,
      max_tokens: 400,
    })

    const text = completion.choices[0]?.message?.content || ""
    
    // Extraer JSON limpio
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")
    
    const data = JSON.parse(jsonMatch[0])
    return Response.json(data)

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
