// app/api/agents/exam-generate/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 120

const GROQ_MODELS = [
  // Modelos activos de Groq. Evitar modelos decommissioned como mixtral-8x7b-32768 y gemma2-9b-it.
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
]

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
  return questions.map(q => validateQuestionConsistency(repairQuestionStructure(sanitizeQuestionLatex(q))))
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

  return JSON.parse(clean)
}

const SYSTEM = `Eres experto en evaluaciones escolares en español.
Devuelve SOLO JSON válido, sin markdown.
Formato: {"title":"...","questions":[...]}.
Tipos permitidos: multiple_choice, true_false, development.
Respeta EXACTAMENTE las cantidades pedidas y no generes tipos con cantidad 0.
Alternativas: 4 options, correctAnswer = índice 0-3 de la opción correcta. Calcula antes de elegir. La explicación debe coincidir con options[correctAnswer]. Nunca uses correctAnswer=0 por defecto.
V/F: options ["Verdadero","Falso"], correctAnswer 0 o 1, incluye explicación.
Desarrollo: incluye modelAnswer, rubric [{criteria,points}], maxPoints.
Matemática: usa LaTeX solo dentro de $...$ o $$...$$; comandos con backslash real: \\frac, \\sqrt, \\times.
`

const PROVIDER_BATCH = Number(process.env.EXAM_GENERATE_BATCH_SIZE || 3)
const MAX_AI_QUESTIONS_PER_CALL = Number(process.env.EXAM_GENERATE_MAX_QUESTIONS || 30)
const GROQ_TOKEN_BUDGET_PER_BATCH = Number(process.env.EXAM_GENERATE_GROQ_MAX_TOKENS || 3200)

type BatchPlan = { total: number; mc: number; tf: number; dev: number }

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

  if (lower.includes("json") || lower.includes("unexpected token")) {
    return "La IA respondió con un formato inválido. Se recomienda generar menos preguntas por tanda o usar un tema más específico."
  }

  if (lower.includes("api key") || lower.includes("unauthorized") || msg.includes("401") || msg.includes("403")) {
    return "La API key no está autorizada o no está correctamente configurada en las variables de entorno."
  }

  return "No se pudieron generar las preguntas con los proveedores configurados. Revisa las variables de entorno, cuota disponible y logs del servidor."
}

function makeBatchPlans(totalQ: number, mc: number, tf: number, dev: number): BatchPlan[] {
  const explicit = mc > 0 || tf > 0 || dev > 0
  const initial = explicit
    ? { mc: Math.max(0, mc), tf: Math.max(0, tf), dev: Math.max(0, dev) }
    : { mc: Math.max(1, totalQ), tf: 0, dev: 0 }

  let remaining = {
    ...initial,
    total: initial.mc + initial.tf + initial.dev,
  }

  const plans: BatchPlan[] = []

  while (remaining.total > 0) {
    const take = Math.min(PROVIDER_BATCH, remaining.total)

    let bMc = 0
    let bTf = 0
    let bDev = 0

    if (!explicit) {
      bMc = take
    } else {
      bMc = Math.min(remaining.mc, Math.floor((take * remaining.mc) / remaining.total))
      bTf = Math.min(remaining.tf, Math.floor((take * remaining.tf) / remaining.total))
      bDev = Math.min(remaining.dev, Math.floor((take * remaining.dev) / remaining.total))

      let left = take - bMc - bTf - bDev
      const order: ("mc" | "tf" | "dev")[] = ["mc", "tf", "dev"]

      while (left > 0) {
        let assigned = false
        for (const key of order) {
          if (left <= 0) break
          const current = key === "mc" ? bMc : key === "tf" ? bTf : bDev
          const capacity = remaining[key] - current
          if (capacity > 0) {
            if (key === "mc") bMc++
            if (key === "tf") bTf++
            if (key === "dev") bDev++
            left--
            assigned = true
          }
        }
        if (!assigned) break
      }
    }

    const total = bMc + bTf + bDev
    if (total <= 0) break

    plans.push({ total, mc: bMc, tf: bTf, dev: bDev })

    remaining.mc -= bMc
    remaining.tf -= bTf
    remaining.dev -= bDev
    remaining.total -= total
  }

  return plans
}

function compactPromptForProvider(basePrompt: string): string {
  const raw = String(basePrompt || "")
  const keepLines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/REGLAS|OBLIGATORI|JSON|ESTRUCTURA|LaTeX|correctAnswer/i.test(line))

  const compact = keepLines.join("\n").slice(0, 1800)
  return compact || raw.slice(0, 1800)
}

function promptForBatch(basePrompt: string, batch: BatchPlan, index: number, totalBatches: number): string {
  const compactBase = compactPromptForProvider(basePrompt)
  return `${compactBase}

LOTE ${index + 1}/${totalBatches}.
Genera EXACTAMENTE ${batch.total} preguntas:
- ${batch.mc} multiple_choice
- ${batch.tf} true_false
- ${batch.dev} development
Salida obligatoria: {"title":"...","questions":[...]}
No agregues texto fuera del JSON.`
}

function tokenBudgetForBatch(questionCount: number): number {
  const dynamic = 900 + Math.max(1, questionCount) * 650
  return Math.min(GROQ_MAX_TOKENS, GROQ_TOKEN_BUDGET_PER_BATCH, dynamic)
}

async function groqBatch(prompt: string, key: string): Promise<any> {
  const Groq = (await import("groq-sdk")).default
  const client = new Groq({ apiKey: key })

  let lastError = ""

  for (const model of GROQ_MODELS) {
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
      })

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

