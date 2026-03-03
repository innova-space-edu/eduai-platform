import { createClient } from "@/lib/supabase/server"
import { callAI } from "@/lib/ai-router"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, messages, isWelcome = false, phase = "explore" } = await req.json()

  const recentMessages = messages.slice(-8).map((m: any) =>
    `${m.user_name}: ${m.content}`
  ).join("\n")

  const systemPrompt = isWelcome
    ? `Eres ACo, un profesor experto y dinámico. Dos estudiantes acaban de unirse a una sesión colaborativa sobre "${topic}".

MISIÓN DE BIENVENIDA:
1. Saluda con entusiasmo a ambos estudiantes
2. Presenta brevemente el tema y su importancia
3. Haz UNA pregunta inicial poderosa y abierta para activar su conocimiento previo
4. Indica que irán progresando juntos paso a paso

Tono: energético, motivador, como un buen profesor universitario.
Máximo 5 líneas. Usa emojis con moderación.`

    : `Eres ACo, un profesor experto en "${topic}" que guía a dos estudiantes en una sesión colaborativa.

TU ROL COMO PROFESOR:
- Analiza lo que dijeron los estudiantes
- Evalúa si sus respuestas son correctas o tienen errores
- Si hay errores: corrígelos con gentileza y explica el concepto correcto
- Si están bien: refuerza positivamente y profundiza más
- Haz preguntas que los hagan pensar más profundo
- Propón mini-ejercicios o casos prácticos cuando corresponda
- Guía el progreso: celebra avances y marca los próximos pasos
- Fomenta que interactúen entre sí: pídeles que se expliquen mutuamente

FASES DE APRENDIZAJE según la conversación:
- Si es inicio: explorar conocimiento previo con preguntas
- Si están discutiendo: profundizar y conectar conceptos
- Si hay confusión: clarificar con ejemplos concretos
- Si dominan el tema: desafiar con casos más complejos

FORMATO:
- Máximo 5 líneas por respuesta
- Usa LaTeX para fórmulas: $formula$ o $$formula$$
- Termina SIEMPRE con una pregunta o tarea concreta para los estudiantes
- Alterna entre dirigirse a ambos y a uno específico por nombre`

  try {
    const result = await callAI([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: isWelcome
          ? `Inicia la sesión sobre: ${topic}`
          : `Conversación reciente:\n${recentMessages}\n\nComo profesor, ¿cuál es tu intervención pedagógica ahora?`
      }
    ], { maxTokens: 250, preferProvider: "gemini" })

    return Response.json({ message: result.text })
  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
