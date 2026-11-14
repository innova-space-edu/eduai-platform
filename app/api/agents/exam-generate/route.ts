import { EXAM_AI_MAX_QUESTIONS } from "@/lib/exam/creator-limits"
import { planExamBatches, normalizeStem, examContractIssues, extractExamQuestions, canonicalExamQuestion, constructedContractIssues } from "@/lib/exam/generation-contract.mjs"
import { PEDAGOGICAL_MODES } from "@/lib/exam/subject-pedagogy"
import { parseExamModelJson } from "@/lib/exam/import-model-json.mjs"
import { compatibleFallbackModel, generateCompatibleText, hasCompatibleProvider } from "@/lib/ai/providers/openai-compatible"
import { openRouterTextProviderOptions, resolveOpenRouterTextModel } from "@/lib/ai/free-routing"
import { resolveGroqTextModel, GROQ_FAST_MODEL, GROQ_REASONING_MODEL } from "@/lib/ai/groq-models"
// app/api/agents/exam-generate/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildDesignPromptDirective, getDesignTemplateSummary } from "@/lib/design-templates/registry"
import { buildAnswerKey, enrichQuestionAnswerKey, findBlockingQualityIssues } from "@/lib/exam/question-quality"

export const runtime = "nodejs"
export const maxDuration = 120

const GROQ_MODELS = Array.from(new Set([resolveGroqTextModel(), GROQ_FAST_MODEL, GROQ_REASONING_MODEL]))

const GROQ_MAX_TOKENS = 3200

const FAKE_BACKSLASH_RE = /[\u2191\u2197\u2B06\u25B2\u2227\u21D2\u2044\u2216\u29F5]/g

const LATEX_COMMANDS = [
  "frac",
  "sqrt",
  "sum",
  "int",
  "prod",
  "lim",
  "infty",
  "partial",
  "times",
  "cdot",
  "div",
  "pm",
  "leq",
  "geq",
  "neq",
  "approx",
  "equiv",
  "pi",
  "alpha",
  "beta",
  "gamma",
  "theta",
  "lambda",
  "sigma",
  "omega",
  "Delta",
  "Sigma",
  "bar",
  "overline",
  "left",
  "right",
  "text",
  "mathbf",
  "mathrm",
  "mathit",
  "vec",
  "hat",
  "sin",
  "cos",
  "tan",
  "log",
  "ln",
  "max",
  "min",
]

const MISSING_BACKSLASH_RE = new RegExp(
  `(?<!\\\\)\\b(${LATEX_COMMANDS.join("|")})(?=\\s*[{\\s^_\\(\\[])`,
  "g"
)