async function groqFull(
  basePrompt: string,
  totalQ: number,
  mc: number,
  tf: number,
  dev: number,
  key: string
): Promise<{ title: string; questions: any[] }> {
  const batches = makeBatchPlans(totalQ, mc, tf, dev)
  const allQ: any[] = []
  let title = ""

  for (let i = 0; i < batches.length; i++) {
    const prompt = promptForBatch(basePrompt, batches[i], i, batches.length)
    const parsed = await groqBatch(prompt, key)
    const qs = sanitizeQuestionsArray(parsed?.questions ?? parsed?.items ?? [])

    allQ.push(...qs)
    if (!title && parsed?.title) title = sanitizeLatexText(parsed.title)
    if (i < batches.length - 1) await sleep(900)
  }

  return { title, questions: allQ.slice(0, totalQ) }
}

async function openRouterBatch(prompt: string, key: string): Promise<any> {
  const models = [
    "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen3-32b",
    "deepseek/deepseek-chat",
    "openai/gpt-4o-mini",
  ]

  let lastError = ""

  for (const model of models) {
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
          max_tokens: 3200,
          temperature: 0.35,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(75000),
      })

      if (!res.ok) {
        const err = await readProviderError(res)
        lastError = `${model} HTTP ${res.status}: ${err}`
        console.warn("[exam-generate] OpenRouter", lastError)
        continue
      }

      const data = await res.json()
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

async function openRouterFull(
  basePrompt: string,
  totalQ: number,
  mc: number,
  tf: number,
  dev: number,
  key: string
): Promise<{ title: string; questions: any[] }> {
  const batches = makeBatchPlans(totalQ, mc, tf, dev)
  const allQ: any[] = []
  let title = ""

  for (let i = 0; i < batches.length; i++) {
    const prompt = promptForBatch(basePrompt, batches[i], i, batches.length)
    const parsed = await openRouterBatch(prompt, key)
    const qs = sanitizeQuestionsArray(parsed?.questions ?? parsed?.items ?? [])

    allQ.push(...qs)
    if (!title && parsed?.title) title = sanitizeLatexText(parsed.title)
    if (i < batches.length - 1) await sleep(900)
  }

  return { title, questions: allQ.slice(0, totalQ) }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const GROQ_KEY = process.env.GROQ_API_KEY
  const OR_KEY = process.env.OPENROUTER_API_KEY_1 || process.env.OPENROUTER_API_KEY

  if (!GROQ_KEY && !OR_KEY) {
    return NextResponse.json(
      { error: "Sin API keys configuradas. Agrega GROQ_API_KEY u OPENROUTER_API_KEY en Vercel." },
      { status: 500 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { prompt, mode = "full", mc = 0, tf = 0, dev = 0 } = body

  if (!prompt) {
    return NextResponse.json({ error: "prompt requerido" }, { status: 400 })
  }

  if (mode === "single") {
    const singleErrors: string[] = []

    // Prioridad Groq: OpenRouter puede devolver 402 si no tiene créditos.
    if (GROQ_KEY) {
      try {
        const parsed = await groqBatch(prompt, GROQ_KEY)
        const q = repairQuestionStructure(sanitizeQuestionLatex(parsed?.question ?? parsed?.questions?.[0] ?? parsed))

        return NextResponse.json({ success: true, question: q, provider: "groq" })
      } catch (e: any) {
        singleErrors.push(`Groq: ${e.message}`)
        console.warn("[exam-generate/single] Groq falló:", e.message)
      }
    }

    if (OR_KEY) {
      try {
        const parsed = await openRouterBatch(prompt, OR_KEY)
        const q = repairQuestionStructure(sanitizeQuestionLatex(parsed?.question ?? parsed?.questions?.[0] ?? parsed))

        return NextResponse.json({ success: true, question: q, provider: "openrouter" })
      } catch (e: any) {
        singleErrors.push(`OpenRouter: ${e.message}`)
        console.warn("[exam-generate/single] OpenRouter falló:", e.message)
      }
    }

    const details = singleErrors.join(" | ")
    return NextResponse.json({ error: friendlyProviderError(details), details }, { status: 500 })
  }

  const totalQ =
    Number(mc) + Number(tf) + Number(dev) ||
    (() => {
      const m = String(prompt).match(/Total de preguntas:\s*(\d+)/i)
      return m ? parseInt(m[1], 10) : 15
    })()

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

  const providerErrors: string[] = []

  // Prioridad Groq: OpenRouter puede devolver 402 si la cuenta no tiene créditos.
  if (GROQ_KEY) {
    try {
      const { title, questions } = await groqFull(prompt, totalQ, Number(mc), Number(tf), Number(dev), GROQ_KEY)
      if (questions.length > 0) {
        return NextResponse.json({ success: true, title, summary: null, questions, provider: "groq" })
      }
      providerErrors.push("Groq: no devolvió preguntas")
    } catch (e: any) {
      providerErrors.push(`Groq: ${e.message}`)
      console.warn("[exam-generate] Groq falló:", e.message)
    }
  }

  if (OR_KEY) {
    try {
      const { title, questions } = await openRouterFull(prompt, totalQ, Number(mc), Number(tf), Number(dev), OR_KEY)
      if (questions.length > 0) {
        return NextResponse.json({ success: true, title, summary: null, questions, provider: "openrouter" })
      }
      providerErrors.push("OpenRouter: no devolvió preguntas")
    } catch (e: any) {
      providerErrors.push(`OpenRouter: ${e.message}`)
      console.warn("[exam-generate] OpenRouter falló:", e.message)
    }
  }

  const details = providerErrors.join(" | ")
  return NextResponse.json(
    {
      error: friendlyProviderError(details),
      details,
    },
    { status: 500 }
  )
}
