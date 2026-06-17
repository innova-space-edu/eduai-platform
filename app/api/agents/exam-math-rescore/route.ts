import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculateGradeFromPercentage, calculateScoreSummary, getQuestionMaxPoints, normalizeExamPercentage } from "@/lib/exam/grading"
import { buildReadableDevelopmentAnswer, normalizeLatexSource } from "@/lib/exam/latex-response"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false } },
)

type Fraction = { n: number; d: number }

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}

function reduceFraction(frac: Fraction): Fraction {
  const sign = frac.d < 0 ? -1 : 1
  const n = frac.n * sign
  const d = Math.abs(frac.d)
  const div = gcd(n, d)
  return { n: n / div, d: d / div }
}

function sameFraction(a: Fraction, b: Fraction): boolean {
  if (!a.d || !b.d) return false
  const ra = reduceFraction(a)
  const rb = reduceFraction(b)
  return ra.n === rb.n && ra.d === rb.d
}

function extractFractions(value: unknown): Fraction[] {
  const text = buildReadableDevelopmentAnswer({ devText: value, developmentLatex: value })
  const result: Fraction[] = []

  for (const match of text.matchAll(/(-?\d+)\s*\/\s*(-?\d+)/g)) {
    const n = Number(match[1])
    const d = Number(match[2])
    if (Number.isFinite(n) && Number.isFinite(d) && d !== 0) result.push({ n, d })
  }

  for (const match of text.matchAll(/\\frac\s*\{\s*(-?\d+)\s*\}\s*\{\s*(-?\d+)\s*\}/g)) {
    const n = Number(match[1])
    const d = Number(match[2])
    if (Number.isFinite(n) && Number.isFinite(d) && d !== 0) result.push({ n, d })
  }

  return result
}

function equivalentResult(student: unknown, expected: unknown): boolean {
  const s = extractFractions(student)
  const e = extractFractions(expected)
  if (s.length > 0 && e.length > 0) return sameFraction(s[s.length - 1], e[e.length - 1])

  const sText = buildReadableDevelopmentAnswer({ devText: student, developmentLatex: student })
  const eText = buildReadableDevelopmentAnswer({ devText: expected, developmentLatex: expected })
  const sNum = Array.from(sText.matchAll(/-?\d+(?:[.,]\d+)?/g)).map((m) => Number(m[0].replace(",", "."))).filter(Number.isFinite)
  const eNum = Array.from(eText.matchAll(/-?\d+(?:[.,]\d+)?/g)).map((m) => Number(m[0].replace(",", "."))).filter(Number.isFinite)
  if (sNum.length > 0 && eNum.length > 0) return Math.abs(sNum[sNum.length - 1] - eNum[eNum.length - 1]) < 1e-9
  return false
}

function expectedAnswer(question: any): string {
  return String(question?.modelAnswer || question?.expectedLatex || question?.expectedAnswer || question?.answerText || question?.correctAnswerText || "")
}

function studentAnswer(answer: any): string {
  return buildReadableDevelopmentAnswer({
    ...answer,
    developmentLatex: answer?.developmentLatex || answer?.developmentLatexSource || "",
  })
}

function rescore(questions: any[], answers: any[]) {
  let changed = false
  const next = answers.map((answer: any, index: number) => {
    const question = questions[index]
    if (!question || question.type !== "development") return answer

    const readable = studentAnswer(answer)
    const expected = expectedAnswer(question)
    const maxPoints = getQuestionMaxPoints(question)
    const current = Number(answer?.manualScore ?? answer?.aiScore ?? 0) || 0

    const base = {
      ...answer,
      devText: readable || answer?.devText || "",
      developmentLatex: normalizeLatexSource(answer?.developmentLatex || answer?.developmentLatexSource || ""),
      developmentRenderedText: readable,
    }

    if (!equivalentResult(readable, expected) || current >= maxPoints) return base

    changed = true
    return {
      ...base,
      manualScore: maxPoints,
      aiScore: maxPoints,
      aiMaxScore: maxPoints,
      aiEvaluated: true,
      isCorrect: true,
      aiFeedback: `Corrección automática matemática: el resultado reconocido coincide con la respuesta modelo (${maxPoints}/${maxPoints} pts).`,
    }
  })

  return { answers: next, changed }
}

async function rescoreSubmission(submission: any, exam: any) {
  const questions = Array.isArray(exam.questions) ? exam.questions : []
  const answers = Array.isArray(submission.answers) ? submission.answers : []
  const result = rescore(questions, answers)

  if (!result.changed) return { changed: false, submission }

  const summary = calculateScoreSummary(questions, result.answers)
  const grade = calculateGradeFromPercentage(summary.percentage, normalizeExamPercentage(exam.settings?.examPercentage ?? 60))

  const { data: updated, error: updateError } = await supabase
    .from("exam_submissions")
    .update({
      answers: result.answers,
      score: summary.percentage,
      grade,
      correct_count: summary.correctCount,
      earned_points: summary.earnedPoints,
      total_points: summary.totalPoints,
    })
    .eq("id", submission.id)
    .select()
    .single()

  if (updateError) throw updateError
  return { changed: true, submission: updated }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const submissionId = String(body?.submissionId || "")
    const examId = String(body?.examId || "")

    if (!submissionId && !examId) {
      return NextResponse.json({ success: false, error: "submissionId o examId requerido" }, { status: 400 })
    }

    if (examId) {
      const { data: exam, error: examError } = await supabase
        .from("teacher_exams")
        .select("id, questions, settings")
        .eq("id", examId)
        .maybeSingle()

      if (examError || !exam) return NextResponse.json({ success: false, error: "Examen no encontrado" }, { status: 404 })

      const { data: submissions, error: submissionsError } = await supabase
        .from("exam_submissions")
        .select("id, exam_id, answers")
        .eq("exam_id", examId)

      if (submissionsError) throw submissionsError

      let changedCount = 0
      for (const submission of submissions || []) {
        const result = await rescoreSubmission(submission, exam)
        if (result.changed) changedCount++
      }

      return NextResponse.json({ success: true, changed: changedCount > 0, changedCount })
    }

    const { data: submission, error: submissionError } = await supabase
      .from("exam_submissions")
      .select("id, exam_id, answers")
      .eq("id", submissionId)
      .maybeSingle()

    if (submissionError || !submission) return NextResponse.json({ success: false, error: "Entrega no encontrada" }, { status: 404 })

    const { data: exam, error: examError } = await supabase
      .from("teacher_exams")
      .select("id, questions, settings")
      .eq("id", submission.exam_id)
      .maybeSingle()

    if (examError || !exam) return NextResponse.json({ success: false, error: "Examen no encontrado" }, { status: 404 })

    const result = await rescoreSubmission(submission, exam)
    return NextResponse.json({ success: true, changed: result.changed, submission: result.submission })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "No se pudo recalcular" }, { status: 500 })
  }
}
