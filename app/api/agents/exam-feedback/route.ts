// app/api/agents/exam-feedback/route.ts
// Retroalimentación pedagógica basada en la pauta oficial del docente.
// La IA solo explica el concepto cuando la pauta no trae explicación; nunca cambia la respuesta correcta.
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { runAIStructured } from "@/lib/ai/gateway"
import { enrichQuestionAnswerKey } from "@/lib/exam/question-quality"
import {
  formatPoints,
  getMixedChoiceDevelopmentPointBreakdown,
  getQuestionMaxPoints,
  getTrueFalsePointBreakdown,
} from "@/lib/exam/grading"
import { buildReadableDevelopmentAnswer, normalizeMathTextForDisplay } from "@/lib/exam/latex-response"

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!url || !key) throw new Error("Supabase no está configurado para retroalimentación")
  return createClient(url, key)
}

function cleanText(value: unknown): string {
  return normalizeMathTextForDisplay(String(value ?? "").trim())
}

function configuredExplanation(question: any): string {
  const explanation = cleanText(question?.explanation)
  if (explanation) return explanation

  const steps = Array.isArray(question?.solutionSteps)
    ? question.solutionSteps.map(cleanText).filter(Boolean)
    : []
  if (steps.length > 0) return steps.join(" ")

  if (question?.type === "development" || question?.type === "mixed_choice_development") {
    return cleanText(question?.modelAnswer || question?.expectedLatex)
  }

  return ""
}

type FeedbackEnrichment = {
  index: number
  explanation: string
  misconception: string
  studyTip: string
}

function selectionIndex(answer: any): number | null {
  const value = Number(answer?.selectedAnswer)
  return Number.isInteger(value) && value >= 0 ? value : null
}

function genericConceptFallback(question: any): string {
  const q = enrichQuestionAnswerKey(question)
  const correctAnswer = cleanText(q.answerText || q.correctAnswerText || q.options?.[q.correctAnswer])
  if (!correctAnswer) return "Revisa el concepto central evaluado en esta pregunta y compáralo con la pauta."
  return `La idea clave es reconocer qué condición del enunciado hace que esa alternativa sea la adecuada.`
}

async function generatePedagogicalEnrichment(questions: any[], answers: any[]) {
  const items = questions
    .map((rawQuestion: any, index: number) => {
      const question = enrichQuestionAnswerKey(rawQuestion)
      if (question.type !== "multiple_choice" || configuredExplanation(question)) return null

      const selected = selectionIndex(answers[index])
      const correctIndex = Number(question.correctAnswer)
      return {
        index,
        question: cleanText(question.question || question.statement),
        options: Array.isArray(question.options) ? question.options.map(cleanText) : [],
        correctAnswer: cleanText(question.answerText || question.correctAnswerText || question.options?.[correctIndex]),
        selectedAnswer: selected != null ? cleanText(question.options?.[selected]) : "",
        answered: selected != null,
        correct: selected != null && selected === correctIndex,
      }
    })
    .filter(Boolean)

  if (!items.length) return new Map<number, FeedbackEnrichment>()

  try {
    const result = await runAIStructured<{ items: FeedbackEnrichment[] }>({
      messages: [
        {
          role: "system",
          content:
            "Eres el agente de retroalimentación pedagógica de EduAI. Recibes preguntas de alternativa, la respuesta oficial y la respuesta del estudiante. La pauta oficial es inmutable: nunca cambies cuál alternativa es correcta. Genera explicaciones breves, claras y apropiadas para estudiantes escolares. No repitas simplemente la respuesta correcta, porque la interfaz ya la muestra. Explica el concepto o razonamiento que permite decidirla. Si el estudiante se equivocó, explica de forma respetuosa qué idea de su alternativa puede confundir y cómo distinguirla. Si no respondió, no lo llames incorrecto. Para balanceo químico cuenta átomos explícitamente. Para preguntas de lectura usa solo la información entregada en el enunciado. Mantén cada explanation entre 20 y 55 palabras, misconception entre 0 y 35 palabras y studyTip entre 0 y 20 palabras. Español de Chile, tono pedagógico y directo.",
        },
        {
          role: "user",
          content: JSON.stringify({ items }),
        },
      ],
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "integer" },
                explanation: { type: "string" },
                misconception: { type: "string" },
                studyTip: { type: "string" },
              },
              required: ["index", "explanation", "misconception", "studyTip"],
            },
          },
        },
        required: ["items"],
      },
      maxOutputTokens: Math.min(3200, Math.max(900, items.length * 180)),
      lite: true,
    })

    const map = new Map<number, FeedbackEnrichment>()
    for (const raw of Array.isArray(result.data?.items) ? result.data.items : []) {
      const index = Number(raw?.index)
      if (!Number.isInteger(index)) continue
      map.set(index, {
        index,
        explanation: cleanText(raw?.explanation),
        misconception: cleanText(raw?.misconception),
        studyTip: cleanText(raw?.studyTip),
      })
    }
    return map
  } catch (error) {
    console.warn("[exam-feedback/pedagogical-enrichment]", error)
    return new Map<number, FeedbackEnrichment>()
  }
}

