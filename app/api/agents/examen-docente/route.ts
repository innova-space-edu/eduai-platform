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

function clampPositive(n: number, fallback = 1): number {
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.round(n * 10) / 10)
}

function normalizeCorrectAnswer(
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

    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) {
      return Math.max(0, Math.min(maxIndex, Math.round(numericValue)))
    }

    const letters = ["a", "b", "c", "d", "e", "f"]
    const letterIndex = letters.indexOf(value)
    if (letterIndex >= 0 && letterIndex <= maxIndex) {
      return letterIndex
    }

    if (type === "true_false") {
      const trueIndex = options.findIndex(opt => opt.trim().toLowerCase() === "verdadero")
      const falseIndex = options.findIndex(opt => opt.trim().toLowerCase() === "falso")

      if (["verdadero", "v", "true"].includes(value)) {
        return trueIndex >= 0 ? trueIndex : 0
      }

      if (["falso", "f", "false"].includes(value)) {
        return falseIndex >= 0 ? falseIndex : Math.min(1, maxIndex)
      }
    }

    const optionIndex = options.findIndex(
      opt => String(opt).trim().toLowerCase() === value
    )
    if (optionIndex >= 0) return optionIndex
  }

  return 0
}

function sanitizeQuestion(question: any) {
  const type: "multiple_choice" | "true_false" | "development" =
    question?.type === "true_false" || question?.type === "development"
      ? question.type
      : "multiple_choice"

  const sanitized: any = {
    ...question,
    type,
    question: String(question?.question || "Pregunta generada por IA"),
    explanation: String(question?.explanation || ""),
  }

  if (type !== "development") {
    const options =
      Array.isArray(question?.options) && question.options.length > 0
        ? question.options.map((opt: any) => String(opt))
        : type === "true_false"
          ? ["Verdadero", "Falso"]
          : ["Opción A", "Opción B", "Opción C", "Opción D"]

    sanitized.options = options
    sanitized.correctAnswer = normalizeCorrectAnswer(
      question?.correctAnswer,
      options,
      type
    )
  }

  if (type === "multiple_choice") {
    sanitized.maxPoints = clampPositive(Number(question?.maxPoints), 1) || 1
  }

  if (type === "true_false") {
    const selectionPoints = clampPositive(Number(question?.selectionPoints), 1) || 1
    const requestedMaxPoints = clampPositive(Number(question?.maxPoints), selectionPoints)
    const providedJustification = clampPositive(
      Number(question?.justificationMaxPoints),
      Math.max(0, requestedMaxPoints - selectionPoints)
    )

    const finalMaxPoints =
      requestedMaxPoints > 0 ? requestedMaxPoints : selectionPoints + providedJustification

    sanitized.selectionPoints = selectionPoints
    sanitized.maxPoints = Math.max(selectionPoints, finalMaxPoints)
    sanitized.justificationMaxPoints = Math.max(
      0,
      sanitized.maxPoints - selectionPoints
    )
  }

  if (type === "development") {
    sanitized.modelAnswer = String(question?.modelAnswer || "")
    sanitized.rubric = Array.isArray(question?.rubric)
      ? question.rubric.map((r: any) => ({
          criteria: String(r?.criteria || "Criterio"),
          points: clampPositive(Number(r?.points), 1),
        }))
      : []

    const rubricSum = sanitized.rubric.reduce(
      (acc: number, item: any) => acc + (Number(item?.points) || 0),
      0
    )

    sanitized.maxPoints =
      rubricSum > 0
        ? rubricSum
        : clampPositive(Number(question?.maxPoints), 5) || 5
  }

  return sanitized
}

function sanitizeQuestions(questions: any[]): any[] {
  if (!Array.isArray(questions)) return []
  return questions.map(sanitizeQuestion)
}

function getQuestionMaxPoints(question: any): number {
  if (!question) return 1

  if (typeof question.maxPoints === "number" && question.maxPoints > 0) {
    return question.maxPoints
  }

  if (question.type === "true_false") {
    const selectionPoints =
      typeof question.selectionPoints === "number" ? question.selectionPoints : 1
    const justificationMaxPoints =
      typeof question.justificationMaxPoints === "number"
        ? question.justificationMaxPoints
        : 2
    return selectionPoints + justificationMaxPoints
  }

  if (question.type === "development") {
    if (Array.isArray(question.rubric) && question.rubric.length > 0) {
      const sum = question.rubric.reduce(
        (acc: number, item: any) => acc + (Number(item?.points) || 0),
        0
      )
      if (sum > 0) return sum
    }
    return 5
  }

  return 1
}

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    return JSON.parse(cleaned)
  }
}

