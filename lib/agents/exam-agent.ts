// lib/agents/exam-agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// ExamAgent — agente especializado en generación y gestión de evaluaciones.
// Usa el endpoint /api/agents/exam-generate (que ya existe y funciona) +
// ai-router-v5 para generación contextual desde el chat del superagente.
// NO reemplaza exam-generate/route.ts — lo orquesta.
// ─────────────────────────────────────────────────────────────────────────────

import { callAIv5 } from "@/lib/ai-router-v5"
import type { Message } from "@/lib/ai-router-v5"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ExamQuestion {
  id?:           string
  type:          "multiple_choice" | "true_false" | "development"
  question:      string
  options?:      string[]
  correctAnswer?: number
  explanation?:  string
  modelAnswer?:  string
  rubric?:       { criteria: string; points: number }[]
  maxPoints?:    number
  imageUrl?:     string
}

export interface ExamGenerateParams {
  topic:     string
  subject?:  string
  level?:    string
  count?:    number
  mcCount?:  number
  tfCount?:  number
  devCount?: number
  difficulty?: "básico" | "intermedio" | "avanzado"
  pieMode?:  boolean
  // Accesibilidad
  dyslexiaMode?:  boolean
  adhdMode?:      boolean
  lowVisionMode?: boolean
}

export interface ExamAgentResult {
  success:   boolean
  questions: ExamQuestion[]
  title?:    string
  provider?: string
  error?:    string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildExamPrompt(p: ExamGenerateParams): string {
  const mc  = p.mcCount  ?? Math.max(0, (p.count ?? 5) - (p.tfCount ?? 0) - (p.devCount ?? 0))
  const tf  = p.tfCount  ?? 0
  const dev = p.devCount ?? 0
  const total = mc + tf + dev || p.count || 5

  const pieContext = p.pieMode
    ? `\nIMPORTANTE — Modo PIE activo:${p.dyslexiaMode ? " dislexia (frases cortas, vocabulario simple)" : ""}${p.adhdMode ? " TDAH (instrucciones directas, sin exceso de texto)" : ""}${p.lowVisionMode ? " baja visión (texto claro, sin ambigüedades)" : ""}. Adapta la redacción de cada pregunta.`
    : ""

  return `Genera un examen escolar en español con EXACTAMENTE ${total} preguntas sobre: "${p.topic}".
${p.subject   ? `Asignatura: ${p.subject}.`   : ""}
${p.level     ? `Nivel: ${p.level}.`           : ""}
${p.difficulty? `Dificultad: ${p.difficulty}.` : ""}${pieContext}

Distribución OBLIGATORIA:
- ${mc} preguntas de alternativas (multiple_choice, 4 opciones, correctAnswer = índice 0-3)
- ${tf} preguntas de verdadero/falso (true_false, incluye justificación)
- ${dev} preguntas de desarrollo (development, incluye modelAnswer y rubric)

Devuelve SOLO JSON válido:
{"title":"...","questions":[{"type":"...","question":"...","options":[...],"correctAnswer":0,"explanation":"..."}]}`
}

// ── Parseo seguro ─────────────────────────────────────────────────────────────

function parseQuestionsFromText(text: string): ExamQuestion[] {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return []
    const data = JSON.parse(match[0])
    const raw  = data.questions ?? data.items ?? []
    if (!Array.isArray(raw)) return []

    return raw.map((q: Record<string, unknown>, idx: number) => ({
      id:            `q-${Date.now()}-${idx}`,
      type:          (["multiple_choice","true_false","development"].includes(String(q.type))
                      ? q.type : "multiple_choice") as ExamQuestion["type"],
      question:      String(q.question ?? q.statement ?? ""),
      options:       Array.isArray(q.options) ? q.options.map(String) : undefined,
      correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
      explanation:   String(q.explanation ?? ""),
      modelAnswer:   String(q.modelAnswer ?? ""),
      rubric:        Array.isArray(q.rubric)
                       ? q.rubric.map((r: Record<string, unknown>) => ({
                           criteria: String(r.criteria ?? "Criterio"),
                           points:   Number(r.points ?? 1),
                         }))
                       : [],
      maxPoints:     Number(q.maxPoints ?? 1),
      imageUrl:      "",
    }))
  } catch {
    return []
  }
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * generateExam — genera preguntas usando ai-router-v5 con task "general".
 * Usa el mismo prompt que exam-generate/route.ts pero sin ir por HTTP interno.
 */
export async function generateExam(
  params: ExamGenerateParams
): Promise<ExamAgentResult> {
  const prompt = buildExamPrompt(params)

  const messages: Message[] = [
    {
      role: "system",
      content: `Eres experto en evaluaciones escolares en español.
Devuelve SOLO JSON válido, sin markdown, sin texto fuera del JSON.
Formato: {"title":"...","questions":[...]}.
Tipos permitidos: multiple_choice, true_false, development.
Alternativas: 4 options, correctAnswer = índice 0-3. La explicación DEBE coincidir con la opción correcta.
V/F: options ["Verdadero","Falso"], correctAnswer 0 o 1.
Desarrollo: incluye modelAnswer y rubric [{criteria, points}].
Matemática: usa LaTeX dentro de $...$ o $$...$$.`,
    },
    { role: "user", content: prompt },
  ]

  try {
    const result = await callAIv5(messages, {
      task:      "general",
      maxTokens: 3500,
    })

    const questions = parseQuestionsFromText(result.text)

    if (questions.length === 0) {
      return {
        success:   false,
        questions: [],
        provider:  result.provider,
        error:     "La IA no devolvió preguntas válidas. Intenta con un tema más específico.",
      }
    }

    // Extraer título del JSON
    let title = `Evaluación: ${params.topic}`
    try {
      const m = result.text.match(/"title"\s*:\s*"([^"]+)"/)
      if (m?.[1]) title = m[1]
    } catch { /* sin título */ }

    return { success: true, questions, title, provider: result.provider }
  } catch (err) {
    return {
      success:   false,
      questions: [],
      error:     err instanceof Error ? err.message : "Error desconocido en ExamAgent.",
    }
  }
}

