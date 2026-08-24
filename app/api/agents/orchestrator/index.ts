import type { SupabaseClient } from "@supabase/supabase-js"
import { runAIText } from "@/lib/ai/gateway"

interface AgentMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface OrchestratorResult {
  enrichedContext: string
  shouldEnrich: boolean
}

type OrchestratorRuntime = {
  supabase?: SupabaseClient | null
  userId?: string | null
}

// ── Detector de complejidad ──────────────────────────────
function isComplexQuery(message: string): boolean {
  const complexIndicators = [
    /por qué|cómo funciona|explica|diferencia entre|compara|analiza/i,
    /demostrar|probar|derivar|calcular|resolver/i,
    /relación entre|consecuencias|implicaciones|impacto/i,
    /historia de|origen de|evolución/i,
    /ventajas|desventajas|pros|contras/i,
  ]
  const wordCount = message.split(" ").length
  return wordCount > 8 || complexIndicators.some(r => r.test(message))
}

async function callOrchestratorAI(
  messages: AgentMessage[],
  maxOutputTokens: number,
  module: string,
  runtime: OrchestratorRuntime,
) {
  const result = await runAIText({
    messages,
    capability: "text",
    maxOutputTokens,
    context: runtime.userId
      ? {
          userId: runtime.userId,
          module,
          reusePolicy: "exact_private",
          visibility: "private",
        }
      : undefined,
    supabase: runtime.supabase || null,
  })
  return result.data
}

// ── Agente Investigador + Verificador ───────────────────
async function runInvestigator(topic: string, question: string, runtime: OrchestratorRuntime): Promise<string> {
  const messages: AgentMessage[] = [
    {
      role: "system",
      content: `Eres un investigador y verificador de hechos educativo.
Tu rol: buscar los hechos más relevantes y verificados sobre la pregunta del estudiante.
- Lista los 3-4 conceptos clave más importantes sobre este tema
- Señala errores comunes o malentendidos frecuentes
- Indica si hay debates académicos sobre el tema
- Máximo 120 palabras, muy conciso`,
    },
    { role: "user", content: `Tema: ${topic}\nPregunta: ${question}` },
  ]
  return callOrchestratorAI(messages, 260, "tutor-orchestrator-investigator", runtime)
}

// ── Agente Lógico + Matemático + Código ─────────────────
async function runLogician(topic: string, question: string, runtime: OrchestratorRuntime): Promise<string> {
  const messages: AgentMessage[] = [
    {
      role: "system",
      content: `Eres un agente de razonamiento lógico y matemático.
Tu rol: analizar la estructura lógica de la pregunta y detectar qué tipo de razonamiento requiere.
- Identifica si requiere razonamiento deductivo, inductivo, matemático o algorítmico
- Sugiere la mejor estructura para explicar paso a paso
- Si hay fórmulas relevantes, menciónalas en LaTeX
- Si hay código o algoritmos relevantes, menciónalos brevemente
- Máximo 120 palabras`,
    },
    { role: "user", content: `Tema: ${topic}\nPregunta: ${question}` },
  ]
  return callOrchestratorAI(messages, 260, "tutor-orchestrator-logician", runtime)
}

// ── Agente Creativo + Contrarian ────────────────────────
async function runCreative(
  topic: string,
  question: string,
  investigatorOutput: string,
  runtime: OrchestratorRuntime,
): Promise<string> {
  const messages: AgentMessage[] = [
    {
      role: "system",
      content: `Eres un agente creativo y pensamiento crítico.
Tu rol: mejorar la experiencia de aprendizaje y cuestionar el enfoque.
- Sugiere una analogía o metáfora poderosa para explicar el concepto
- Propone un ángulo original o sorprendente para presentar el tema
- Si el investigador cometió algún error o fue impreciso, corrígelo
- Sugiere cómo hacer la explicación más memorable para un estudiante
- Máximo 120 palabras`,
    },
    { role: "user", content: `Tema: ${topic}\nPregunta: ${question}\nAnálisis del investigador: ${investigatorOutput}` },
  ]
  return callOrchestratorAI(messages, 260, "tutor-orchestrator-creative", runtime)
}

// ── Capitán — Sintetizador ───────────────────────────────
async function runCaptain(
  topic: string,
  question: string,
  investigator: string,
  logician: string,
  creative: string,
  runtime: OrchestratorRuntime,
): Promise<string> {
  const messages: AgentMessage[] = [
    {
      role: "system",
      content: `Eres el Capitán del equipo de agentes educativos.
Has recibido análisis de 3 agentes especializados sobre una pregunta de un estudiante.
Tu trabajo: sintetizar sus aportaciones en un CONTEXTO ENRIQUECIDO que un tutor usará para responder.

REGLAS:
- Resuelve cualquier contradicción entre los agentes
- Combina lo mejor de cada análisis
- Genera un contexto de máximo 200 palabras que incluya:
  * Los conceptos clave verificados
  * La mejor estructura lógica para explicar
  * La analogía o metáfora más efectiva
  * Un punto sorprendente o memorable
- NO respondas la pregunta directamente — solo enriquece el contexto para el tutor`,
    },
    {
      role: "user",
      content: `Tema: ${topic}
Pregunta del estudiante: ${question}

INVESTIGADOR dice: ${investigator}
LÓGICO dice: ${logician}
CREATIVO dice: ${creative}

Sintetiza un contexto enriquecido para el tutor:`,
    },
  ]
  return callOrchestratorAI(messages, 420, "tutor-orchestrator-captain", runtime)
}

// ── Router principal del orquestador ────────────────────
export async function orchestrate(
  topic: string,
  question: string,
  runtime: OrchestratorRuntime = {},
): Promise<OrchestratorResult> {
  if (!isComplexQuery(question)) {
    return { enrichedContext: "", shouldEnrich: false }
  }

  try {
    // Los primeros agentes corren en paralelo. Cada etapa puede reutilizar su
    // resultado exacto de forma privada para evitar recomputar la misma duda.
    const [investigatorResult, logicianResult] = await Promise.all([
      runInvestigator(topic, question, runtime),
      runLogician(topic, question, runtime),
    ])

    const creativeResult = await runCreative(topic, question, investigatorResult, runtime)

    const enrichedContext = await runCaptain(
      topic,
      question,
      investigatorResult,
      logicianResult,
      creativeResult,
      runtime,
    )

    return { enrichedContext, shouldEnrich: true }
  } catch (e) {
    console.error("[Orchestrator] failed:", e)
    return { enrichedContext: "", shouldEnrich: false }
  }
}
