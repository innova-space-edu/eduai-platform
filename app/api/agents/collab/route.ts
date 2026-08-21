import { createClient } from "@/lib/supabase/server"
import { runAIText } from "@/lib/ai/gateway"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { topic, messages, isWelcome = false } = await req.json()

  const recentMessages = Array.isArray(messages)
    ? messages.slice(-8).map((m: { user_name?: string; content?: string }) =>
        `${String(m?.user_name || "Participante")}: ${String(m?.content || "")}`
      ).join("\n")
    : ""

  const systemPrompt = isWelcome
    ? `Eres ACo, un profesor experto y dinámico. Dos estudiantes acaban de unirse a una sesión colaborativa sobre "${topic}".

MISIÓN DE BIENVENIDA:
1. Saluda con entusiasmo a ambos estudiantes
2. Presenta brevemente el tema y su importancia
3. Haz UNA pregunta inicial poderosa y abierta para activar su conocimiento previo
4. Indica que irán progresando juntos paso a paso

Tono: energético, motivador, como un buen profesor universitario.
Máximo 5 líneas. Usa emojis con moderación.`
    : `Eres ACo, un profesor-moderador experto en "${topic}" en una sala de estudio colaborativa con VARIOS estudiantes.

TU MISIÓN:
1) Lee la conversación y detecta preguntas explícitas y dudas implícitas.
2) Elige LA DUDA PRINCIPAL del grupo y resuélvela con claridad.
3) Si hay errores conceptuales, corrígelos con tacto.
4) Conecta lo que dijeron entre sí cuando sea útil.
5) Termina SIEMPRE con una pregunta breve o mini-tarea para que el grupo continúe.

REGLAS:
- Máximo 7 líneas.
- Usa bullets cortos si ayuda.
- Usa LaTeX para fórmulas: $...$ o $$...$$
- No inventes datos; usa nombres solo si aparecen en los mensajes.`

  try {
    const result = await runAIText({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: isWelcome
            ? `Inicia la sesión sobre: ${topic}`
            : `Conversación reciente:\n${recentMessages}\n\nComo profesor, ¿cuál es tu intervención pedagógica ahora?`,
        },
      ],
      capability: "text",
      maxOutputTokens: 350,
      context: {
        userId: user.id,
        module: "collab",
        // El chat colaborativo puede contener intervenciones de terceros;
        // no lo persistimos en la cache de generaciones.
        reusePolicy: "never",
        visibility: "private",
      },
      supabase,
    })

    return Response.json({
      message: result.data,
      provider: result.provider,
      model: result.model,
    })
  } catch (error) {
    const typed = error as Error & { status?: number; code?: string }
    return Response.json(
      { error: typed.message || "Error", code: typed.code },
      { status: typed.status || 500 },
    )
  }
}