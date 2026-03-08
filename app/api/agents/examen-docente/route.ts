// src/app/api/agents/examen-docente/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let code = ""
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function calcGrade(score: number, exigencia = 60): number {
  const pct = Math.max(0, Math.min(100, score))
  let nota: number
  if (pct >= exigencia) {
    nota = 4.0 + ((pct - exigencia) * 3.0) / (100 - exigencia)
  } else {
    nota = 1.0 + (pct * 3.0) / exigencia
  }
  return Math.round(nota * 10) / 10
}

function getQuestionMaxPoints(question: any): number {
  if (!question) return 1
  if (typeof question.maxPoints === "number" && question.maxPoints > 0) return question.maxPoints
  if (question.type === "true_false") {
    const selectionPoints = typeof question.selectionPoints === "number" ? question.selectionPoints : 1
    const justificationMaxPoints = typeof question.justificationMaxPoints === "number" ? question.justificationMaxPoints : 2
    return selectionPoints + justificationMaxPoints
  }
  if (question.type === "development") {
    if (Array.isArray(question.rubric) && question.rubric.length > 0) {
      const sum = question.rubric.reduce((acc: number, item: any) => acc + (Number(item?.points) || 0), 0)
      if (sum > 0) return sum
    }
    return 5
  }
  return 1
}