function sanitizeLatex(raw: string): string {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(FAKE_BACKSLASH_RE, "\\")
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `$$${expr}$$`)
    .replace(MISSING_BACKSLASH_RE, (_, cmd) => `\\${cmd}`)
    .replace(/(?<!\\)\bfrac(?=\s*[{])/g, "\\frac")
    .replace(/(?<!\\)\bsqrt(?=\s*[{[])/g, "\\sqrt")
    .replace(/(?<!\\)\btimes\b/g, "\\times")
    .replace(/(?<!\\)\bcdot\b/g, "\\cdot")
    .replace(/(?<!\\)\bdiv\b/g, "\\div")
    .replace(/(?<!\\)\bbar(?=\s*[{])/g, "\\bar")
    .replace(/(?<!\\)\boverline(?=\s*[{])/g, "\\overline")
    .trim()
}

function maybeWrapInlineMath(text: string): string {
  let s = sanitizeLatex(text)

  const hasMathDelimiter = /\$[^$]+\$|\$\$[\s\S]*?\$\$/.test(s)
  if (hasMathDelimiter) return s

  s = s.replace(
    /(\\frac\s*\{[^{}]+\}\s*\{[^{}]+\})/g,
    (_m, expr) => `$${expr}$`
  )

  s = s.replace(
    /(\\sqrt(?:\[[^\]]+\])?\s*\{[^{}]+\})/g,
    (_m, expr) => `$${expr}$`
  )

  s = s.replace(
    /((?:\d+|[A-Za-z]+|\([^()]+\))\s*(?:\\times|\\cdot|\\div)\s*(?:\d+|[A-Za-z]+|\\frac\s*\{[^{}]+\}\s*\{[^{}]+\}|\\sqrt(?:\[[^\]]+\])?\s*\{[^{}]+\}|\([^()]+\)))/g,
    (_m, expr) => `$${expr}$`
  )

  s = s.replace(
    /((?:[A-Za-z0-9]+)(?:\^\{[^{}]+\}|\^[A-Za-z0-9]+|_\{[^{}]+\}|_[A-Za-z0-9]+))/g,
    (_m, expr) => `$${expr}$`
  )

  s = s.replace(
    /((?:\d+\.)?\\bar\s*\{[^{}]+\})/g,
    (_m, expr) => `$${expr}$`
  )

  return s
}

function sanitizeLatexText(value: any): string {
  const s = String(value ?? "").trim()
  if (!s) return ""
  return maybeWrapInlineMath(s)
}

function sanitizeQuestionLatex(q: any) {
  if (!q || typeof q !== "object") return q

  const cleaned = {
    ...q,
    question: sanitizeLatexText(q.question),
    explanation: sanitizeLatexText(q.explanation),
    modelAnswer: sanitizeLatexText(q.modelAnswer),
    expectedAnswer: sanitizeLatexText(q.expectedAnswer),
    expectedLatex: sanitizeLatexText(q.expectedLatex ?? q.expected_latex),
    answerText: sanitizeLatexText(q.answerText ?? q.correctAnswerText),
    statement: sanitizeLatexText(q.statement),
    prompt: sanitizeLatexText(q.prompt),
  }

  if (Array.isArray(q.options)) {
    cleaned.options = q.options.map((opt: any) => sanitizeLatexText(opt))
  }

  if (Array.isArray(q.alternatives)) {
    cleaned.alternatives = q.alternatives.map((opt: any) => sanitizeLatexText(opt))
  }

  if (Array.isArray(q.choices)) {
    cleaned.choices = q.choices.map((opt: any) => sanitizeLatexText(opt))
  }

  if (Array.isArray(q.answers)) {
    cleaned.answers = q.answers.map((opt: any) =>
      typeof opt === "string" ? sanitizeLatexText(opt) : opt
    )
  }

  if (Array.isArray(q.solutionSteps ?? q.steps)) {
    cleaned.solutionSteps = (q.solutionSteps ?? q.steps).map((step: any) => sanitizeLatexText(step))
  }

  if (Array.isArray(q.distractorRationales ?? q.distractor_reasons)) {
    cleaned.distractorRationales = (q.distractorRationales ?? q.distractor_reasons).map((item: any) => sanitizeLatexText(item))
  }

  if (q.correctAnswer != null && typeof q.correctAnswer === "string") {
    cleaned.correctAnswer = sanitizeLatexText(q.correctAnswer)
  }

  if (q.correct_option != null && typeof q.correct_option === "string") {
    cleaned.correct_option = sanitizeLatexText(q.correct_option)
  }

  if (q.answer != null && typeof q.answer === "string") {
    cleaned.answer = sanitizeLatexText(q.answer)
  }

  return cleaned
}

function normalizeCorrectAnswerIndex(
  rawCorrectAnswer: any,
  options: string[],
  type: "multiple_choice" | "true_false" | "development"
): number {
  const maxIndex = Math.max(0, options.length - 1)

  if (typeof rawCorrectAnswer === "number" && Number.isFinite(rawCorrectAnswer)) {
    return Math.max(0, Math.min(maxIndex, Math.round(rawCorrectAnswer)))
  }

  if (typeof rawCorrectAnswer === "boolean" && type === "true_false") {
    return rawCorrectAnswer ? 0 : Math.min(1, maxIndex)
  }

  if (typeof rawCorrectAnswer === "string") {
    const value = rawCorrectAnswer.trim().toLowerCase()
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.min(maxIndex, Math.round(numeric)))
    }

    const letters = ["a", "b", "c", "d", "e", "f"]
    const letterIndex = letters.indexOf(value)
    if (letterIndex >= 0) {
      return Math.max(0, Math.min(maxIndex, letterIndex))
    }

    if (type === "true_false") {
      if (["verdadero", "v", "true"].includes(value)) return 0
      if (["falso", "f", "false"].includes(value)) return Math.min(1, maxIndex)
    }

    const optionIndex = options.findIndex((opt) => String(opt).trim().toLowerCase() === value)
    if (optionIndex >= 0) return optionIndex
  }

  return 0
}

function repairQuestionStructure(q: any): any {
  if (!q || typeof q !== "object") return q

  const type =
    q.type === "true_false" || q.type === "development" ? q.type : "multiple_choice"

  const fixed = { ...q, type }

  if (type === "multiple_choice") {
    const options =
      Array.isArray(q.options) && q.options.length > 0
        ? q.options.map((opt: any) => sanitizeLatexText(opt))
        : ["Opción A", "Opción B", "Opción C", "Opción D"]

    fixed.options = options
    fixed.correctAnswer = normalizeCorrectAnswerIndex(q.correctAnswer, options, type)
    fixed.maxPoints = Number.isFinite(Number(q.maxPoints)) ? Math.max(1, Number(q.maxPoints)) : 1
  }

  if (type === "true_false") {
    fixed.options = ["Verdadero", "Falso"]
    fixed.correctAnswer = normalizeCorrectAnswerIndex(q.correctAnswer, fixed.options, type)
    fixed.selectionPoints = Number.isFinite(Number(q.selectionPoints)) ? Math.max(0, Number(q.selectionPoints)) : 1
    fixed.justificationMaxPoints = Number.isFinite(Number(q.justificationMaxPoints))
      ? Math.max(0, Number(q.justificationMaxPoints))
      : 2
    fixed.maxPoints = fixed.selectionPoints + fixed.justificationMaxPoints
  }

  if (type === "development") {
    fixed.modelAnswer = sanitizeLatexText(q.modelAnswer ?? q.expectedAnswer ?? q.respuestaModelo ?? "")
    fixed.rubric = Array.isArray(q.rubric)
      ? q.rubric.map((r: any) => ({
          criteria: String(r?.criteria ?? r?.criterion ?? r?.criterio ?? "Criterio"),
          points: Number.isFinite(Number(r?.points ?? r?.puntos)) ? Math.max(0, Number(r?.points ?? r?.puntos)) : 1,
        }))
      : []
    const rubricSum = fixed.rubric.reduce((acc: number, item: any) => acc + (Number(item?.points) || 0), 0)
    fixed.maxPoints = rubricSum > 0 ? rubricSum : (Number.isFinite(Number(q.maxPoints)) ? Math.max(1, Number(q.maxPoints)) : 5)
  }

  return fixed
}

