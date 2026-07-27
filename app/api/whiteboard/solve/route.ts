import { NextResponse } from "next/server"
import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"
import {
  callPythonMathEngine,
  normalizeLatexForDisplay,
  solveDeterministically,
} from "@/lib/whiteboard/math-engine"
import type {
  WhiteboardSolveMode,
  WhiteboardSolveResult,
} from "@/lib/whiteboard/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 45

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" }
const MODES = new Set<WhiteboardSolveMode>(["solve", "verify", "hint", "explain", "graph"])

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function cleanLines(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((line) => cleanText(line, 2500)).filter(Boolean).slice(0, 30)
}

function parseJson(value: string) {
  const cleaned = value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error("La IA no devolvió JSON válido")
  }
}

function normalizeAiResult(payload: any, latex: string): WhiteboardSolveResult {
  const steps = Array.isArray(payload?.steps)
    ? payload.steps.slice(0, 18).map((step: any, index: number) => ({
        index: index + 1,
        explanation: cleanText(step?.explanation, 1200),
        latex: normalizeLatexForDisplay(cleanText(step?.latex, 2200)),
        valid: typeof step?.valid === "boolean" ? step.valid : null,
      }))
    : []
  const verificationLines = Array.isArray(payload?.verification?.lines)
    ? payload.verification.lines.slice(0, 30).map((line: any, index: number) => ({
        index,
        latex: normalizeLatexForDisplay(cleanText(line?.latex, 2200)),
        valid: typeof line?.valid === "boolean" ? line.valid : null,
        message: cleanText(line?.message, 1200),
        operation: cleanText(line?.operation, 300) || null,
      }))
    : undefined
  return {
    normalizedLatex: normalizeLatexForDisplay(cleanText(payload?.normalizedLatex, 8000)) || latex,
    classification: cleanText(payload?.classification, 160) || "advanced-math",
    steps,
    answerLatex: normalizeLatexForDisplay(cleanText(payload?.answerLatex, 5000)),
    explanation: cleanText(payload?.explanation, 7000),
    verified: false,
    engine: "ai-assisted",
    verification: payload?.verification
      ? {
          valid: typeof payload.verification.valid === "boolean" ? payload.verification.valid : null,
          substitutionLatex: normalizeLatexForDisplay(cleanText(payload.verification.substitutionLatex, 3000)) || undefined,
          message: cleanText(payload.verification.message, 1800) || undefined,
          lines: verificationLines,
        }
      : null,
    graph: null,
    warning: "Resultado asistido por IA. Revisa los pasos importantes; no fue validado por el motor simbólico.",
  }
}

async function solveWithAI(latex: string, lines: string[], mode: WhiteboardSolveMode) {
  const prompt = `Analiza este problema matemático y devuelve SOLO JSON válido, sin markdown externo.
Expresión principal en LaTeX: ${latex}
${lines.length > 1 ? `Procedimiento escrito, una línea por paso:\n${lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}` : ""}
Modo solicitado: ${mode}.

Reglas:
- No inventes datos ausentes.
- Toda matemática debe ir en LaTeX sin delimitadores $.
- Si verificas un procedimiento, marca cada línea como true, false o null cuando no sea demostrable.
- Si el modo es hint, entrega una pista útil sin revelar la respuesta final completa.
- Si el problema es ambiguo, indícalo en warning.

Esquema:
{
  "normalizedLatex":"",
  "classification":"",
  "steps":[{"explanation":"","latex":"","valid":true}],
  "answerLatex":"",
  "explanation":"",
  "verification":{"valid":true,"substitutionLatex":"","message":"","lines":[{"latex":"","valid":true,"message":"","operation":""}]},
  "warning":""
}`

  const response = await callAI([
    {
      role: "system",
      content: "Eres el motor pedagógico de una pizarra matemática. Respondes JSON estricto en español y conservas LaTeX correcto.",
    },
    { role: "user", content: prompt },
  ], { maxTokens: 5000, preferProvider: "gemini" })
  return normalizeAiResult(parseJson(response.text), latex)
}

async function addPedagogicalExplanation(result: WhiteboardSolveResult, mode: WhiteboardSolveMode) {
  if (mode === "graph" || mode === "hint" || result.engine === "ai-assisted") return result
  try {
    const response = await callAI([
      {
        role: "system",
        content: `Eres un profesor de matemáticas. Explica resultados ya calculados por un motor matemático. No cambies la respuesta, no agregues resultados distintos y usa LaTeX entre $...$ o $$...$$. Responde en español con claridad.`,
      },
      {
        role: "user",
        content: `Problema: $$${result.normalizedLatex}$$
Clasificación: ${result.classification}
Pasos verificados: ${JSON.stringify(result.steps)}
Respuesta verificada: $$${result.answerLatex}$$
Modo: ${mode}
Escribe una explicación pedagógica breve, indicando la operación realizada en cada paso y una comprobación final.`,
      },
    ], { maxTokens: 1800, preferProvider: "gemini" })
    return { ...result, explanation: response.text || result.explanation }
  } catch {
    return result
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión para usar el motor matemático." }, { status: 401, headers: NO_CACHE })

    const body = await request.json()
    const latex = normalizeLatexForDisplay(cleanText(body?.latex, 8000))
    const lines = cleanLines(body?.lines)
    const mode: WhiteboardSolveMode = MODES.has(body?.mode) ? body.mode : "solve"
    if (!latex && !lines.length) {
      return NextResponse.json({ error: "Selecciona o escribe una expresión matemática antes de continuar." }, { status: 400, headers: NO_CACHE })
    }
    const primaryLatex = latex || lines[0]

    let result = await callPythonMathEngine({ latex: primaryLatex, lines, mode })
    if (!result) result = solveDeterministically(primaryLatex, lines)
    if (!result || (mode === "verify" && result.verification?.lines?.some((line) => line.valid === null))) {
      try {
        result = await solveWithAI(primaryLatex, lines, mode)
      } catch (error) {
        if (!result) throw error
      }
    }

    if (mode === "hint") {
      const firstStep = result.steps[0]
      result = {
        ...result,
        answerLatex: "",
        steps: firstStep ? [firstStep] : [],
        explanation: firstStep?.explanation || "Identifica la operación principal y aplícala de forma equivalente en ambos lados.",
      }
    } else {
      result = await addPedagogicalExplanation(result, mode)
    }

    return NextResponse.json({ result }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[whiteboard/solve]", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "No fue posible procesar el problema matemático.",
    }, { status: 500, headers: NO_CACHE })
  }
}