// ── Helper compartido para aplicar evaluaciones de IA ────────────────────────
function applyEvaluations(
  evals: any[], toEvaluate: any[], answers: any[], questions: any[]
) {
  for (const ev of evals) {
    const relativeIndex = Number(ev?.index)
    if (!Number.isFinite(relativeIndex) || relativeIndex < 0 || relativeIndex >= toEvaluate.length) continue

    const target    = toEvaluate[relativeIndex]
    const origIndex = target.index
    const maxAllowed = Math.max(0, Number(target.maxPoints) || 0)
    const rawScore   = Number(ev?.score) || 0
    const rawMaxScore = Number(ev?.maxScore) || maxAllowed

    const normalizedMax   = Math.min(maxAllowed, Math.max(0, rawMaxScore || maxAllowed))
    const normalizedScore = Math.min(normalizedMax > 0 ? normalizedMax : maxAllowed, Math.max(0, rawScore))

    answers[origIndex].aiScore     = normalizedScore
    answers[origIndex].aiMaxScore  = normalizedMax > 0 ? normalizedMax : maxAllowed
    answers[origIndex].aiFeedback  = String(ev?.feedback || "")
    answers[origIndex].aiEvaluated = true

    if (questions[origIndex]?.type === "development") {
      answers[origIndex].isCorrect = normalizedScore >= ((normalizedMax > 0 ? normalizedMax : maxAllowed) * 0.5)
    }
    if (questions[origIndex]?.type === "true_false") {
      answers[origIndex].justificationScore    = normalizedScore
      answers[origIndex].justificationFeedback = String(ev?.feedback || "")
    }
  }
}

