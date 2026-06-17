import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"
import { orchestrate } from "@/app/api/agents/orchestrator/index"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, studyType, userMessage, history = [], level } = await req.json()
  const recentHistory = Array.isArray(history) ? history.slice(-4) : []

  const { data: memory } = await supabase
    .from("long_memory")
    .select("*")
    .eq("user_id", user.id)
    .eq("topic", topic)
    .single()

  const typeInstructions: Record<string, string> = {
    theory: `Modo Teoría: enseña con estructura de tutoría autónoma.
- Activa conocimiento previo con 1 pregunta breve.
- Explica la idea central en lenguaje simple.
- Agrega ejemplo cotidiano o escolar chileno.
- Incluye un error común y cómo evitarlo.
- Cierra con micropráctica o pregunta de comprobación.`,
    examples: `Modo Ejemplos: usa práctica guiada progresiva.
- Ejemplo 1: resuelto paso a paso.
- Ejemplo 2: explica el porqué de cada paso.
- Ejemplo 3: deja una parte para que el estudiante complete.
- Cierra preguntando qué paso quiere practicar.`,
    exercises: `Modo Ejercicios: no entregues todo resuelto de inmediato.
- Presenta 1 ejercicio principal.
- Da pista 1 antes de la solución.
- Si corresponde, muestra solución paso a paso.
- Agrega un ejercicio similar para intentar solo.
- Pregunta si quiere pista, corrección o más práctica.`,
    summary: `Modo Resumen: sintetiza para repasar rápido.
- 5 ideas clave.
- mini mapa mental textual.
- 3 tarjetas de memoria tipo pregunta/respuesta.
- 2 preguntas de repaso.
- siguiente paso recomendado.`,
  }

  const responseLengthByType: Record<string, string> = {
    theory: "Entre 380 y 520 palabras.",
    examples: "Entre 360 y 520 palabras.",
    exercises: "Entre 300 y 460 palabras.",
    summary: "Entre 220 y 340 palabras.",
  }

  const levelDesc: Record<number, string> = {
    1: "principiante absoluto",
    2: "con nociones básicas",
    3: "nivel intermedio",
    4: "nivel avanzado",
    5: "experto",
    6: "maestro",
  }

  const memoryContext = memory ? `
HISTORIAL DEL ESTUDIANTE CON ESTE TEMA:
- Ha estudiado este tema ${memory.study_count} veces
- Puntuación más reciente: ${memory.last_score}%
- Lo que ya domina: ${memory.strong_points?.join(", ") || "en evaluación"}
- Sus puntos débiles: ${memory.weak_points?.join(", ") || "en evaluación"}
- Resumen de conocimiento: ${memory.summary || "primera sesión"}

Usa este contexto como andamiaje. Si hay puntos débiles, enfócate en ellos. Si ya domina algo, avanza de nivel.` : ""

  let orchestratorContext = ""
  try {
    const orch = await orchestrate(topic, userMessage)
    if (orch.shouldEnrich) {
      orchestratorContext = `
CONTEXTO ENRIQUECIDO POR AGENTES ESPECIALIZADOS:
${orch.enrichedContext}

Úsalo para responder con mayor precisión y evitar explicaciones genéricas.`
    }
  } catch {}

  const systemPrompt = `Eres AGT, tutor educativo experto de EduAI.

CONTEXTO:
- Tema: ${topic}
- Tipo de sesión: ${typeInstructions[studyType] || typeInstructions.theory}
- Nivel del estudiante: ${levelDesc[level] || levelDesc[1]}
${memoryContext}
${orchestratorContext}

MODELO PEDAGÓGICO:
- Enseña con aprendizaje autónomo: planificar, comprender, practicar, monitorear y reflexionar.
- Usa andamiaje: primero pista o guía, luego explicación si hace falta.
- Conecta el contenido con ejemplos reales, cotidianos o escolares de Chile.
- Si el estudiante pregunta algo corto, responde corto; si pide profundidad, desarrolla más.
- En ciencias, matemáticas o procesos, sugiere una visualización útil: diagrama, tabla, gráfico o imagen.

REGLAS DE RESPUESTA:
- Responde SIEMPRE en español.
- ${responseLengthByType[studyType] || responseLengthByType.theory}
- Usa markdown con títulos breves y listas claras.
- Para fórmulas usa LaTeX: $formula$ inline, $$formula$$ bloque.
- Evita párrafos largos.
- Incluye una microactividad o pregunta final para continuar.
- No inventes datos curriculares específicos si no están en el contexto.

FORMATO EXACTO:
[respuesta didáctica]

**Para seguir:** [pregunta breve o acción]

---FOLLOWUPS---
["opción 1", "opción 2", "opción 3"]`

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...recentHistory.map((m: { role: string, content: string }) => ({
      role: m.role === "ai" ? "assistant" as const : "user" as const,
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ]

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      stream: true,
      temperature: studyType === "exercises" ? 0.55 : 0.65,
      max_tokens: studyType === "summary" ? 850 : 1300,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ""
            if (text) controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      }
    })
  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