async function evaluateWithAI(questions: any[], answers: any[]): Promise<any[]> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return answers

  const toEvaluate: { index: number; question: string; type: string; studentAnswer: string; modelAnswer?: string; rubric?: any[]; maxPoints?: number; correctAnswer?: number; selectedOption?: string }[] = []

  answers.forEach((a, i) => {
    const q = questions[i]
    if (!q) return

    if (q.type === "development" && a.devText) {
      toEvaluate.push({
        index: i,
        question: q.question,
        type: "development",
        studentAnswer: a.devText,
        modelAnswer: q.modelAnswer || "",
        rubric: q.rubric || [],
        maxPoints: getQuestionMaxPoints(q),
      })
    }

    if (q.type === "true_false" && a.justification) {
      toEvaluate.push({
        index: i,
        question: q.question,
        type: "true_false",
        studentAnswer: a.justification,
        correctAnswer: q.correctAnswer,
        selectedOption: q.options?.[a.selectedAnswer] || "",
        modelAnswer: q.explanation || "",
        maxPoints: typeof q.justificationMaxPoints === "number" ? q.justificationMaxPoints : 2,
      })
    }
  })

  if (toEvaluate.length === 0) return answers

  const prompt = `Eres un evaluador educativo estricto pero justo. Evalúa las siguientes respuestas de un estudiante.

REGLAS:
- Para DESARROLLO: evalúa de 0 a maxPoints según la rúbrica y la respuesta modelo. Da puntaje parcial si hay aciertos parciales.
- Para VERDADERO/FALSO con justificación: evalúa la justificación de 0 a maxPoints según la calidad de la justificación. La selección V/F ya se evaluó aparte.
- Sé justo: si el estudiante demuestra comprensión aunque use otras palabras, dale crédito.
- Responde SOLO con JSON válido, sin backticks ni markdown.

PREGUNTAS A EVALUAR:
${toEvaluate.map((e, idx) => `
[${idx}] Tipo: ${e.type}
Pregunta: ${e.question}
${e.type === "development" ? `Respuesta modelo: ${e.modelAnswer}
Rúbrica: ${JSON.stringify(e.rubric)}
Puntaje máximo: ${e.maxPoints}` : `Opción correcta: ${e.correctAnswer === 0 ? "Verdadero" : "Falso"}
Estudiante eligió: ${e.selectedOption}
Explicación correcta: ${e.modelAnswer}
Puntaje máximo de justificación: ${e.maxPoints}`}
Respuesta del estudiante: ${e.studentAnswer}
`).join("
")}

Responde con este JSON exacto:
{
  "evaluations": [
    {
      "index": 0,
      "score": <número>,
      "maxScore": <número>,
      "feedback": "retroalimentación breve y constructiva en español",
      "isCorrect": true/false
    }
  ]
}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: "Eres un evaluador educativo. Responde SOLO con JSON válido." }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(25000),
      }
    )

    if (!res.ok) throw new Error(`Gemini ${res.status}`)

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error("Empty response")

    const parsed = JSON.parse(text)
    const evals = parsed.evaluations || []

    for (const ev of evals) {
      const origIndex = toEvaluate[ev.index]?.index
      if (origIndex === undefined) continue

      answers[origIndex].aiScore = ev.score
      answers[origIndex].aiMaxScore = ev.maxScore
      answers[origIndex].aiFeedback = ev.feedback
      answers[origIndex].aiEvaluated = true

      if (questions[origIndex].type === "development") {
        answers[origIndex].isCorrect = ev.score >= (ev.maxScore * 0.5)
      }
      if (questions[origIndex].type === "true_false") {
        answers[origIndex].justificationScore = ev.score
        answers[origIndex].justificationFeedback = ev.feedback
      }
    }
  } catch (err: any) {
    console.error("AI evaluation error:", err.message)
    toEvaluate.forEach(e => {
      answers[e.index].aiEvaluated = false
      answers[e.index].aiFeedback = "Pendiente de revisión manual"
    })
  }

  return answers
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === "create") {
      const { teacherId, title, topic, instructions, questions, settings } = body
      if (!teacherId || !title || !topic || !questions?.length) {
        return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
      }

      let code = generateCode()
      for (let i = 0; i < 10; i++) {
        const { data: existing } = await supabase.from("teacher_exams").select("code").eq("code", code).maybeSingle()
        if (!existing) break
        code = generateCode()
      }

      const { data, error } = await supabase
        .from("teacher_exams")
        .insert({
          teacher_id: teacherId,
          code,
          title,
          topic,
          instructions: instructions || null,
          questions,
          settings: { ...settings },
          status: "active",
        })
        .select().single()

      if (error) throw error
      return NextResponse.json({ success: true, exam: data, code })
    }

    if (action === "submit") {
      const { examId, studentName, studentCourse, studentRut, answers, questions, timeSpent, examPercentage } = body

      if (!examId || !studentName || !studentCourse || !answers || !questions) {
        return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
      }

      let gradedAnswers = answers.map((a: any, i: number) => {
        const q = questions[i]
        if (!q) return { questionIndex: i, selectedAnswer: -1, isCorrect: false }

        if (q.type === "development") {
          return {
            questionIndex: i,
            type: "development",
            devText: a.devText || "",
            isCorrect: false,
            maxPoints: getQuestionMaxPoints(q),
          }
        }

        if (q.type === "true_false") {
          const tfCorrect = a.selectedAnswer === q.correctAnswer
          return {
            questionIndex: i,
            type: "true_false",
            selectedAnswer: a.selectedAnswer,
            isCorrect: tfCorrect,
            justification: a.justification || "",
            selectionPoints: typeof q.selectionPoints === "number" ? q.selectionPoints : 1,
            justificationMaxPoints: typeof q.justificationMaxPoints === "number" ? q.justificationMaxPoints : Math.max(0, getQuestionMaxPoints(q) - (typeof q.selectionPoints === "number" ? q.selectionPoints : 1)),
            maxPoints: getQuestionMaxPoints(q),
          }
        }

        const isCorrect = a.selectedAnswer === q.correctAnswer
        return {
          questionIndex: i,
          type: "multiple_choice",
          selectedAnswer: a.selectedAnswer,
          isCorrect,
          maxPoints: getQuestionMaxPoints(q),
        }
      })

      gradedAnswers = await evaluateWithAI(questions, gradedAnswers)

      let totalPoints = 0
      let earnedPoints = 0

      gradedAnswers.forEach((a: any, i: number) => {
        const q = questions[i]
        if (!q) return

        if (q.type === "multiple_choice") {
          const maxP = getQuestionMaxPoints(q)
          totalPoints += maxP
          if (a.isCorrect) earnedPoints += maxP
        }

        if (q.type === "true_false") {
          const selectionPoints = typeof q.selectionPoints === "number" ? q.selectionPoints : 1
          const justificationMaxPoints = typeof q.justificationMaxPoints === "number" ? q.justificationMaxPoints : Math.max(0, getQuestionMaxPoints(q) - selectionPoints)
          totalPoints += selectionPoints + justificationMaxPoints
          if (a.isCorrect) earnedPoints += selectionPoints
          earnedPoints += Math.min(justificationMaxPoints, a.justificationScore || 0)
        }

        if (q.type === "development") {
          const maxP = getQuestionMaxPoints(q)
          totalPoints += maxP
          earnedPoints += Math.min(maxP, a.aiScore || 0)
        }
      })

      const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
      const grade = calcGrade(score, examPercentage || 60)

      const { data, error } = await supabase
        .from("exam_submissions")
        .insert({
          exam_id: examId,
          student_name: studentName,
          student_course: studentCourse,
          student_rut: studentRut || null,
          answers: gradedAnswers,
          score: Math.round(score * 10) / 10,
          grade,
          correct_count: Math.round(earnedPoints * 10) / 10,
          total_questions: questions.length,
          time_spent: timeSpent || null,
        })
        .select().single()

      if (error) throw error
      return NextResponse.json({ success: true, submission: data })
    }

    if (action === "close") {
      const { examId, teacherId } = body
      await supabase.from("teacher_exams").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", examId).eq("teacher_id", teacherId)
      return NextResponse.json({ success: true })
    }

    if (action === "reopen") {
      const { examId, teacherId } = body
      await supabase.from("teacher_exams").update({ status: "active", closed_at: null }).eq("id", examId).eq("teacher_id", teacherId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (err: any) {
    console.error("Exam API error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const teacherId = searchParams.get("teacherId")
    const examId = searchParams.get("examId")

    if (code) {
      const { data, error } = await supabase
        .from("teacher_exams")
        .select("id, code, title, topic, instructions, questions, settings, status")
        .eq("code", code).maybeSingle()
      if (error || !data) return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })
      if (data.status !== "active") return NextResponse.json({ error: "Examen cerrado" }, { status: 403 })
      return NextResponse.json({ exam: data })
    }

    if (examId) {
      const { data: exam } = await supabase.from("teacher_exams").select("*").eq("id", examId).maybeSingle()
      const { data: submissions } = await supabase.from("exam_submissions").select("*").eq("exam_id", examId).order("submitted_at", { ascending: true })
      return NextResponse.json({ exam, submissions: submissions || [] })
    }

    if (teacherId) {
      const { data } = await supabase.from("teacher_exams").select("id, code, title, topic, status, created_at, settings").eq("teacher_id", teacherId).order("created_at", { ascending: false })
      const examsWithCount = await Promise.all(
        (data || []).map(async (exam) => {
          const { count } = await supabase.from("exam_submissions").select("*", { count: "exact", head: true }).eq("exam_id", exam.id)
          return { ...exam, submissionCount: count || 0 }
        })
      )
      return NextResponse.json({ exams: examsWithCount })
    }

    return NextResponse.json({ error: "Parámetros faltantes" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