function sanitizeQuestionsArray(questions: any[]): any[] {
  if (!Array.isArray(questions)) return []
  return questions.map(q =>
    enrichQuestionAnswerKey(
      validateQuestionConsistency(repairQuestionStructure(sanitizeQuestionLatex(q)))
    )
  )
}

function validateQuestionConsistency(q: any): any {
  if (q?.type === "multiple_choice" && Array.isArray(q?.options) && q?.correctAnswer != null) {
    const correctIdx = normalizeCorrectAnswerIndex(q.correctAnswer, q.options, "multiple_choice")
    const correctOption = String(q.options[correctIdx] || "")
    const explanation = String(q.explanation || "")
    const cleanOption = correctOption.replace(/[\$\\]/g, "").trim().toLowerCase()
    const cleanExpl = explanation.replace(/[\$\\]/g, "").trim().toLowerCase()

    q.correctAnswer = correctIdx

    if (cleanOption && cleanExpl && !cleanExpl.includes(cleanOption.slice(0, Math.min(8, cleanOption.length)))) {
      console.warn("[exam-generate] Possible correctAnswer mismatch in question:", q.question?.slice(0, 60))
      q.explanation = explanation
        ? `${explanation.trim()} Respuesta correcta: ${correctOption}`
        : `Respuesta correcta: ${correctOption}`
    }
  }

  if (q?.type === "true_false") {
    q.options = ["Verdadero", "Falso"]
    q.correctAnswer = normalizeCorrectAnswerIndex(q.correctAnswer, q.options, "true_false")
  }

  if (q?.type === "development") {
    q.modelAnswer = sanitizeLatexText(q.modelAnswer ?? q.expectedAnswer ?? "")
    q.rubric = Array.isArray(q.rubric)
      ? q.rubric.map((r: any) => ({
          criteria: String(r?.criteria ?? r?.criterion ?? r?.criterio ?? "Criterio"),
          points: Number.isFinite(Number(r?.points ?? r?.puntos))
            ? Math.max(0, Number(r?.points ?? r?.puntos))
            : 1,
        }))
      : []
  }

  return q
}

