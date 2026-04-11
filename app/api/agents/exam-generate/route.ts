/**
 * app/api/agents/exam-generate/route.ts
 *
 * API dedicada para generación de exámenes de docentes.
 * - Groq primario
 * - OpenRouter fallback
 * - Gemini fallback final
 * - Sanitización robusta de LaTeX para evitar errores visuales en frontend
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 120

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "mixtral-8x7b-32768",
]

const GROQ_BATCH = 12
const GROQ_MAX_TOKENS = 16384

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

function sanitizeQuestionsArray(questions: any[]): any[] {
  if (!Array.isArray(questions)) return []
  return questions.map(sanitizeQuestionLatex)
}

function parseResponse(raw: string): any {
  const clean = sanitizeLatex(
    raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim()
  )

  return JSON.parse(clean)
}

const SYSTEM = `Eres un diseñador experto de evaluaciones escolares en español.
Responde ÚNICAMENTE con JSON válido — sin texto extra, sin backticks, sin markdown.

REGLAS LATEX OBLIGATORIAS:
1. Toda expresión matemática inline debe ir en $...$
2. Toda expresión matemática en bloque debe ir en $$...$$
3. Todos los comandos LaTeX deben comenzar con backslash REAL (\\ ASCII 92)
4. Nunca uses caracteres parecidos a "\\" como ↑, ↗, ∧, ⇒, ⁄
5. No devuelvas comandos LaTeX sueltos fuera de $...$
6. Ejemplo correcto:
   "¿Cuál es el valor de $2 \\\\times \\\\frac{3}{4}$?"
7. Ejemplo correcto en alternativas:
   ["$\\\\frac{3}{2}$", "$\\\\frac{5}{2}$", "$\\\\frac{3}{4}$", "$\\\\frac{6}{4}$"]
8. No uses \\\\( \\\\) ni \\\\[ \\\\]
9. Si no hay matemática, usa texto normal

ESTRUCTURA:
- Devuelve JSON válido
- Si generas examen completo, usa "title" y "questions"
- Si generas una sola pregunta, puedes devolver "question" o "questions"
`

async function gemini(prompt: string, totalQ: number, key: string): Promise<any> {
  const maxOut = Math.min(Math.max(8192, totalQ * 700 + 3000), 65536)

  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: maxOut,
            responseMimeType: "application/json",
          },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      if (res.status === 429 || res.status === 503) throw new Error("QUOTA_EXCEEDED")
      if (res.status === 404 || res.status === 400) continue
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""
    if (!raw) continue

    return parseResponse(raw)
  }

  throw new Error("QUOTA_EXCEEDED")
}

async function groqBatch(prompt: string, key: string): Promise<any> {
  const Groq = (await import("groq-sdk")).default
  const client = new Groq({ apiKey: key })

  let lastError = ""

  for (const model of GROQ_MODELS) {
    try {
      const res = await client.chat.completions.create({
        model,
        max_tokens: model === "llama3-70b-8192" ? 8192 : GROQ_MAX_TOKENS,
        temperature: 0.4,
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
  const batches = Math.ceil(totalQ / GROQ_BATCH)
  const allQ: any[] = []
  let title = ""

  for (let i = 0; i < batches; i++) {
    const done = i * GROQ_BATCH
    const rem = Math.min(GROQ_BATCH, totalQ - done)

    const r = rem / totalQ
    const bMc = mc ? Math.max(0, Math.round(mc * r)) : Math.round(rem * 0.5)
    const bTf = tf ? Math.max(0, Math.round(tf * r)) : Math.round(rem * 0.2)
    const bDev = Math.max(0, rem - bMc - bTf)

    const batchNote =
      batches > 1
        ? `\n\n[Lote ${i + 1}/${batches}: genera exactamente ${bMc} alternativas, ${bTf} V/F, ${bDev} desarrollo. Total: ${rem}]`
        : ""

    const prompt = basePrompt
      .replace(/Total de preguntas: \d+/, `Total de preguntas: ${rem}`)
      .replace(/- \d+ preguntas de ALTERNATIVAS/, `- ${bMc} preguntas de ALTERNATIVAS`)
      .replace(/- \d+ preguntas de VERDADERO O FALSO/, `- ${bTf} preguntas de VERDADERO O FALSO`)
      .replace(/- \d+ preguntas de DESARROLLO/, `- ${bDev} preguntas de DESARROLLO`) + batchNote

    const parsed = await groqBatch(prompt, key)
    const qs = sanitizeQuestionsArray(parsed?.questions ?? parsed?.items ?? [])

    allQ.push(...qs)
    if (!title && parsed?.title) title = sanitizeLatexText(parsed.title)
  }

  return { title, questions: allQ }
}

async function openRouterBatch(prompt: string, key: string): Promise<any> {
  const models = [
    "meta-llama/llama-3.3-70b-instruct",
    "google/gemini-2.5-flash",
    "anthropic/claude-3-haiku",
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
          "X-Title": "EduAI Exam Generator",
        },
        body: JSON.stringify({
          model,
          max_tokens: 16384,
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(90000),
      })

      if (!res.ok) {
        const err = await res.text()
        lastError = `${model} HTTP ${res.status}: ${err.slice(0, 100)}`
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
  const batches = Math.ceil(totalQ / GROQ_BATCH)
  const allQ: any[] = []
  let title = ""

  for (let i = 0; i < batches; i++) {
    const done = i * GROQ_BATCH
    const rem = Math.min(GROQ_BATCH, totalQ - done)
    const r = rem / totalQ
    const bMc = mc ? Math.max(0, Math.round(mc * r)) : Math.round(rem * 0.5)
    const bTf = tf ? Math.max(0, Math.round(tf * r)) : Math.round(rem * 0.2)
    const bDev = Math.max(0, rem - bMc - bTf)

    const batchNote =
      batches > 1
        ? `\n\n[Lote ${i + 1}/${batches}: genera exactamente ${bMc} alternativas, ${bTf} V/F, ${bDev} desarrollo. Total: ${rem}]`
        : ""

    const prompt = basePrompt
      .replace(/Total de preguntas: \d+/, `Total de preguntas: ${rem}`)
      .replace(/- \d+ preguntas de ALTERNATIVAS/, `- ${bMc} preguntas de ALTERNATIVAS`)
      .replace(/- \d+ preguntas de VERDADERO O FALSO/, `- ${bTf} preguntas de VERDADERO O FALSO`)
      .replace(/- \d+ preguntas de DESARROLLO/, `- ${bDev} preguntas de DESARROLLO`) + batchNote

    const parsed = await openRouterBatch(prompt, key)
    const qs = sanitizeQuestionsArray(parsed?.questions ?? parsed?.items ?? [])

    allQ.push(...qs)
    if (!title && parsed?.title) title = sanitizeLatexText(parsed.title)
  }

  return { title, questions: allQ }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY
  const GROQ_KEY = process.env.GROQ_API_KEY
  const OR_KEY = process.env.OPENROUTER_API_KEY_1 || process.env.OPENROUTER_API_KEY

  if (!GEMINI_KEY && !GROQ_KEY && !OR_KEY) {
    return NextResponse.json(
      { error: "Sin API keys configuradas (GEMINI_API_KEY, GROQ_API_KEY u OPENROUTER_API_KEY)." },
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
    if (GROQ_KEY) {
      try {
        const parsed = await groqBatch(prompt, GROQ_KEY)
        const q = sanitizeQuestionLatex(parsed?.question ?? parsed?.questions?.[0] ?? parsed)

        return NextResponse.json({
          success: true,
          question: q,
          provider: "groq",
        })
      } catch (e: any) {
        console.warn("[exam-generate/single] Groq falló:", e.message)
      }
    }

    if (OR_KEY) {
      try {
        const parsed = await openRouterBatch(prompt, OR_KEY)
        const q = sanitizeQuestionLatex(parsed?.question ?? parsed?.questions?.[0] ?? parsed)

        return NextResponse.json({
          success: true,
          question: q,
          provider: "openrouter",
        })
      } catch (e: any) {
        console.warn("[exam-generate/single] OpenRouter falló:", e.message)
      }
    }

    if (GEMINI_KEY) {
      try {
        const parsed = await gemini(prompt, 1, GEMINI_KEY)
        const q = sanitizeQuestionLatex(parsed?.question ?? parsed?.questions?.[0] ?? parsed)

        return NextResponse.json({
          success: true,
          question: q,
          provider: "gemini",
        })
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    return NextResponse.json({ error: "Sin providers disponibles" }, { status: 500 })
  }

  const totalQ =
    mc + tf + dev ||
    (() => {
      const m = prompt.match(/Total de preguntas:\s*(\d+)/)
      return m ? parseInt(m[1], 10) : 15
    })()

  if (GROQ_KEY) {
    try {
      const { title, questions } = await groqFull(prompt, totalQ, mc, tf, dev, GROQ_KEY)
      if (questions.length > 0) {
        return NextResponse.json({
          success: true,
          title,
          summary: null,
          questions,
          provider: "groq",
        })
      }
    } catch (e: any) {
      console.warn("[exam-generate] Groq falló → usando fallback:", e.message)
    }
  }

  if (OR_KEY) {
    try {
      const { title, questions } = await openRouterFull(prompt, totalQ, mc, tf, dev, OR_KEY)
      if (questions.length > 0) {
        return NextResponse.json({
          success: true,
          title,
          summary: null,
          questions,
          provider: "openrouter",
        })
      }
    } catch (e: any) {
      console.warn("[exam-generate] OpenRouter falló:", e.message)
    }
  }

  if (!GEMINI_KEY) {
    return NextResponse.json(
      {
        error:
          "No hay API keys disponibles (GROQ_API_KEY, OPENROUTER_API_KEY_1/OPENROUTER_API_KEY o GEMINI_API_KEY).",
      },
      { status: 500 }
    )
  }

  try {
    const parsed = await gemini(prompt, totalQ, GEMINI_KEY)
    const questions = sanitizeQuestionsArray(parsed?.questions ?? parsed?.items ?? [])

    if (Array.isArray(questions) && questions.length > 0) {
      return NextResponse.json({
        success: true,
        title: sanitizeLatexText(parsed?.title ?? ""),
        summary: parsed?.summary ? sanitizeLatexText(parsed.summary) : null,
        questions,
        provider: "gemini",
      })
    }

    throw new Error("Gemini no generó preguntas")
  } catch (e: any) {
    return NextResponse.json(
      { error: `Error generando examen: ${e.message}` },
      { status: 500 }
    )
  }
}
