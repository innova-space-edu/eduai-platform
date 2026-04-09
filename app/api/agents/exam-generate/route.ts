/**
 * app/api/agents/exam-generate/route.ts
 *
 * API dedicada para generación de exámenes de docentes.
 * - Groq primario (llama-3.3-70b-versatile, hasta 50+ preguntas por lote)
 * - Gemini fallback automático cuando Groq falla
 * - Limpieza de ↑ y otros Unicode que Gemini usa como sustituto de backslash
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime     = "nodejs"
export const maxDuration = 120

const GEMINI_MODELS  = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
const GROQ_MODEL     = "llama-3.3-70b-versatile"   // mejor modelo Groq: 128k ctx, 32k output
const GROQ_BATCH     = 30   // lotes de 30 — seguros con max_tokens 32768
const GROQ_MAX_TOKENS = 32768  // máximo soportado por llama-3.3-70b-versatile

// ─── Sanitizar caracteres Unicode que sustituyen a \ ─────────────────────────
function sanitizeLatex(raw: string): string {
  return raw.replace(/[\u2191\u2197\u2B06\u25B2\u2227\u21D2](?=[a-zA-Z])/g, "\\")
}

function parseResponse(raw: string): any {
  const clean = sanitizeLatex(
    raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
  )
  return JSON.parse(clean)
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM = `Eres un diseñador experto de evaluaciones escolares en español.
Responde ÚNICAMENTE con JSON válido — sin texto extra, sin backticks, sin markdown.

REGLAS LATEX:
1. Usa $...$ para expresiones inline y $$...$$ para bloque.
2. Todos los comandos LaTeX deben comenzar con backslash REAL (\\ ASCII 92).
   CORRECTO:   "$\\frac{1}{2}$"   "$x^2 + 3 = 7$"   "$\\times$"
   INCORRECTO: "↑frac{1}{2}"   "^frac{1}{2}"   "frac{1}{x}" sin dólares
3. El carácter ↑ (U+2191) NO es backslash. Nunca lo uses como sustituto de \\.
4. Sin dólares = texto plano. Toda expresión matemática necesita sus $...$
5. No uses \\\\( \\\\) ni \\\\[ \\\\].`

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function gemini(prompt: string, totalQ: number, key: string): Promise<any> {
  const maxOut = Math.min(Math.max(8192, totalQ * 700 + 3000), 65536)

  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:      0.4,
            maxOutputTokens:  maxOut,
            responseMimeType: "application/json",
          },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      if (res.status === 429) throw new Error("QUOTA_EXCEEDED")  // señal para usar Groq
      if (res.status === 404 || res.status === 400) continue      // probar siguiente modelo
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""
    if (!raw) continue

    return parseResponse(raw)
  }

  throw new Error("QUOTA_EXCEEDED")  // todos los modelos Gemini fallaron
}

// ─── Groq (un lote) ───────────────────────────────────────────────────────────
async function groqBatch(prompt: string, key: string): Promise<any> {
  const Groq   = (await import("groq-sdk")).default
  const client = new Groq({ apiKey: key })

  const res = await client.chat.completions.create({
    model:            GROQ_MODEL,
    max_tokens:       GROQ_MAX_TOKENS,
    temperature:      0.4,
    response_format:  { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user",   content: prompt },
    ],
  })

  const raw = res.choices[0]?.message?.content?.trim() ?? ""
  if (!raw) throw new Error("Groq: respuesta vacía")
  return parseResponse(raw)
}

// ─── Groq en lotes para exámenes grandes ────────────────────────────────────
async function groqFull(
  basePrompt: string,
  totalQ: number,
  mc: number, tf: number, dev: number,
  key: string
): Promise<{ title: string; questions: any[] }> {
  const batches    = Math.ceil(totalQ / GROQ_BATCH)
  const allQ: any[] = []
  let title = ""

  for (let i = 0; i < batches; i++) {
    const done = i * GROQ_BATCH
    const rem  = Math.min(GROQ_BATCH, totalQ - done)

    // Distribuir tipos proporcionalmente en este lote
    const r    = rem / totalQ
    const bMc  = mc  ? Math.max(0, Math.round(mc  * r)) : Math.round(rem * 0.5)
    const bTf  = tf  ? Math.max(0, Math.round(tf  * r)) : Math.round(rem * 0.2)
    const bDev = Math.max(0, rem - bMc - bTf)

    const batchNote = batches > 1
      ? `\n\n[Lote ${i + 1}/${batches}: genera exactamente ${bMc} alternativas, ${bTf} V/F, ${bDev} desarrollo. Total: ${rem}]`
      : ""

    const prompt = basePrompt
      .replace(/Total de preguntas: \d+/, `Total de preguntas: ${rem}`)
      .replace(/- \d+ preguntas de ALTERNATIVAS/, `- ${bMc} preguntas de ALTERNATIVAS`)
      .replace(/- \d+ preguntas de VERDADERO O FALSO/, `- ${bTf} preguntas de VERDADERO O FALSO`)
      .replace(/- \d+ preguntas de DESARROLLO/, `- ${bDev} preguntas de DESARROLLO`)
      + batchNote

    const parsed = await groqBatch(prompt, key)
    const qs     = parsed?.questions ?? parsed?.items ?? []
    allQ.push(...qs)
    if (!title && parsed?.title) title = parsed.title
  }

  return { title, questions: allQ }
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const GEMINI_KEY = process.env.GEMINI_API_KEY
  const GROQ_KEY   = process.env.GROQ_API_KEY

  if (!GEMINI_KEY && !GROQ_KEY) {
    return NextResponse.json({ error: "Sin API keys configuradas (GEMINI_API_KEY o GROQ_API_KEY)" }, { status: 500 })
  }

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { prompt, mode = "full", mc = 0, tf = 0, dev = 0 } = body
  if (!prompt) return NextResponse.json({ error: "prompt requerido" }, { status: 400 })

  // ── Single: regenerar una sola pregunta ────────────────────────────────────
  if (mode === "single") {
    // Primario: Groq
    if (GROQ_KEY) {
      try {
        const parsed = await groqBatch(prompt, GROQ_KEY)
        const q = parsed?.question ?? parsed?.questions?.[0] ?? parsed
        return NextResponse.json({ success: true, question: q, provider: "groq" })
      } catch (e: any) {
        console.warn("[exam-generate/single] Groq falló:", e.message)
      }
    }
    // Fallback: Gemini
    if (GEMINI_KEY) {
      try {
        const parsed = await gemini(prompt, 1, GEMINI_KEY)
        const q = parsed?.question ?? parsed?.questions?.[0] ?? parsed
        return NextResponse.json({ success: true, question: q, provider: "gemini" })
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }
    return NextResponse.json({ error: "Sin providers disponibles" }, { status: 500 })
  }

  // ── Full: examen completo ──────────────────────────────────────────────────
  const totalQ = mc + tf + dev || (() => {
    const m = prompt.match(/Total de preguntas:\s*(\d+)/)
    return m ? parseInt(m[1]) : 15
  })()

  // ── Primario: Groq (soporta 30+ preguntas por lote) ──────────────────────
  if (GROQ_KEY) {
    try {
      const { title, questions } = await groqFull(prompt, totalQ, mc, tf, dev, GROQ_KEY)
      if (questions.length > 0) {
        return NextResponse.json({
          success: true, title, summary: null, questions, provider: "groq",
        })
      }
    } catch (e: any) {
      console.warn("[exam-generate] Groq falló → usando Gemini como fallback:", e.message)
    }
  }

  // ── Fallback: Gemini ───────────────────────────────────────────────────────
  if (!GEMINI_KEY) {
    return NextResponse.json({
      error: "No hay API keys configuradas (GROQ_API_KEY o GEMINI_API_KEY)."
    }, { status: 500 })
  }

  try {
    const parsed    = await gemini(prompt, totalQ, GEMINI_KEY)
    const questions = parsed?.questions ?? parsed?.items ?? []
    if (Array.isArray(questions) && questions.length > 0) {
      return NextResponse.json({
        success: true, title: parsed?.title ?? "", summary: parsed?.summary ?? null,
        questions, provider: "gemini",
      })
    }
    throw new Error("Gemini no generó preguntas")
  } catch (e: any) {
    return NextResponse.json({ error: `Error generando examen: ${e.message}` }, { status: 500 })
  }
}