function parseResponse(raw: string): any {
  const clean = String(raw || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()

  return parseExamModelJson(clean)
}

const SYSTEM = `Eres un especialista en diseño y corrección de evaluaciones escolares en español.
Devuelve SOLO JSON válido, sin markdown ni texto fuera del objeto.
Formato principal: {"title":"...","questions":[...]}.
Tipos permitidos: multiple_choice, true_false, development.
Respeta EXACTAMENTE las cantidades pedidas y no generes tipos con cantidad 0.

Cada pregunta y su pauta deben generarse juntas, dentro del mismo objeto, para conservar coherencia pedagógica.

ESQUEMA OBLIGATORIO PARA multiple_choice:
{
  "type":"multiple_choice",
  "question":"...",
  "options":["...","...","...","..."],
  "correctAnswer":0,
  "answerText":"texto idéntico a options[correctAnswer]",
  "explanation":"explicación clara de por qué esa opción es correcta",
  "solutionSteps":["paso o fundamento 1","paso o fundamento 2"],
  "distractorRationales":["motivo opción A","motivo opción B","motivo opción C","motivo opción D"],
  "maxPoints":1
}
REGLAS multiple_choice: calcula primero la respuesta; crea una opción correcta exacta; crea tres distractores plausibles basados en errores comunes; mezcla las cuatro opciones; correctAnswer debe indicar la posición final; answerText DEBE ser exactamente options[correctAnswer]; las cuatro alternativas deben ser distintas, pertinentes y del mismo tipo de respuesta.

ESQUEMA OBLIGATORIO PARA true_false:
{
  "type":"true_false",
  "question":"...",
  "options":["Verdadero","Falso"],
  "correctAnswer":0,
  "answerText":"Verdadero",
  "explanation":"justificación completa",
  "solutionSteps":["fundamento"],
  "selectionPoints":1,
  "justificationMaxPoints":2
}

ESQUEMA OBLIGATORIO PARA development:
{
  "type":"development",
  "question":"...",
  "modelAnswer":"respuesta esperada completa",
  "expectedLatex":"resultado matemático final en LaTeX cuando corresponda",
  "explanation":"explicación pedagógica",
  "solutionSteps":["paso 1","paso 2"],
  "rubric":[{"criteria":"...","points":1}],
  "maxPoints":5
}

Matemática: usa LaTeX solo dentro de $...$ o $$...$$; comandos con backslash real: \frac, \sqrt, \times.
Antes de responder, revisa internamente que cada respuesta sea coherente con su pregunta y que las alternativas no sean absurdas ni ambiguas.
`
const PROVIDER_BATCH = Number(process.env.EXAM_GENERATE_BATCH_SIZE || 3)
const MAX_AI_QUESTIONS_PER_CALL = EXAM_AI_MAX_QUESTIONS
const GROQ_TOKEN_BUDGET_PER_BATCH = Math.max(3200, Math.min(6000, Number(process.env.EXAM_GENERATE_GROQ_MAX_TOKENS) || 4500))

type BatchPlan = { total: number; mc: number; tf: number; dev: number }

const questionTypes = ["multiple_choice", "true_false", "development", "mixed_choice_development"] as const

function requireBatchShape(questions: any[], batch: BatchPlan) {
  const expected = [batch.mc, batch.tf, batch.dev, "mixed" in batch ? Number(batch.mixed) : 0]
  if (questions.length !== batch.total || questionTypes.some((type, index) =>
    questions.filter(question => question?.type === type && typeof question.question === "string" && question.question.trim()).length !== expected[index]
  )) {
    throw new Error("La IA devolvió una tanda incompleta o con tipos distintos de los solicitados.")
  }
}

function requireSingleShape(question: any, expectedType?: string) {
  if (!question?.question?.trim() || (expectedType && question.type !== expectedType)) {
    throw new Error("La IA no devolvió una pregunta del tipo solicitado.")
  }
}

async function cloudflareBatch(prompt: string, signal?: AbortSignal): Promise<any> {
  signal?.throwIfAborted()
  const result = await generateCompatibleText({
    provider: "cloudflare",
    model: compatibleFallbackModel("cloudflare", "structured"),
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
    maxOutputTokens: GROQ_TOKEN_BUDGET_PER_BATCH,
    module: "examenes",
    signal,
  })
  return parseResponse(result.text)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function compactErrorText(raw: string): string {
  const s = String(raw || "").replace(/\s+/g, " ").trim()
  return s.length > 260 ? `${s.slice(0, 260)}...` : s
}

async function readProviderError(res: Response): Promise<string> {
  try {
    const txt = await res.text()
    return compactErrorText(txt)
  } catch {
    return "sin detalle del proveedor"
  }
}

function friendlyProviderError(message: string): string {
  const msg = String(message || "")
  const lower = msg.toLowerCase()

  if (msg.includes("413") || lower.includes("request too large") || lower.includes("tokens per minute") || msg.includes("429") || lower.includes("resource_exhausted") || lower.includes("rate") || lower.includes("quota")) {
    return "La generación llegó al límite temporal de la API. Puede ser cuota, muchas solicitudes seguidas o límite de tokens por minuto. Prueba con menos preguntas por tanda, espera unos minutos o revisa billing/cuotas de la API configurada."
  }

  if (msg.includes("503") || lower.includes("unavailable") || lower.includes("overloaded") || lower.includes("sobrecarg")) {
    return "El proveedor de IA está temporalmente sobrecargado. No necesariamente es problema de tu API key. Intenta nuevamente o usa otro proveedor/fallback."
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) return "Un proveedor superó el tiempo de respuesta. Reintenta para continuar desde el avance guardado.";

  if (lower.includes("tanda incompleta")) return "La IA no completó la cantidad y los tipos solicitados. Prueba con una tanda más pequeña."

  if (lower.includes("rúbrica") || lower.includes("enunciado") || lower.includes("respuesta modelo")) return "La IA devolvió una pregunta o pauta incompleta. No se incorporó contenido sin validar. Reintenta la pregunta pendiente.";

  if (lower.includes("json") || lower.includes("unexpected token") || lower.includes("formato de evaluación inválido")) {
    return "La IA respondió con datos incompletos o JSON inválido. Reintenta para continuar desde las preguntas verificadas."
  }

  if (lower.includes("api key") || lower.includes("unauthorized") || msg.includes("401") || msg.includes("403")) {
    return "La API key no está autorizada o no está correctamente configurada en las variables de entorno."
  }

  return "No se pudieron generar las preguntas con los proveedores configurados. Revisa las variables de entorno, cuota disponible y logs del servidor."
}

function compactPromptForProvider(basePrompt: string): string {
  // Preserve the complete OA, source and accessibility directives. Request size is bounded at the endpoint.
  return String(basePrompt || "").replace(/(ESTRUCTURA EXACTA DE LA TANDA\n)(?:Total: \d+ preguntas\.\n|- \d+ (?:multiple_choice|mixed_choice_development|true_false|development):[^\n]*\n)+/u, "$1Las cantidades exactas se indican al final de esta solicitud.\n").trim()
}

function promptForBatch(basePrompt: string, batch: BatchPlan, index: number, totalBatches: number): string {
  const compactBase = compactPromptForProvider(basePrompt)
  return `${compactBase}

LOTE ${index + 1}/${totalBatches}. Las cantidades del lote que siguen reemplazan las cantidades globales del contexto; genera solo este lote.
Genera EXACTAMENTE ${batch.total} preguntas:
- ${batch.mc} multiple_choice
- ${batch.tf} true_false
- ${batch.dev} development
Cada objeto debe incluir su respuesta esperada y explicación en el MISMO contexto de generación.
Para alternativas, answerText debe coincidir exactamente con options[correctAnswer] y los cuatro distractorRationales deben explicar la calidad de cada opción.
Salida obligatoria: {"title":"...","questions":[...]}
No agregues texto fuera del JSON. El enunciado SIEMPRE es question (cadena, no objeto); cada pregunta es un objeto independiente. Usa exclusivamente estas claves exactas. Para development: {"type":"development","question":"enunciado completo","responseMode":"forma seleccionada","modelAnswer":"solución completa","expectedLatex":"","explanation":"fundamento","solutionSteps":["paso"],"rubric":[{"criteria":"criterio específico","points":2}],"maxPoints":2,"oaCodes":[],"pedagogicalMode":"id"}; el ejemplo indica estructura, no valores a copiar. Si responseMode es short_text, añade acceptedAnswers. Para mixed_choice_development añade options, correctAnswer, answerText, selectionPoints y developmentMaxPoints. Verifica que la respuesta final coincida con todos los pasos y el resultado matemático. Nunca incluyas borradores, dudas, autocorrecciones o razonamiento descartado. Varía el planteamiento y la habilidad entre preguntas, no solo los números. No omitas el enunciado ni la pauta; usa criterios específicos con puntos positivos. No repitas ni envuelvas cada objeto bajo otra clave. Escapa las barras de LaTeX según JSON.`
}

function tokenBudgetForBatch(questionCount: number): number {
  const dynamic = 900 + Math.max(1, questionCount) * 650
  return Math.min(GROQ_MAX_TOKENS, GROQ_TOKEN_BUDGET_PER_BATCH, dynamic)
}

function buildRepairPrompt(questions: any[], context: string): string {
  const issues = findBlockingQualityIssues(questions)
  return `Actúa como agente revisor de calidad de preguntas. Corrige las preguntas sin cambiar su cantidad ni su tipo.
Contexto del examen: ${context.slice(0, 1200)}

Problemas detectados:
${JSON.stringify(issues)}

Preguntas a corregir:
${JSON.stringify(questions)}

Devuelve SOLO este JSON: {"questions":[...]}
Mantén cada pregunta junto a su respuesta, explanation, solutionSteps y pauta.
En multiple_choice: 4 alternativas distintas y pertinentes; answerText idéntico a options[correctAnswer]; distractorRationales con 4 elementos.`
}

type CurriculumContract = { requireOA: boolean; oaCodes: string[]; modeIds: string[] }

async function validateAndRepairWithProvider(
  questions: any[],
  context: string,
  askProvider: (prompt: string) => Promise<any>,
  curriculum: CurriculumContract | null = null,
  priorStems: ReadonlySet<string> = new Set(),
  allowedModes: string[] = [],
  emit: (phase: string) => void = () => {},
): Promise<any[]> {
  if (!Array.isArray(questions) || !questions.length) throw new Error("La IA devolvió una tanda incompleta.")
  let raw = questions.map(canonicalExamQuestion)
  for (let attempt = 0; attempt <= 1; attempt++) {
    emit(attempt ? "Verificando las correcciones" : "Validando enunciados, OA, respuestas y rúbricas");
    const seen = new Set(priorStems)
    const prepared = raw.map(question => question && typeof question === "object" ? sanitizeQuestionsArray([question])[0] : null)
    const invalid = raw.flatMap((question, index) => {
      const issues = [...examContractIssues(question, curriculum, seen), ...constructedContractIssues(question, allowedModes)]
      const checked = prepared[index]
      if (checked) {
        const quality = findBlockingQualityIssues([checked])[0]
        if (quality) issues.push(...quality.issues.filter(issue => issue.severity === "error").map(issue => issue.message))
        if (question?.type !== checked.type) issues.push("El tipo no se conservó")
      } else issues.push("Pregunta inválida")
      if (!issues.length && checked) {
        const normalized = normalizeStem(checked.question);
        if (seen.has(normalized)) issues.push("Enunciado repetido");
        else { seen.add(normalized); seen.add(normalizeStem(question.question)); }
      }
      return issues.length ? [{ index, issues, question }] : []
    })
    if (!invalid.length) return prepared
    if (attempt === 1) throw new Error("La tanda contiene preguntas que no superaron la validación: " + invalid.map(item => item.issues.join(", ")).join(" | "))
    emit("Corrigiendo preguntas incompletas y su pauta");
    const repaired = await askProvider(`IMPORTANTE: las instrucciones de cantidad anteriores son solo contexto. Devuelve exactamente ${invalid.length} objetos completos. No devuelvas un parche ni un objeto de errores. Cada objeto debe tener question como texto, type, modelAnswer y rubric:[{criteria,points}] si corresponde. Corrige SOLO las preguntas marcadas, en el mismo orden y con el mismo tipo. No repitas enunciados. Devuelve {"questions":[...]}. Mantén los OA exactos, modo pedagógico, respuestas verificadas y pauta.\nContexto completo:\n${context}\nPreguntas válidas que no debes repetir:\n${JSON.stringify([...seen])}\nPreguntas pendientes:\n${JSON.stringify(invalid)}`)
    const fixes = extractExamQuestions(repaired)
    if (!Array.isArray(fixes) || fixes.length !== invalid.length || fixes.some((q: any, i: number) => q?.type !== invalid[i].question?.type)) throw new Error("La reparación devolvió una tanda incompleta.")
    for (let i = 0; i < invalid.length; i++) raw[invalid[i].index] = fixes[i]
  }
  throw new Error("La tanda no superó la validación.")
}

async function groqBatch(prompt: string, key: string, signal?: AbortSignal): Promise<any> {
  const Groq = (await import("groq-sdk")).default
  const client = new Groq({ apiKey: key, timeout: 20000, maxRetries: 0 })

  let lastError = ""

  for (const model of GROQ_MODELS) {
    signal?.throwIfAborted();
    try {
      const res = await client.chat.completions.create({
        model,
        max_tokens: GROQ_TOKEN_BUDGET_PER_BATCH,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }, { signal })

      if (res.choices[0]?.finish_reason === "length") throw new Error("JSON truncado por límite de salida");
      const raw = res.choices[0]?.message?.content?.trim() ?? ""
      if (!raw) {
        lastError = `${model}: respuesta vacía`
        continue
      }

      console.log(`[exam-generate] Groq modelo usado: ${model}`)
      return parseResponse(raw)
    } catch (e: any) {
      lastError = `${model}: ${e.message}`
      console.warn(`[exam-generate] Groq ${model} falló:`, e.message)
    }
  }

  throw new Error(`Groq: todos los modelos fallaron. Último error: ${lastError}`)
}

async function openRouterBatch(prompt: string, key: string, signal?: AbortSignal): Promise<any> {
  const models = Array.from(new Set([
    resolveOpenRouterTextModel(process.env.OPENROUTER_STRUCTURED_MODEL || process.env.OPENROUTER_TEXT_MODEL),
    "openrouter/free",
  ]))

  let lastError = ""

  for (const model of models) {
    signal?.throwIfAborted();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://eduai.local",
          "X-Title": process.env.OPENROUTER_APP_TITLE || "EduAI Exam Generator",
        },
        body: JSON.stringify({
          model,
          provider: openRouterTextProviderOptions(),
          max_tokens: GROQ_TOKEN_BUDGET_PER_BATCH,
          temperature: 0.35,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: prompt },
          ],
        }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
      })

      if (!res.ok) {
        const err = await readProviderError(res)
        lastError = `${model} HTTP ${res.status}: ${err}`
        console.warn("[exam-generate] OpenRouter", lastError)
        continue
      }

      const data = await res.json()
      if (data?.choices?.[0]?.finish_reason === "length") throw new Error("JSON truncado por límite de salida");
      const raw = data?.choices?.[0]?.message?.content?.trim() ?? ""

      if (!raw) {
        lastError = `${model}: respuesta vacía`
        continue
      }

      console.log(`[exam-generate] OpenRouter modelo usado: ${model}`)
      return parseResponse(raw)
    } catch (e: any) {
      lastError = `${model}: ${e.message}`
      console.warn("[exam-generate] OpenRouter", lastError)
    }
  }

  throw new Error(`OpenRouter: todos los modelos fallaron. Último: ${lastError}`)
}

