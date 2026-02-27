import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// GET — obtener memoria de un tema
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const topic = searchParams.get("topic")

  if (!topic) {
    // Obtener toda la memoria del usuario
    const { data } = await supabase
      .from("long_memory")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
    return NextResponse.json(data || [])
  }

  const { data } = await supabase
    .from("long_memory")
    .select("*")
    .eq("user_id", user.id)
    .eq("topic", topic)
    .single()

  return NextResponse.json(data || null)
}

// POST — actualizar memoria después de una sesión
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, messages, quizResults } = await req.json()

  // Obtener memoria existente
  const { data: existing } = await supabase
    .from("long_memory")
    .select("*")
    .eq("user_id", user.id)
    .eq("topic", topic)
    .single()

  // Analizar la sesión con IA
  const wrongConcepts = quizResults
    ?.filter((r: any) => !r.isCorrect)
    .map((r: any) => r.question)
    .slice(0, 3) || []

  const rightConcepts = quizResults
    ?.filter((r: any) => r.isCorrect)
    .map((r: any) => r.question)
    .slice(0, 3) || []

  const lastScore = quizResults?.length > 0
    ? Math.round((quizResults.filter((r: any) => r.isCorrect).length / quizResults.length) * 100)
    : existing?.last_score || 0

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres AML, el Agente de Memoria Larga. Analizas sesiones de estudio y extraes información clave sobre el conocimiento del estudiante.
Responde ÚNICAMENTE con JSON válido.`
        },
        {
          role: "user",
          content: `Tema: "${topic}"
${existing ? `Historial previo: El estudiante ya estudió este tema ${existing.study_count} veces. Puntuación anterior: ${existing.last_score}%` : "Primera vez estudiando este tema."}

Preguntas respondidas correctamente:
${rightConcepts.length > 0 ? rightConcepts.join("\n") : "Ninguna"}

Preguntas respondidas incorrectamente:
${wrongConcepts.length > 0 ? wrongConcepts.join("\n") : "Ninguna"}

Puntuación actual: ${lastScore}%

Devuelve este JSON:
{
  "key_concepts": ["concepto clave 1", "concepto clave 2", "concepto clave 3"],
  "strong_points": ["punto fuerte 1", "punto fuerte 2"],
  "weak_points": ["punto débil 1", "punto débil 2"],
  "summary": "resumen en 1 oración de lo que sabe el estudiante sobre este tema"
}`
        }
      ],
      temperature: 0.5,
      max_tokens: 300,
    })

    const text = completion.choices[0]?.message?.content || ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    // Guardar en base de datos
    const { data } = await supabase
      .from("long_memory")
      .upsert({
        user_id: user.id,
        topic,
        key_concepts: analysis.key_concepts || [],
        strong_points: analysis.strong_points || [],
        weak_points: analysis.weak_points || [],
        summary: analysis.summary || "",
        last_score: lastScore,
        study_count: (existing?.study_count || 0) + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,topic" })
      .select()
      .single()

    return NextResponse.json(data)

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
