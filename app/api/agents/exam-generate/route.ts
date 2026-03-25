/**
 * app/api/agents/exam-generate/route.ts
 *
 * API dedicada para generar preguntas de examen docente.
 * A diferencia de /api/process-content (que usa el schema "quiz" genérico
 * con límites de array), esta API llama directamente a Gemini con un prompt
 * y schema propios que soportan: development, true_false avanzado, ability,
 * maxPoints, rubric y cualquier cantidad de preguntas.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime     = "nodejs"
export const maxDuration = 120

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 })
  }

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { prompt, mode = "full" } = body
  // mode: "full" = examen completo | "single" = una sola pregunta (regenerar)

  if (!prompt) {
    return NextResponse.json({ error: "prompt requerido" }, { status: 400 })
  }

  // Calcular maxOutputTokens según la cantidad de preguntas pedida
  // Cada pregunta ocupa ~400-600 tokens. Para 50 preguntas necesitamos ~25k tokens.
  const totalMatch = prompt.match(/Total de preguntas:\s*(\d+)/)
  const totalQ     = totalMatch ? parseInt(totalMatch[1]) : 15
  const maxTokens  = Math.max(8192, totalQ * 600 + 2000)

  const systemPrompt = `Eres un diseñador experto de evaluaciones escolares en español.
Responde ÚNICAMENTE con JSON válido — sin texto extra, sin backticks, sin markdown.

REGLAS CRÍTICAS PARA LATEX — LEE CON ATENCIÓN:
1. Para matemáticas usa LaTeX con delimitadores $...$ (inline) o $$...$$ (bloque).
2. Todos los comandos LaTeX DEBEN comenzar con la barra invertida REAL: \\
   - CORRECTO: $\\frac{1}{2}$   $\\times$   $x^2 + 3 = 7$
   - INCORRECTO: ↑frac{1}{2}   ↑times   ^frac{1}{2}
3. El carácter ↑ (flecha arriba, Unicode U+2191) NO es una barra invertida.
   NUNCA uses ↑ como sustituto de \\. Usa \\ (backslash real, ASCII 92).
4. Si el texto tiene LaTeX, SIEMPRE enciérralo en $...$:
   - CORRECTO: "$\\frac{1}{x} + 4 = 9$"
   - INCORRECTO: "↑\\frac{1}{x} + 4 = 9"  o  "\\frac{1}{x} + 4 = 9" (sin dólares)
5. Texto normal sin matemáticas NO necesita delimitadores.
6. No uses \\\\( \\\\) ni \\\\[ \\\\].`

  let lastError = ""

  for (const model of MODELS) {
    try {
      const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.4,
          maxOutputTokens: Math.min(maxTokens, 65536),
          responseMimeType: "application/json",
        },
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody) }
      )

      if (!res.ok) {
        const errText = await res.text()
        lastError = `${model} ${res.status}: ${errText.slice(0, 200)}`
        if (res.status === 404 || res.status === 400) continue
        throw new Error(lastError)
      }

      const geminiData = await res.json()
      const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

      if (!raw) { lastError = `${model}: respuesta vacía`; continue }

      let parsed: any
      try {
        // Limpiar el raw: quitar backticks de markdown
        const clean = raw
          .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
        // Luego limpiar caracteres Unicode que Gemini usa como sustituto de \
        const sanitized = clean
          .replace(/[\u2191\u2197\u2B06\u25B2\u2227\u21D2](?=[a-zA-Z])/g, "\\")
        parsed = JSON.parse(sanitized)
      } catch (e: any) {
        lastError = `${model}: JSON inválido — ${e.message}`
        continue
      }

      // Normalizar estructura según mode
      if (mode === "single") {
        // Puede devolver { question: {...} } o { questions: [{...}] } o directamente el objeto
        const q = parsed?.question ?? parsed?.questions?.[0] ?? parsed
        return NextResponse.json({ success: true, question: q, model })
      }

      // mode === "full"
      const questions = parsed?.questions ?? parsed?.items ?? []
      if (!Array.isArray(questions) || questions.length === 0) {
        lastError = `${model}: sin preguntas en respuesta`
        continue
      }

      return NextResponse.json({
        success:   true,
        title:     parsed?.title || "",
        summary:   parsed?.summary || null,
        questions,
        model,
      })

    } catch (err: any) {
      lastError = err?.message || lastError
      if (!err?.message?.includes("404") && !err?.message?.includes("not found")) break
    }
  }

  return NextResponse.json({ error: `Error generando examen: ${lastError}` }, { status: 500 })
}