/**
 * improveQuestion — mejora una pregunta existente con IA.
 * Útil para el editor de exámenes.
 */
export async function improveQuestion(
  question: ExamQuestion,
  instruction: string
): Promise<{ success: boolean; question?: ExamQuestion; error?: string }> {
  const messages: Message[] = [
    {
      role: "system",
      content: "Eres experto en evaluaciones escolares. Devuelve SOLO el JSON de una pregunta mejorada, sin texto adicional.",
    },
    {
      role: "user",
      content: `Mejora esta pregunta de examen según la instrucción dada.

PREGUNTA ORIGINAL:
${JSON.stringify(question, null, 2)}

INSTRUCCIÓN: ${instruction}

Devuelve SOLO el JSON de la pregunta mejorada con la misma estructura.`,
    },
  ]

  try {
    const result  = await callAIv5(messages, { task: "general", maxTokens: 1000 })
    const [improved] = parseQuestionsFromText(`{"questions":[${result.text.match(/\{[\s\S]*\}/)?.[0] ?? "{}"}]}`)

    if (!improved?.question) {
      return { success: false, error: "No se pudo parsear la pregunta mejorada." }
    }

    return { success: true, question: { ...question, ...improved } }
  } catch (err) {
    return {
      success: false,
      error:   err instanceof Error ? err.message : "Error al mejorar la pregunta.",
    }
  }
}

/**
 * suggestExamTitle — sugiere un título formal para el examen.
 */
export async function suggestExamTitle(
  topic:    string,
  subject?: string,
  level?:   string
): Promise<string> {
  try {
    const messages: Message[] = [{
      role: "user",
      content: `Sugiere un título formal y conciso para un examen sobre "${topic}"${subject ? ` de ${subject}` : ""}${level ? ` (${level})` : ""}. Solo el título, sin comillas ni puntuación final.`,
    }]
    const result = await callAIv5(messages, { task: "fast", maxTokens: 60 })
    return result.text.trim().replace(/^["']|["']$/g, "")
  } catch {
    return `Evaluación: ${topic}`
  }
}