function buildConfiguredFeedback(question: any, answer: any, enrichment?: FeedbackEnrichment): string {
  const q = enrichQuestionAnswerKey(question)
  const teacherExplanation = configuredExplanation(q)
  const explanation = teacherExplanation || enrichment?.explanation || genericConceptFallback(q)
  const tip = enrichment?.studyTip ? ` Recuerda: ${enrichment.studyTip}` : ""

  if (q.type === "multiple_choice") {
    const selected = selectionIndex(answer)
    const answered = selected != null && selected < (Array.isArray(q.options) ? q.options.length : 0)
    const correct = answered && selected === q.correctAnswer

    if (!answered) {
      return `No registraste una respuesta en esta pregunta. ${explanation}${tip}`
    }

    if (correct) {
      return `Bien resuelto. ${explanation}${tip}`
    }

    const misconception = enrichment?.misconception
      ? `${enrichment.misconception} `
      : "La alternativa elegida no cumple la condición central del enunciado. "
    return `${misconception}${explanation}${tip}`
  }

  if (q.type === "mixed_choice_development") {
    const selected = selectionIndex(answer)
    const selectedCorrect = selected != null && selected === q.correctAnswer
    const correctAnswer = cleanText(q.answerText || q.options?.[q.correctAnswer]) || "la alternativa indicada en la pauta"
    const { selectionPoints, developmentMaxPoints } = getMixedChoiceDevelopmentPointBreakdown(q)
    const developmentScore = Math.max(
      0,
      Math.min(developmentMaxPoints, Number(answer?.manualDevelopmentScore ?? answer?.developmentScore ?? answer?.aiScore) || 0),
    )
    const pointsText = `${formatPoints((selectedCorrect ? selectionPoints : 0) + developmentScore)}/${formatPoints(selectionPoints + developmentMaxPoints)} pts`
    const readableDevelopment = buildReadableDevelopmentAnswer(answer)
    const studentEvidence = readableDevelopment ? ` Desarrollo reconocido: ${readableDevelopment}.` : ""
    if (selected == null) {
      return `No registraste una alternativa (${pointsText}).${studentEvidence} ${explanation}`
    }
    return selectedCorrect
      ? `Alternativa correcta (${pointsText}).${studentEvidence} ${explanation}`
      : `La alternativa elegida no coincide con la pauta (${pointsText}). La respuesta esperada es ${correctAnswer}.${studentEvidence} ${explanation}`
  }

  if (q.type === "true_false") {
    const selected = selectionIndex(answer)
    const correct = selected != null && selected === q.correctAnswer
    const answerLabel = cleanText(q.answerText) || (q.correctAnswer === 0 ? "Verdadero" : "Falso")
    const { selectionPoints, justificationMaxPoints } = getTrueFalsePointBreakdown(q)
    const justificationScore = Math.max(0, Math.min(justificationMaxPoints, Number(answer?.justificationScore) || 0))
    const pointsText = `${formatPoints((correct ? selectionPoints : 0) + justificationScore)}/${formatPoints(selectionPoints + justificationMaxPoints)} pts`
    if (selected == null) return `No registraste una selección (${pointsText}). ${explanation || `La respuesta esperada es ${answerLabel}.`}`
    return correct
      ? `La selección ${answerLabel} es correcta (${pointsText}). ${explanation}`
      : `La selección no coincide con la pauta (${pointsText}). La respuesta esperada es ${answerLabel}. ${explanation}`
  }

  const maxPoints = getQuestionMaxPoints(q)
  const score = Math.max(0, Math.min(maxPoints, Number(answer?.manualScore ?? answer?.aiScore) || 0))
  const modelAnswer = cleanText(q.modelAnswer || q.expectedLatex)
  const readableDevelopment = buildReadableDevelopmentAnswer(answer)
  const studentEvidence = readableDevelopment ? ` Desarrollo reconocido: ${readableDevelopment}.` : ""
  const reference = modelAnswer ? ` Respuesta modelo: ${modelAnswer}` : ""
  return `Puntaje registrado: ${formatPoints(score)}/${formatPoints(maxPoints)} pts.${studentEvidence} ${explanation}${reference}`
}

export async function POST(req: NextRequest) {
  try {
    const { submissionId } = await req.json()
    if (!submissionId) {
      return NextResponse.json({ error: "submissionId requerido", feedback: [] }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: submission, error: submissionError } = await supabase
      .from("exam_submissions")
      .select("id, exam_id, answers")
      .eq("id", submissionId)
      .maybeSingle()

    if (submissionError || !submission) {
      return NextResponse.json({ error: "Entrega no encontrada", feedback: [] }, { status: 404 })
    }

    const { data: exam, error: examError } = await supabase
      .from("teacher_exams")
      .select("id, questions, settings")
      .eq("id", submission.exam_id)
      .maybeSingle()

    if (examError || !exam) {
      return NextResponse.json({ error: "Examen no encontrado", feedback: [] }, { status: 404 })
    }

    if (exam.settings?.showResultToStudent === false) {
      return NextResponse.json({ feedback: [] })
    }

    const questions = Array.isArray(exam.questions) ? exam.questions : []
    const answers = Array.isArray(submission.answers) ? submission.answers : []
    const enrichment = await generatePedagogicalEnrichment(questions, answers)
    const feedback = questions.map((question: any, index: number) => ({
      index,
      text: buildConfiguredFeedback(question, answers[index] || {}, enrichment.get(index)),
    }))

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error("[exam-feedback]", error)
    return NextResponse.json({ feedback: [] })
  }
}
