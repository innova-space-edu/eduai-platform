// app/api/agents/exam-feedback/route.ts
// Retroalimentación determinística basada en la pauta creada por el docente.
// No se confía en una clave de respuestas enviada desde el navegador.
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enrichQuestionAnswerKey } from "@/lib/exam/question-quality"
import { formatPoints, getMixedChoiceDevelopmentPointBreakdown, getQuestionMaxPoints, getTrueFalsePointBreakdown } from "@/lib/exam/grading"
import { buildReadableDevelopmentAnswer, normalizeMathTextForDisplay } from "@/lib/exam/latex-response"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

function cleanText(value: unknown): string {
  return normalizeMathTextForDisplay(String(value ?? "").trim())
}

function joinConfiguredExplanation(question: any): string {
  const explanation = cleanText(question?.explanation)
  if (explanation) return explanation

  const steps = Array.isArray(question?.solutionSteps)
    ? question.solutionSteps.map(cleanText).filter(Boolean)
    : []
  if (steps.length > 0) return steps.join(" ")

  if (question?.type === "development" || question?.type === "mixed_choice_development") {
    return cleanText(question?.modelAnswer || question?.expectedLatex)
  }

  return "Revisa la pauta entregada por tu docente."
}

function buildConfiguredFeedback(question: any, answer: any): string {
  const q = enrichQuestionAnswerKey(question)
  const explanation = joinConfiguredExplanation(q)

  if (q.type === "multiple_choice") {
    const correct = answer?.selectedAnswer === q.correctAnswer
    const correctAnswer = cleanText(q.answerText || q.options?.[q.correctAnswer]) || "la alternativa indicada en la pauta"
    return correct
      ? `Respuesta correcta. ${explanation}`
      : `Tu respuesta no coincide con la pauta. La respuesta correcta es: ${correctAnswer}. ${explanation}`
  }

  if (q.type === "mixed_choice_development") {
    const selectedCorrect = answer?.selectedAnswer === q.correctAnswer
    const correctAnswer = cleanText(q.answerText || q.options?.[q.correctAnswer]) || "la alternativa indicada en la pauta"
    const { selectionPoints, developmentMaxPoints } = getMixedChoiceDevelopmentPointBreakdown(q)
    const developmentScore = Math.max(0, Math.min(developmentMaxPoints, Number(answer?.manualDevelopmentScore ?? answer?.developmentScore ?? answer?.aiScore) || 0))
    const pointsText = `${formatPoints((selectedCorrect ? selectionPoints : 0) + developmentScore)}/${formatPoints(selectionPoints + developmentMaxPoints)} pts`
    const readableDevelopment = buildReadableDevelopmentAnswer(answer)
    const studentEvidence = readableDevelopment ? ` Desarrollo reconocido: ${readableDevelopment}.` : ""
    return selectedCorrect
      ? `Alternativa correcta (${pointsText}).${studentEvidence} ${explanation}`
      : `La alternativa no coincide con la pauta (${pointsText}). La respuesta correcta es: ${correctAnswer}.${studentEvidence} ${explanation}`
  }

  if (q.type === "true_false") {
    const correct = answer?.selectedAnswer === q.correctAnswer
    const answerLabel = cleanText(q.answerText) || (q.correctAnswer === 0 ? "Verdadero" : "Falso")
    const { selectionPoints, justificationMaxPoints } = getTrueFalsePointBreakdown(q)
    const justificationScore = Math.max(0, Math.min(justificationMaxPoints, Number(answer?.justificationScore) || 0))
    const pointsText = `${formatPoints((correct ? selectionPoints : 0) + justificationScore)}/${formatPoints(selectionPoints + justificationMaxPoints)} pts`
    return correct
      ? `La selección ${answerLabel} es correcta (${pointsText}). ${explanation}`
      : `La selección no coincide con la pauta (${pointsText}). La respuesta correcta es ${answerLabel}. ${explanation}`
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
    const feedback = questions.map((question: any, index: number) => ({
      index,
      text: buildConfiguredFeedback(question, answers[index] || {}),
    }))

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error("[exam-feedback]", error)
    return NextResponse.json({ feedback: [] })
  }
}