async function generateExam(req: NextRequest, emit: (phase: string) => void = () => {}) {
  const generationSignal = AbortSignal.any([req.signal, AbortSignal.timeout(95000)])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const GROQ_KEY = process.env.GROQ_API_KEY
  const OR_KEY = process.env.OPENROUTER_API_KEY_1 || process.env.OPENROUTER_API_KEY

  const cloudflareEnabled = hasCompatibleProvider("cloudflare", "examenes")

  if (!GROQ_KEY && !OR_KEY && !cloudflareEnabled) {
    return NextResponse.json(
      { error: "No hay proveedores de generación de exámenes configurados." },
      { status: 500 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  const { prompt, mode = "full", mc = 0, tf = 0, dev = 0, designTemplateId } = body
  const designPrompt = buildDesignPromptDirective(designTemplateId, "exam")
  const enhancedPrompt = `${prompt}${designPrompt}`
  const designSummary = getDesignTemplateSummary(designTemplateId, "exam")

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt requerido" }, { status: 400 })
  }

  if (prompt.length > 100000) return NextResponse.json({ error: "El contexto supera el límite de 100.000 caracteres. Reduce el texto o divide la evaluación." }, { status: 413 })
  const curricular = body.curriculum;
  let curriculum: CurriculumContract | null = null;
  if (curricular !== undefined) {
    if (!curricular || typeof curricular.requireOA !== "boolean" || !Array.isArray(curricular.oaCodes) || !Array.isArray(curricular.modeIds) || curricular.oaCodes.some((code: unknown) => typeof code !== "string" || !code.trim()) || curricular.modeIds.some((id: unknown) => !PEDAGOGICAL_MODES.some(mode => mode.id === id))) return NextResponse.json({ error: "Configuración curricular inválida." }, { status: 400 });
    curriculum = { requireOA: curricular.requireOA, oaCodes: Array.from(new Set<string>(curricular.oaCodes)), modeIds: Array.from(new Set<string>(curricular.modeIds)) };
    if (curriculum.requireOA && !curriculum.oaCodes.length) return NextResponse.json({ error: "Selecciona al menos un OA antes de generar preguntas." }, { status: 400 });
    if (!curriculum.modeIds.length) return NextResponse.json({ error: "Selecciona al menos un modo pedagógico." }, { status: 400 });
  }
  const existing = Array.isArray(body.existingQuestions) ? body.existingQuestions.filter((q: unknown) => typeof q === "string").slice(-200) : [];
  const priorStems = new Set<string>(existing.map(normalizeStem));
  const curricularPrompt = curriculum ? `\nCONTRATO CURRICULAR: ${JSON.stringify(curriculum)}. Usa pedagogicalMode como identificador exacto de modeIds y oaCodes únicamente de esta lista. Si requireOA es true, incluye al menos uno.` : "";
  const allowedModes: string[] = Array.isArray(body.responseModes) ? body.responseModes.filter((mode: unknown) => typeof mode === "string" && ["short_text","long_text","math","text_math","math_steps"].includes(mode)) : [];
  const modeDirective = allowedModes.length ? `\nFORMAS DE RESPUESTA CONSTRUIDA: usa responseMode exactamente de ${JSON.stringify(allowedModes)}. Si es short_text incluye acceptedAnswers; en los demás casos incluye rubric con criterios concretos y puntos positivos. Mantén modelAnswer en todas.` : "";
  const requestPrompt = enhancedPrompt + curricularPrompt + modeDirective + (existing.length ? `\nNo repitas preguntas existentes: ${JSON.stringify(existing.map((q: string) => q.slice(0, 500)))}` : "");

  if (mode === "single") {
    const expectedType = body.questionType
    if (expectedType !== undefined && !questionTypes.includes(expectedType)) {
      return NextResponse.json({ error: "El tipo de pregunta no es válido." }, { status: 400 })
    }
    const singleErrors: string[] = []

    // Prioridad Groq: OpenRouter puede devolver 402 si no tiene créditos.
    if (GROQ_KEY) {
      try {
        const parsed = await groqBatch(requestPrompt, GROQ_KEY, generationSignal)
        const [q] = await validateAndRepairWithProvider(
          extractExamQuestions(parsed),
          requestPrompt,
          (repairPrompt) => groqBatch(repairPrompt, GROQ_KEY, generationSignal), curriculum, priorStems, allowedModes
        )

        requireSingleShape(q, expectedType)
        return NextResponse.json({ success: true, question: q, answerKeyEntry: buildAnswerKey([q])[0], provider: "groq", _design: designSummary })
      } catch (e: any) {
        singleErrors.push(`Groq: ${e.message}`)
        console.warn("[exam-generate/single] Groq falló:", e.message)
      }
    }

    if (OR_KEY) {
      try {
        const parsed = await openRouterBatch(requestPrompt, OR_KEY, generationSignal)
        const [q] = await validateAndRepairWithProvider(
          extractExamQuestions(parsed),
          requestPrompt,
          (repairPrompt) => openRouterBatch(repairPrompt, OR_KEY, generationSignal), curriculum, priorStems, allowedModes
        )

        requireSingleShape(q, expectedType)
        return NextResponse.json({ success: true, question: q, answerKeyEntry: buildAnswerKey([q])[0], provider: "openrouter", _design: designSummary })
      } catch (e: any) {
        singleErrors.push(`OpenRouter: ${e.message}`)
        console.warn("[exam-generate/single] OpenRouter falló:", e.message)
      }
    }

    if (cloudflareEnabled) {
      try {
        const parsed = await cloudflareBatch(requestPrompt, generationSignal)
        const [q] = await validateAndRepairWithProvider(
          extractExamQuestions(parsed), requestPrompt, (prompt) => cloudflareBatch(prompt, generationSignal), curriculum, priorStems, allowedModes,
        )
        requireSingleShape(q, expectedType)
        return NextResponse.json({ success: true, question: q, answerKeyEntry: buildAnswerKey([q])[0], provider: "cloudflare", _design: designSummary })
      } catch (error) {
        singleErrors.push(`Cloudflare: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const details = singleErrors.join(" | ")
    return NextResponse.json({ error: friendlyProviderError(details), details }, { status: 500 })
  }

  const requestedCounts = [body.mc, body.tf, body.dev, body.mixed].filter(value => value !== undefined)
  if (requestedCounts.some(value => !["number", "string"].includes(typeof value) ||
    String(value).trim() === "" || !Number.isSafeInteger(Number(value)) || Number(value) < 0)) {
    return NextResponse.json({ error: "Las cantidades deben ser números enteros no negativos." }, { status: 400 })
  }
  if (requestedCounts.length && requestedCounts.every(value => Number(value) === 0)) {
    return NextResponse.json({ error: "Solicita al menos una pregunta." }, { status: 400 })
  }

  const counts = { mc: Number(mc), tf: Number(tf), dev: Number(dev), mixed: Number(body.mixed ?? 0) };
  if (!requestedCounts.length) counts.mc = Number(String(prompt).match(/Total de preguntas:\s*(\d+)/i)?.[1] || 15);
  const totalQ = counts.mc + counts.tf + counts.dev + counts.mixed;

  if (!Number.isFinite(totalQ) || totalQ <= 0) {
    return NextResponse.json({ error: "La cantidad de preguntas debe ser mayor que 0." }, { status: 400 })
  }

  if (totalQ > MAX_AI_QUESTIONS_PER_CALL) {
    return NextResponse.json(
      {
        error: `Para evitar errores de cuota/timeout, genera máximo ${MAX_AI_QUESTIONS_PER_CALL} preguntas por tanda. Puedes importar esas preguntas y luego generar otra tanda con modo "Agregar al final".`,
      },
      { status: 400 }
    )
  }

  const providers: { id: string; ask: (prompt: string) => Promise<any> }[] = [];
  if (GROQ_KEY) providers.push({ id: "groq", ask: (prompt) => groqBatch(prompt, GROQ_KEY, generationSignal) });
  if (OR_KEY) providers.push({ id: "openrouter", ask: (prompt) => openRouterBatch(prompt, OR_KEY, generationSignal) });
  if (cloudflareEnabled) providers.push({ id: "cloudflare", ask: (prompt) => cloudflareBatch(prompt, generationSignal) });
  const batches = planExamBatches(counts, PROVIDER_BATCH);
  const allQuestions: any[] = [];
  const providersUsed = new Set<string>();
  const errors: string[] = [];
  let title = "";
  let preferred = Math.max(0, providers.findIndex(provider => provider.id === body.preferredProvider));
  for (let i = 0; i < batches.length; i++) {
    if (req.signal.aborted) return NextResponse.json({ error: "Generación cancelada." }, { status: 499 });
    const batch = batches[i];
    const prompt = promptForBatch(requestPrompt, batch, i, batches.length) + "\nNo repitas los enunciados ya generados: " + JSON.stringify(allQuestions.map(q => q.question));
    let complete = false;
    for (let offset = 0; offset < providers.length; offset++) {
      const index = (preferred + offset) % providers.length;
      const provider = providers[index];
      if (req.signal.aborted) return NextResponse.json({ error: "Generación cancelada." }, { status: 499 });
      if (generationSignal.aborted) return NextResponse.json({ error:"Se alcanzó el límite de tiempo de esta solicitud. Reintenta para continuar desde las preguntas verificadas." },{status:504});
      try {
        emit(`Generando en ${provider.id === "groq" ? "Groq" : provider.id === "openrouter" ? "OpenRouter" : "Cloudflare"}`);
        const parsed = await provider.ask(prompt);
        const raw = extractExamQuestions(parsed);
        if (!Array.isArray(raw) || raw.length !== batch.total) throw new Error("La IA devolvió una tanda incompleta.");
        const questions = await validateAndRepairWithProvider(raw, prompt, provider.ask, curriculum, priorStems, allowedModes, emit);
        requireBatchShape(questions, batch);
        allQuestions.push(...questions);
        questions.forEach(q => priorStems.add(normalizeStem(q.question)));
        if (!title && parsed?.title) title = sanitizeLatexText(parsed.title);
        providersUsed.add(provider.id);
        preferred = index;
        complete = true;
        break;
      } catch (error) {
        emit(`Respuesta de ${provider.id} no válida; intentando respaldo`);
        errors.push(`Lote ${i + 1}, ${provider.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!complete) {
      const details = errors.join(" | ");
      return NextResponse.json({ error: `No se pudo completar el lote ${i + 1} de ${batches.length}. No se incorporaron preguntas automáticamente. ${friendlyProviderError(details)}`, details }, { status: 502 });
    }
  }
  emit("Consolidando preguntas y pauta");
  const orderedTypes = ["multiple_choice", "mixed_choice_development", "true_false", "development"];
  allQuestions.sort((left, right) => orderedTypes.indexOf(left.type) - orderedTypes.indexOf(right.type));
  return NextResponse.json({ success: true, title, questions: allQuestions, summary: null, answerKey: buildAnswerKey(allQuestions), qualityReviewRequired: [], provider: Array.from(providersUsed)[0], providers: [...providersUsed], _design: designSummary });

}

/** Optional NDJSON progress channel; legacy consumers retain the ordinary JSON contract. */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-exam-progress") !== "1") return generateExam(req)
  // Authenticate before opening the stream (the JSON path also verifies the session).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({error:"No autenticado"},{status:401})
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        if (!req.signal.aborted) { try { controller.enqueue(encoder.encode(JSON.stringify(data)+"\n")) } catch {} }
      }
      try {
        send({event:"progress",phase:"Preparando el contexto curricular"})
        const result = await generateExam(req, phase => send({event:"progress",phase}))
        const data = await result.json()
        send({event:"result",status:result.status,data})
      } catch {
        send({event:"result",status:500,data:{error:"No se pudo completar la generación. Reintenta para continuar desde las preguntas verificadas."}})
      } finally { try {controller.close()} catch {} }
    },
  })
  return new Response(stream,{headers:{"Content-Type":"application/x-ndjson; charset=utf-8","Cache-Control":"no-store, no-transform","X-Accel-Buffering":"no"}})
}