async function evaluateWithAI(questions: any[], answers: any[]): Promise<any[]> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return answers

  const toEvaluate: {
    index: number
    question: string
    type: "development" | "true_false"
    studentAnswer: string
    modelAnswer?: string
    rubric?: any[]
    maxPoints?: number
    correctAnswerLabel?: string
    selectedOption?: string
  }[] = []

  answers.forEach((a, i) => {
    const q = questions[i]
    if (!q) return

    if (q.type === "development" && a.devText && String(a.devText).trim()) {
      toEvaluate.push({
        index: i,
        question: q.question,
        type: "development",
        studentAnswer: String(a.devText),
        modelAnswer: q.modelAnswer || "",
        rubric: q.rubric || [],
        maxPoints: getQuestionMaxPoints(q),
      })
    }

    if (q.type === "true_false" && a.justification && String(a.justification).trim()) {
      const correctIndex =
        typeof q.correctAnswer === "number"
          ? q.correctAnswer
          : normalizeCorrectAnswer(q.correctAnswer, q.options || ["Verdadero", "Falso"], "true_false")

      toEvaluate.push({
        index: i,
        question: q.question,
        type: "true_false",
        studentAnswer: String(a.justification),
        correctAnswerLabel: q.options?.[correctIndex] || (correctIndex === 0 ? "Verdadero" : "Falso"),
        selectedOption: q.options?.[a.selectedAnswer] || "",
        modelAnswer: q.explanation || "",
        maxPoints:
          typeof q.justificationMaxPoints === "number"
            ? q.justificationMaxPoints
            : 2,
      })
    }
  })

  if (toEvaluate.length === 0) return answers

  const questionsBlock = toEvaluate
    .map((e, idx) => {
      const header = `[${idx}] Tipo: ${e.type}\nPregunta: ${e.question}`

      if (e.type === "development") {
        return `${header}
Respuesta modelo: ${e.modelAnswer || ""}
Rúbrica: ${JSON.stringify(e.rubric || [])}
Puntaje máximo: ${e.maxPoints ?? 0}
Respuesta del estudiante: ${e.studentAnswer}`
      }

      return `${header}
Opción correcta: ${e.correctAnswerLabel || ""}
Estudiante eligió: ${e.selectedOption || ""}
Explicación correcta: ${e.modelAnswer || ""}
Puntaje máximo de justificación: ${e.maxPoints ?? 0}
Justificación del estudiante: ${e.studentAnswer}`
    })
    .join("\n\n")

  const prompt = `Eres un evaluador educativo estricto pero justo. Evalúa las siguientes respuestas de un estudiante.

REGLAS:
- Para DESARROLLO: evalúa de 0 a maxPoints según la rúbrica y la respuesta modelo. Da puntaje parcial si hay aciertos parciales.
- Para VERDADERO/FALSO con justificación: evalúa SOLO la calidad de la justificación de 0 a maxPoints. La selección V/F ya se evaluó aparte.
- En V/F, sé consistente con la opción marcada por el estudiante. Si la justificación contradice su propia selección o muestra confusión, menciónalo y baja el puntaje.
- Sé justo: si el estudiante demuestra comprensión aunque use otras palabras, dale crédito.
- Nunca otorgues un score mayor que maxScore ni menor que 0.
- Responde SOLO con JSON válido, sin backticks ni markdown.

PREGUNTAS A EVALUAR:
${questionsBlock}

Responde con este JSON exacto:
{
  "evaluations": [
    {
      "index": 0,
      "score": 0,
      "maxScore": 0,
      "feedback": "retroalimentación breve y constructiva en español",
      "isCorrect": true
    }
  ]
}`

  try {
    // ── Intentar con Gemini ───────────────────────────────────────────────
    const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    let geminiOk = false

    for (const model of geminiModels) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: "Eres un evaluador educativo. Responde SOLO con JSON válido." }],
            },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(25000),
        }
      )

      // 429 = cuota agotada → intentar siguiente modelo o caer a Groq
      if (res.status === 429) continue
      if (!res.ok) throw new Error(`Gemini ${res.status}`)

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) continue

      const parsed = safeParseJson(text)
      const evals = Array.isArray(parsed?.evaluations) ? parsed.evaluations : []
      applyEvaluations(evals, toEvaluate, answers, questions)
      geminiOk = true
      break
    }

    // ── Fallback a Groq si todos los modelos Gemini dieron 429 ────────────
    if (!geminiOk) {
      const groqKey = process.env.GROQ_API_KEY
      if (!groqKey) throw new Error("Sin cuota Gemini y sin GROQ_API_KEY")

      const Groq = (await import("groq-sdk")).default
      const groq  = new Groq({ apiKey: groqKey })

      const groqRes = await groq.chat.completions.create({
        model:           "llama-3.3-70b-versatile",
        max_tokens:      2048,
        temperature:     0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Eres un evaluador educativo. Responde SOLO con JSON válido." },
          { role: "user",   content: prompt },
        ],
      })

      const groqText = groqRes.choices[0]?.message?.content?.trim() || ""
      if (groqText) {
        const parsed = safeParseJson(groqText)
        const evals  = Array.isArray(parsed?.evaluations) ? parsed.evaluations : []
        applyEvaluations(evals, toEvaluate, answers, questions)
      }
    }

  } catch (err: any) {
    console.error("AI evaluation error:", err?.message || err)

    toEvaluate.forEach((e) => {
      answers[e.index].aiEvaluated = false
      answers[e.index].aiFeedback = "Pendiente de revisión manual"

      if (questions[e.index]?.type === "true_false") {
        answers[e.index].justificationScore = Number(answers[e.index].justificationScore) || 0
        answers[e.index].justificationFeedback =
          answers[e.index].justificationFeedback || "Pendiente de revisión manual"
      }
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
        return NextResponse.json(
          { error: "Faltan campos requeridos" },
          { status: 400 }
        )
      }

      const sanitizedQuestions = sanitizeQuestions(questions)

      let code = generateCode()

      for (let i = 0; i < 10; i++) {
        const { data: existing } = await supabase
          .from("teacher_exams")
          .select("code")
          .eq("code", code)
          .maybeSingle()

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
          questions: sanitizedQuestions,
          settings: { ...settings },
          status: "active",
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, exam: data, code })
    }

    if (action === "submit") {
      const {
        examId,
        studentName,
        studentCourse,
        studentRut,
        answers,
        questions,
        timeSpent,
        examPercentage,
      } = body

      if (!examId || !studentName || !studentCourse || !answers || !questions) {
        return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
      }

      const sanitizedQuestions = sanitizeQuestions(questions)

      let gradedAnswers = answers.map((a: any, i: number) => {
        const q = sanitizedQuestions[i]
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
          const selectionPoints =
            typeof q.selectionPoints === "number" ? q.selectionPoints : 1
          const justificationMaxPoints =
            typeof q.justificationMaxPoints === "number"
              ? q.justificationMaxPoints
              : Math.max(0, getQuestionMaxPoints(q) - selectionPoints)

          return {
            questionIndex: i,
            type: "true_false",
            selectedAnswer: a.selectedAnswer,
            selectionCorrect: tfCorrect,
            isCorrect: tfCorrect,
            justification: a.justification || "",
            selectionPoints,
            justificationMaxPoints,
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

      gradedAnswers = await evaluateWithAI(sanitizedQuestions, gradedAnswers)

      let totalPoints   = 0
      let earnedPoints  = 0
      let correctCount  = 0   // Preguntas correctas (para la columna "Correctas")

      gradedAnswers.forEach((a: any, i: number) => {
        const q = sanitizedQuestions[i]
        if (!q) return

        if (q.type === "multiple_choice") {
          const maxP = getQuestionMaxPoints(q)
          totalPoints += maxP
          if (a.isCorrect) {
            earnedPoints += maxP
            correctCount  += 1
          }
        }

        if (q.type === "true_false") {
          const selectionPoints =
            typeof q.selectionPoints === "number" ? q.selectionPoints : 1
          const justificationMaxPoints =
            typeof q.justificationMaxPoints === "number"
              ? q.justificationMaxPoints
              : Math.max(0, getQuestionMaxPoints(q) - selectionPoints)

          totalPoints += selectionPoints + justificationMaxPoints

          if (a.selectionCorrect || a.isCorrect) {
            earnedPoints += selectionPoints
            correctCount  += 1
          }

          earnedPoints += Math.min(
            justificationMaxPoints,
            Math.max(0, Number(a.justificationScore) || 0)
          )
        }

        if (q.type === "development") {
          const maxP   = getQuestionMaxPoints(q)
          const scored = Math.min(maxP, Math.max(0, Number(a.aiScore) || 0))
          totalPoints  += maxP
          earnedPoints += scored
          // Contar desarrollo como correcta si obtuvo ≥ 60% de sus puntos
          if (maxP > 0 && scored / maxP >= 0.6) correctCount += 1
        }
      })

      const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
      const grade = calcGrade(score, examPercentage || 60)

      const { data, error } = await supabase
        .from("exam_submissions")
        .insert({
          exam_id:         examId,
          student_name:    studentName,
          student_course:  studentCourse,
          student_rut:     studentRut || null,
          answers:         gradedAnswers,
          score:           Math.round(score * 10) / 10,
          grade,
          correct_count:   correctCount,                          // N° preguntas correctas
          total_questions: sanitizedQuestions.length,             // N° total preguntas
          earned_points:   Math.round(earnedPoints * 10) / 10,    // Puntaje obtenido
          total_points:    Math.round(totalPoints * 10) / 10,     // Puntaje máximo
          time_spent:      timeSpent || null,
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, submission: data })
    }

    if (action === "close") {
      const { examId, teacherId } = body

      await supabase
        .from("teacher_exams")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("id", examId)
        .eq("teacher_id", teacherId)

      return NextResponse.json({ success: true })
    }

    if (action === "reopen") {
      const { examId, teacherId } = body

      await supabase
        .from("teacher_exams")
        .update({
          status: "active",
          closed_at: null,
        })
        .eq("id", examId)
        .eq("teacher_id", teacherId)

      return NextResponse.json({ success: true })
    }

    // ── Actualizar preguntas y configuración de un examen existente ─────────
    if (action === "update") {
      const { examId, teacherId, title, instructions, questions, settings } = body

      if (!examId || !teacherId) {
        return NextResponse.json(
          { error: "examId y teacherId son requeridos" },
          { status: 400 }
        )
      }

      const sanitized = Array.isArray(questions)
        ? questions.map(sanitizeQuestion)
        : undefined

      const patch: Record<string, any> = { updated_at: new Date().toISOString() }
      if (title)       patch.title       = title
      if (instructions !== undefined) patch.instructions = instructions
      if (sanitized)   patch.questions   = sanitized
      if (settings)    patch.settings    = settings

      const { error } = await supabase
        .from("teacher_exams")
        .update(patch)
        .eq("id", examId)
        .eq("teacher_id", teacherId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // ── Eliminar examen (solo si está cerrado) ───────────────────────────
    if (action === "delete") {
      const { examId, teacherId } = body

      if (!examId || !teacherId) {
        return NextResponse.json(
          { error: "examId y teacherId son requeridos" },
          { status: 400 }
        )
      }

      // Verificar que el examen existe, pertenece al docente y está cerrado
      const { data: exam } = await supabase
        .from("teacher_exams")
        .select("id, status")
        .eq("id", examId)
        .eq("teacher_id", teacherId)
        .maybeSingle()

      if (!exam) {
        return NextResponse.json(
          { error: "Examen no encontrado" },
          { status: 404 }
        )
      }

      if (exam.status === "active") {
        return NextResponse.json(
          { error: "Cierra el examen antes de eliminarlo" },
          { status: 400 }
        )
      }

      // Eliminar submissions primero (por FK) y luego el examen
      await supabase
        .from("exam_submissions")
        .delete()
        .eq("exam_id", examId)

      const { error: delErr } = await supabase
        .from("teacher_exams")
        .delete()
        .eq("id", examId)
        .eq("teacher_id", teacherId)

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // ── Actualizar submission con puntajes manuales del docente ──────────
    if (action === "update_submission") {
      const { submissionId, updatedAnswers, examPercentage } = body

      if (!submissionId || !Array.isArray(updatedAnswers)) {
        return NextResponse.json({ error: "submissionId y updatedAnswers son requeridos" }, { status: 400 })
      }

      // Recalcular puntaje y nota con los valores manuales
      let totalPoints  = 0
      let earnedPoints = 0
      let correctCount = 0

      for (const a of updatedAnswers) {
        const max = Number(a.maxPoints) || 0
        totalPoints += max

        if (a.type === "multiple_choice") {
          if (a.isCorrect) { earnedPoints += max; correctCount++ }

        } else if (a.type === "true_false") {
          const selPts  = Number(a.selectionPoints)  || 1
          const justPts = Number(a.justificationMaxPoints) || Math.max(0, max - selPts)
          if (a.selectionCorrect || a.isCorrect) { earnedPoints += selPts; correctCount++ }
          earnedPoints += Math.min(justPts, Math.max(0, Number(a.justificationScore) || 0))

        } else if (a.type === "development") {
          const scored = Math.min(max, Math.max(0, Number(a.manualScore ?? a.aiScore) || 0))
          earnedPoints += scored
          if (max > 0 && scored / max >= 0.6) correctCount++
        }
      }

      const pct   = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
      const grade = calcGrade(pct, examPercentage || 60)

      const { error: upErr } = await supabase
        .from("exam_submissions")
        .update({
          answers:          updatedAnswers,
          score:            Math.round(pct * 10) / 10,
          grade,
          correct_count:    correctCount,
          earned_points:    Math.round(earnedPoints * 10) / 10,
          total_points:     Math.round(totalPoints  * 10) / 10,
          manually_reviewed: true,
        })
        .eq("id", submissionId)

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

      return NextResponse.json({
        success: true,
        score:   Math.round(pct * 10) / 10,
        grade,
        correct_count:  correctCount,
        earned_points:  Math.round(earnedPoints * 10) / 10,
        total_points:   Math.round(totalPoints  * 10) / 10,
      })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (err: any) {
    console.error("Exam API error:", err)
    return NextResponse.json(
      { error: err?.message || "Error interno del servidor" },
      { status: 500 }
    )
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
        .eq("code", code)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json(
          { error: "Examen no encontrado" },
          { status: 404 }
        )
      }

      if (data.status !== "active") {
        return NextResponse.json({ error: "Examen cerrado" }, { status: 403 })
      }

      return NextResponse.json({ exam: data })
    }

    if (examId) {
      const { data: exam } = await supabase
        .from("teacher_exams")
        .select("*")
        .eq("id", examId)
        .maybeSingle()

      const { data: submissions } = await supabase
        .from("exam_submissions")
        .select("*")
        .eq("exam_id", examId)
        .order("submitted_at", { ascending: true })

      return NextResponse.json({ exam, submissions: submissions || [] })
    }

    if (teacherId) {
      const { data } = await supabase
        .from("teacher_exams")
        .select("id, code, title, topic, status, created_at, settings")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false })

      const examsWithCount = await Promise.all(
        (data || []).map(async (exam) => {
          const { count } = await supabase
            .from("exam_submissions")
            .select("*", { count: "exact", head: true })
            .eq("exam_id", exam.id)

          return {
            ...exam,
            submissionCount: count || 0,
          }
        })
      )

      return NextResponse.json({ exams: examsWithCount })
    }

    return NextResponse.json(
      { error: "Parámetros faltantes" },
      { status: 400 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error interno del servidor" },
      { status: 500 }
    )
  }
}
