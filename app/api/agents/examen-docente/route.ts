// src/app/api/agents/examen-docente/route.ts
import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createClient } from "@supabase/supabase-js"
import { getDesignTemplateSummary } from "@/lib/design-templates/registry"
import { enrichQuestionAnswerKey } from "@/lib/exam/question-quality"
import {
  calculateGradeFromPercentage,
  calculateScoreSummary,
  clampPoints,
  getMixedChoiceDevelopmentPointBreakdown,
  getQuestionMaxPoints,
  getTrueFalsePointBreakdown,
  normalizeExamPercentage,
} from "@/lib/exam/grading"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false } }
)

function assertServerSupabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Es necesaria para guardar y reanudar intentos con RLS activo."
    )
  }
}

function createServerAttemptId(): string {
  try {
    return randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }
}

function normalizeRutClean(value: unknown): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^0-9K]/g, "")
    .slice(0, 9)
}

function formatRut(value: unknown): string {
  const clean = normalizeRutClean(value)
  if (clean.length < 2) return clean

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const bodyWithDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${bodyWithDots}-${dv}`
}

function isValidRut(value: unknown): boolean {
  const clean = normalizeRutClean(value)
  if (!/^[0-9]{6,8}[0-9K]$/.test(clean)) return false

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  let multiplier = 2
  let sum = 0

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const rest = 11 - (sum % 11)
  const expected = rest === 11 ? "0" : rest === 10 ? "K" : String(rest)
  return expected === dv
}

function normalizeSavedAnswerBundle(value: any) {
  const source = value && typeof value === "object" ? value : {}
  return {
    mcAnswers: source.mcAnswers && typeof source.mcAnswers === "object" ? source.mcAnswers : {},
    devAnswers: source.devAnswers && typeof source.devAnswers === "object" ? source.devAnswers : {},
    tfJustifications:
      source.tfJustifications && typeof source.tfJustifications === "object"
        ? source.tfJustifications
        : {},
    developmentArtifacts:
      source.developmentArtifacts && typeof source.developmentArtifacts === "object"
        ? source.developmentArtifacts
        : {},
  }
}

function getExamTimeLimitSeconds(settings: any): number {
  const minutes = Number(settings?.timeLimit)
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 30
  return Math.max(60, Math.round(safeMinutes * 60))
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let code = ""
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function clampPositive(n: number, fallback = 1): number {
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.round(n * 10) / 10)
}

function normalizeCorrectAnswer(
  rawCorrectAnswer: any,
  options: string[],
  type: "multiple_choice" | "true_false" | "development" | "mixed_choice_development"
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
  const type: "multiple_choice" | "true_false" | "development" | "mixed_choice_development" =
    question?.type === "true_false" || question?.type === "development" || question?.type === "mixed_choice_development"
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

  if (type === "mixed_choice_development") {
    const { selectionPoints, developmentMaxPoints, maxPoints } =
      getMixedChoiceDevelopmentPointBreakdown(question)

    sanitized.selectionPoints = selectionPoints
    sanitized.developmentMaxPoints = developmentMaxPoints
    sanitized.maxPoints = maxPoints
    sanitized.modelAnswer = String(
      question?.modelAnswer || question?.expectedAnswer || question?.respuestaModelo || ""
    )
    sanitized.expectedLatex = String(question?.expectedLatex || "")
    sanitized.rubric = Array.isArray(question?.rubric)
      ? question.rubric.map((r: any) => ({
          criteria: String(r?.criteria || r?.criterion || r?.criterio || "Criterio"),
          points: clampPositive(Number(r?.points ?? r?.puntos), 1),
        }))
      : []
    sanitized.showRubricToStudent = question?.showRubricToStudent === true
  }

  if (type === "true_false") {
    const { selectionPoints, justificationMaxPoints, maxPoints } =
      getTrueFalsePointBreakdown(question)

    sanitized.selectionPoints = selectionPoints
    sanitized.justificationMaxPoints = justificationMaxPoints
    sanitized.maxPoints = maxPoints
  }

  if (type === "development") {
    sanitized.modelAnswer = String(
      question?.modelAnswer || question?.expectedAnswer || question?.respuestaModelo || ""
    )
    sanitized.rubric = Array.isArray(question?.rubric)
      ? question.rubric.map((r: any) => ({
          criteria: String(r?.criteria || r?.criterion || r?.criterio || "Criterio"),
          points: clampPositive(Number(r?.points ?? r?.puntos), 1),
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

  return enrichQuestionAnswerKey(sanitized)
}

function sanitizeQuestions(questions: any[]): any[] {
  if (!Array.isArray(questions)) return []
  return questions.map(sanitizeQuestion)
}

function buildStudentReviewQuestion(question: any) {
  const q = sanitizeQuestion(question)
  const base: Record<string, any> = {
    type: q.type,
    question: q.question,
    imageUrl: q.imageUrl || "",
    maxPoints: getQuestionMaxPoints(q),
    answerText: q.answerText || "",
    correctAnswerText: q.correctAnswerText || q.answerText || "",
    explanation: q.explanation || "",
    solutionSteps: Array.isArray(q.solutionSteps) ? q.solutionSteps : [],
  }

  if (q.type === "multiple_choice") {
    return {
      ...base,
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer,
    }
  }

  if (q.type === "mixed_choice_development") {
    return {
      ...base,
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer,
      selectionPoints: q.selectionPoints,
      developmentMaxPoints: q.developmentMaxPoints,
      modelAnswer: q.modelAnswer || "",
      expectedLatex: q.expectedLatex || "",
      rubric: Array.isArray(q.rubric) ? q.rubric : [],
    }
  }

  if (q.type === "true_false") {
    return {
      ...base,
      options: ["Verdadero", "Falso"],
      correctAnswer: q.correctAnswer,
      selectionPoints: q.selectionPoints,
      justificationMaxPoints: q.justificationMaxPoints,
    }
  }

  return {
    ...base,
    modelAnswer: q.modelAnswer || "",
    expectedLatex: q.expectedLatex || "",
    rubric: Array.isArray(q.rubric) ? q.rubric : [],
  }
}

function stripTeacherAnswerKey(question: any) {
  const q = sanitizeQuestion(question)
  const base: Record<string, any> = {
    type: q.type,
    question: q.question,
    imageUrl: q.imageUrl || "",
    maxPoints: getQuestionMaxPoints(q),
  }

  if (q.type === "multiple_choice") {
    return { ...base, options: Array.isArray(q.options) ? q.options : [] }
  }

  if (q.type === "mixed_choice_development") {
    return {
      ...base,
      options: Array.isArray(q.options) ? q.options : [],
      selectionPoints: q.selectionPoints,
      developmentMaxPoints: q.developmentMaxPoints,
    }
  }

  if (q.type === "true_false") {
    return {
      ...base,
      options: ["Verdadero", "Falso"],
      selectionPoints: q.selectionPoints,
      justificationMaxPoints: q.justificationMaxPoints,
    }
  }

  return {
    ...base,
    showRubricToStudent: q.showRubricToStudent === true,
    rubric: q.showRubricToStudent === true && Array.isArray(q.rubric) ? q.rubric : [],
  }
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

function normalizeExamSettings(settings: any, designTemplateId?: string) {
  const safeSettings = settings && typeof settings === "object" ? settings : {}
  const examDesignTemplateId = designTemplateId || safeSettings.designTemplateId

  const nextSettings: Record<string, any> = {
    ...safeSettings,
    allowCalculator: safeSettings.allowCalculator === true,
  }

  if (examDesignTemplateId) {
    nextSettings.designTemplateId = examDesignTemplateId
    nextSettings._design = getDesignTemplateSummary(examDesignTemplateId, "exam")
  }

  return nextSettings
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
    if (questions[origIndex]?.type === "mixed_choice_development") {
      answers[origIndex].developmentScore = normalizedScore
      answers[origIndex].developmentFeedback = String(ev?.feedback || "")
      answers[origIndex].developmentReviewed = true
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
    type: "development" | "true_false" | "mixed_choice_development"
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

    const renderedLatex = String(a.developmentLatex || "").trim()
    const developmentText = renderedLatex || String(a.devText || "").trim()
    if (q.type === "development" && developmentText) {
      toEvaluate.push({
        index: i,
        question: q.question,
        type: "development",
        studentAnswer: renderedLatex ? `LaTeX renderizado del desarrollo: ${renderedLatex}` : developmentText,
        modelAnswer: q.modelAnswer || q.expectedLatex || "",
        rubric: q.rubric || [],
        maxPoints: getQuestionMaxPoints(q),
      })
    }

    if (q.type === "mixed_choice_development" && developmentText) {
      const { developmentMaxPoints } = getMixedChoiceDevelopmentPointBreakdown(q)
      const selected = Number.isFinite(Number(a.selectedAnswer)) ? Number(a.selectedAnswer) : -1
      toEvaluate.push({
        index: i,
        question: q.question,
        type: "mixed_choice_development",
        studentAnswer: renderedLatex ? `LaTeX renderizado del desarrollo: ${renderedLatex}` : developmentText,
        selectedOption: q.options?.[selected] || "",
        correctAnswerLabel: q.options?.[q.correctAnswer] || "",
        modelAnswer: q.modelAnswer || q.expectedLatex || "",
        rubric: q.rubric || [],
        maxPoints: developmentMaxPoints,
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

      if (e.type === "development" || e.type === "mixed_choice_development") {
        return `${header}
Alternativa seleccionada: ${e.selectedOption || ""}
Alternativa correcta: ${e.correctAnswerLabel || ""}
Respuesta modelo: ${e.modelAnswer || ""}
Rúbrica: ${JSON.stringify(e.rubric || [])}
Puntaje máximo del desarrollo: ${e.maxPoints ?? 0}
Desarrollo del estudiante: ${e.studentAnswer}`
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
- Para ALTERNATIVA + DESARROLLO: evalúa SOLO el desarrollo manuscrito de 0 a maxPoints. La alternativa ya se evalúa aparte.
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

    // ── Cargar examen público por código (estudiantes) ──────────────────────
    if (action === "public_exam_by_code") {
      const { code } = body
      if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 })

      const { data, error } = await supabase
        .from("teacher_exams")
        .select("id, code, title, topic, instructions, questions, settings, status")
        .eq("code", code)
        .maybeSingle()

      if (error || !data) return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })
      if (data.status !== "active") return NextResponse.json({ error: "Este examen está cerrado" }, { status: 403 })

      const publicExam = {
        ...data,
        // La clave, la explicación y la respuesta modelo solo se liberan después
        // de enviar el examen, cuando la configuración lo permite.
        questions: sanitizeQuestions(data.questions || []).map(stripTeacherAnswerKey),
      }

      return NextResponse.json({ success: true, exam: publicExam })
    }

    // ── Iniciar o reanudar intento del estudiante ───────────────────────────
    // Guarda el avance por RUT limpio + curso + examen. Esto permite que el
    // estudiante cierre la pestaña por error y vuelva al mismo punto.
    if (action === "start_or_resume_attempt") {
      assertServerSupabaseAdmin()
      const { examId, studentName, studentCourse, studentRut } = body
      const rutClean = normalizeRutClean(studentRut)

      if (!examId || !String(studentName || "").trim() || !String(studentCourse || "").trim()) {
        return NextResponse.json({ error: "Nombre, curso y examen son requeridos" }, { status: 400 })
      }

      if (!isValidRut(rutClean)) {
        return NextResponse.json(
          { error: "RUT inválido. Escríbelo sin puntos ni guion, incluyendo el dígito verificador o K." },
          { status: 400 }
        )
      }

      const { data: officialExam, error: examError } = await supabase
        .from("teacher_exams")
        .select("id, questions, settings, status")
        .eq("id", examId)
        .maybeSingle()

      if (examError || !officialExam) {
        return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })
      }

      if (officialExam.status !== "active") {
        return NextResponse.json({ error: "Este examen está cerrado" }, { status: 403 })
      }

      const formattedRut = formatRut(rutClean)
      const totalQuestions = Array.isArray(officialExam.questions) ? officialExam.questions.length : 0
      const maxTimeLeft = getExamTimeLimitSeconds(officialExam.settings)

      const { data: existing, error: existingError } = await supabase
        .from("exam_attempt_drafts")
        .select("id, client_attempt_id, answers, current_question_index, time_left, status, submission_id, started_at, last_saved_at")
        .eq("exam_id", examId)
        .eq("student_rut_clean", rutClean)
        .eq("student_course", String(studentCourse).trim())
        .maybeSingle()

      if (existingError) throw existingError

      if (existing?.status === "submitted") {
        return NextResponse.json(
          {
            error: "Este RUT ya tiene una entrega registrada para este examen.",
            alreadySubmitted: true,
            submissionId: existing.submission_id || null,
          },
          { status: 409 }
        )
      }

      if (existing) {
        const nextIndex = Math.max(
          0,
          Math.min(totalQuestions > 0 ? totalQuestions - 1 : 0, Number(existing.current_question_index) || 0)
        )
        const savedTimeLeft = Number(existing.time_left)
        return NextResponse.json({
          success: true,
          resumed: true,
          attempt: {
            clientAttemptId: existing.client_attempt_id,
            answers: normalizeSavedAnswerBundle(existing.answers),
            currentQuestionIndex: nextIndex,
            timeLeft:
              Number.isFinite(savedTimeLeft) && savedTimeLeft > 0
                ? Math.min(maxTimeLeft, Math.round(savedTimeLeft))
                : maxTimeLeft,
            startedAt: existing.started_at || null,
            lastSavedAt: existing.last_saved_at || null,
            studentRut: formattedRut,
            studentRutClean: rutClean,
          },
        })
      }

      const clientAttemptId = createServerAttemptId()
      const defaultAnswers = normalizeSavedAnswerBundle(null)
      const { data: created, error: createError } = await supabase
        .from("exam_attempt_drafts")
        .insert({
          exam_id: examId,
          student_name: String(studentName).trim(),
          student_course: String(studentCourse).trim(),
          student_rut: formattedRut,
          student_rut_clean: rutClean,
          client_attempt_id: clientAttemptId,
          answers: defaultAnswers,
          current_question_index: 0,
          time_left: maxTimeLeft,
          status: "in_progress",
          last_saved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id, client_attempt_id, answers, current_question_index, time_left, started_at, last_saved_at")
        .single()

      if (createError) throw createError

      return NextResponse.json({
        success: true,
        resumed: false,
        attempt: {
          clientAttemptId: created.client_attempt_id,
          answers: normalizeSavedAnswerBundle(created.answers),
          currentQuestionIndex: 0,
          timeLeft: maxTimeLeft,
          startedAt: created.started_at || null,
          lastSavedAt: created.last_saved_at || null,
          studentRut: formattedRut,
          studentRutClean: rutClean,
        },
      })
    }

    // ── Guardado automático del avance ───────────────────────────────────────
    if (action === "autosave_attempt") {
      assertServerSupabaseAdmin()
      const {
        examId,
        studentName,
        studentCourse,
        studentRut,
        clientAttemptId,
        answers,
        currentQuestionIndex,
        timeLeft,
      } = body
      const rutClean = normalizeRutClean(studentRut)

      if (!examId || !String(studentName || "").trim() || !String(studentCourse || "").trim() || !clientAttemptId) {
        return NextResponse.json({ error: "Faltan datos para guardar el avance" }, { status: 400 })
      }

      if (!isValidRut(rutClean)) {
        return NextResponse.json({ error: "RUT inválido" }, { status: 400 })
      }

      const { data: officialExam, error: examError } = await supabase
        .from("teacher_exams")
        .select("id, questions, settings, status")
        .eq("id", examId)
        .maybeSingle()

      if (examError || !officialExam) {
        return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })
      }

      if (officialExam.status !== "active") {
        return NextResponse.json({ error: "Este examen está cerrado" }, { status: 403 })
      }

      const formattedRut = formatRut(rutClean)
      const totalQuestions = Array.isArray(officialExam.questions) ? officialExam.questions.length : 0
      const maxIndex = Math.max(0, totalQuestions - 1)
      const nextIndex = Math.max(0, Math.min(maxIndex, Number(currentQuestionIndex) || 0))
      const maxTimeLeft = getExamTimeLimitSeconds(officialExam.settings)
      const nextTimeLeft = Math.max(
        0,
        Math.min(maxTimeLeft, Math.round(Number(timeLeft) || 0))
      )

      const { data: existing, error: existingError } = await supabase
        .from("exam_attempt_drafts")
        .select("id, status, submission_id")
        .eq("exam_id", examId)
        .eq("student_rut_clean", rutClean)
        .eq("student_course", String(studentCourse).trim())
        .maybeSingle()

      if (existingError) throw existingError

      if (existing?.status === "submitted") {
        return NextResponse.json(
          { error: "El examen ya fue entregado. No se puede modificar el avance.", alreadySubmitted: true },
          { status: 409 }
        )
      }

      const row = {
        exam_id: examId,
        student_name: String(studentName).trim(),
        student_course: String(studentCourse).trim(),
        student_rut: formattedRut,
        student_rut_clean: rutClean,
        client_attempt_id: String(clientAttemptId),
        answers: normalizeSavedAnswerBundle(answers),
        current_question_index: nextIndex,
        time_left: nextTimeLeft,
        last_saved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const query = existing?.id
        ? supabase.from("exam_attempt_drafts").update(row).eq("id", existing.id)
        : supabase.from("exam_attempt_drafts").insert({ ...row, status: "in_progress" })

      const { data: saved, error: saveError } = await query
        .select("id, client_attempt_id, current_question_index, time_left, last_saved_at")
        .single()

      if (saveError) throw saveError

      return NextResponse.json({
        success: true,
        attempt: {
          clientAttemptId: saved.client_attempt_id,
          currentQuestionIndex: saved.current_question_index,
          timeLeft: saved.time_left,
          lastSavedAt: saved.last_saved_at,
        },
      })
    }

    if (action === "create") {
      const { teacherId, title, topic, instructions, questions, settings, designTemplateId } = body

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
          settings: normalizeExamSettings(settings, designTemplateId),
          status: "active",
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, exam: data, code })
    }

    if (action === "submit") {
      assertServerSupabaseAdmin()
      const {
        examId,
        studentName,
        studentCourse,
        studentRut,
        answers,
        timeSpent,
        examPercentage,
        clientAttemptId,
      } = body
      const rutClean = normalizeRutClean(studentRut)
      const effectiveClientAttemptId = String(clientAttemptId || createServerAttemptId())

      if (!examId || !studentName || !studentCourse || !answers) {
        return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
      }

      if (!isValidRut(rutClean)) {
        return NextResponse.json(
          { error: "RUT inválido. Escríbelo sin puntos ni guion, incluyendo el dígito verificador o K." },
          { status: 400 }
        )
      }

      const { data: officialExam, error: officialExamError } = await supabase
        .from("teacher_exams")
        .select("id, questions, settings, status")
        .eq("id", examId)
        .maybeSingle()

      if (officialExamError || !officialExam) {
        return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })
      }

      if (officialExam.status !== "active") {
        return NextResponse.json({ error: "Este examen está cerrado" }, { status: 403 })
      }

      const sanitizedQuestions = sanitizeQuestions(officialExam.questions || [])

      let gradedAnswers = answers.map((a: any, i: number) => {
        const q = sanitizedQuestions[i]
        if (!q) return { questionIndex: i, selectedAnswer: -1, isCorrect: false }

        if (q.type === "development") {
          return {
            questionIndex: i,
            type: "development",
            devText: a.devText || "",
            developmentLatex: a.developmentLatex || "",
            isCorrect: false,
            maxPoints: getQuestionMaxPoints(q),
          }
        }

        if (q.type === "mixed_choice_development") {
          const selectedAnswer = Number.isFinite(Number(a.selectedAnswer)) ? Number(a.selectedAnswer) : -1
          const selectionCorrect = selectedAnswer === q.correctAnswer
          const { selectionPoints, developmentMaxPoints, maxPoints } = getMixedChoiceDevelopmentPointBreakdown(q)
          return {
            questionIndex: i,
            type: "mixed_choice_development",
            selectedAnswer,
            selectionCorrect,
            isCorrect: selectionCorrect,
            devText: a.devText || "",
            developmentLatex: a.developmentLatex || "",
            selectionPoints,
            developmentMaxPoints,
            developmentScore: 0,
            maxPoints,
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

      const scoreSummary = calculateScoreSummary(sanitizedQuestions, gradedAnswers)
      const officialExamPercentage = normalizeExamPercentage(
        officialExam.settings?.examPercentage ?? examPercentage ?? 60
      )
      const grade = calculateGradeFromPercentage(scoreSummary.percentage, officialExamPercentage)
      const formattedRut = formatRut(rutClean)

      const { data, error } = await supabase
        .from("exam_submissions")
        .upsert({
          exam_id:         examId,
          client_attempt_id: effectiveClientAttemptId,
          student_name:    studentName,
          student_course:  studentCourse,
          student_rut:     formattedRut,
          student_rut_clean: rutClean,
          answers:         gradedAnswers,
          score:           scoreSummary.percentage,
          grade,
          correct_count:   scoreSummary.correctCount,              // N° preguntas completamente correctas
          total_questions: sanitizedQuestions.length,              // N° total preguntas
          earned_points:   scoreSummary.earnedPoints,               // Puntaje obtenido
          total_points:    scoreSummary.totalPoints,                // Puntaje máximo
          time_spent:      timeSpent || null,
        }, { onConflict: "exam_id,client_attempt_id" })
        .select()
        .single()

      if (error) throw error

      if (effectiveClientAttemptId) {
        const { error: linkError } = await supabase
          .from("exam_question_developments")
          .update({ submission_id: data.id, updated_at: new Date().toISOString() })
          .eq("exam_id", examId)
          .eq("client_attempt_id", effectiveClientAttemptId)

        if (linkError) {
          console.error("[exam-submit/link-developments]", linkError)
        }

        const { error: draftError } = await supabase
          .from("exam_attempt_drafts")
          .update({
            status: "submitted",
            submission_id: data.id,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("exam_id", examId)
          .eq("client_attempt_id", effectiveClientAttemptId)

        if (draftError) {
          console.error("[exam-submit/mark-draft-submitted]", draftError)
        }
      }

      const showResultToStudent = officialExam.settings?.showResultToStudent !== false
      const reviewQuestions = showResultToStudent
        ? sanitizedQuestions.map(buildStudentReviewQuestion)
        : []

      return NextResponse.json({
        success: true,
        submission: data,
        reviewQuestions,
      })
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
      const { examId, teacherId, title, instructions, questions, settings, designTemplateId } = body

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
      if (settings || designTemplateId) {
        patch.settings = normalizeExamSettings(settings, designTemplateId)
      }

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
      if (!examId || !teacherId) return NextResponse.json({ error: "examId y teacherId son requeridos" }, { status: 400 })
      const { error } = await supabase
        .from("teacher_exams")
        .update({ deleted_at: new Date().toISOString(), status: "closed" })
        .eq("id", examId)
        .eq("teacher_id", teacherId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── Actualizar submission con puntajes manuales del docente ──────────
    if (action === "update_submission") {
      const { submissionId, updatedAnswers } = body

      if (!submissionId || !Array.isArray(updatedAnswers)) {
        return NextResponse.json({ error: "submissionId y updatedAnswers son requeridos" }, { status: 400 })
      }

      const { data: originalSubmission, error: submissionError } = await supabase
        .from("exam_submissions")
        .select("id, exam_id")
        .eq("id", submissionId)
        .maybeSingle()

      if (submissionError || !originalSubmission) {
        return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 })
      }

      const { data: officialExam, error: officialExamError } = await supabase
        .from("teacher_exams")
        .select("id, questions, settings")
        .eq("id", originalSubmission.exam_id)
        .maybeSingle()

      if (officialExamError || !officialExam) {
        return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })
      }

      const sanitizedQuestions = sanitizeQuestions(officialExam.questions || [])
      const normalizedAnswers = sanitizedQuestions.map((q: any, index: number) => {
        const answer = { ...(updatedAnswers[index] || {}) }
        const maxPoints = getQuestionMaxPoints(q)

        if (q.type === "multiple_choice") {
          const selectedAnswer = Number.isFinite(Number(answer.selectedAnswer))
            ? Number(answer.selectedAnswer)
            : -1
          return {
            ...answer,
            questionIndex: index,
            type: "multiple_choice",
            selectedAnswer,
            // La revisión manual del docente puede corregir casos excepcionales.
            isCorrect:
              typeof answer.isCorrect === "boolean"
                ? answer.isCorrect
                : selectedAnswer === q.correctAnswer,
            maxPoints,
          }
        }

        if (q.type === "mixed_choice_development") {
          const selectedAnswer = Number.isFinite(Number(answer.selectedAnswer))
            ? Number(answer.selectedAnswer)
            : -1
          const { selectionPoints, developmentMaxPoints, maxPoints } = getMixedChoiceDevelopmentPointBreakdown(q)
          const selectionCorrect = selectedAnswer === q.correctAnswer
          return {
            ...answer,
            questionIndex: index,
            type: "mixed_choice_development",
            selectedAnswer,
            selectionCorrect,
            isCorrect: selectionCorrect,
            selectionPoints,
            developmentMaxPoints,
            developmentScore: clampPoints(answer.manualDevelopmentScore ?? answer.developmentScore ?? answer.aiScore ?? 0, 0, developmentMaxPoints),
            manualDevelopmentScore: clampPoints(answer.manualDevelopmentScore ?? answer.developmentScore ?? answer.aiScore ?? 0, 0, developmentMaxPoints),
            maxPoints,
          }
        }

        if (q.type === "true_false") {
          const selectedAnswer = Number.isFinite(Number(answer.selectedAnswer))
            ? Number(answer.selectedAnswer)
            : -1
          const { selectionPoints, justificationMaxPoints } = getTrueFalsePointBreakdown(q)
          const selectionCorrect = selectedAnswer === q.correctAnswer
          return {
            ...answer,
            questionIndex: index,
            type: "true_false",
            selectedAnswer,
            selectionCorrect,
            isCorrect: selectionCorrect,
            selectionPoints,
            justificationMaxPoints,
            justificationScore: clampPoints(answer.justificationScore ?? 0, 0, justificationMaxPoints),
            maxPoints,
          }
        }

        return {
          ...answer,
          questionIndex: index,
          type: "development",
          manualScore: clampPoints(answer.manualScore ?? answer.aiScore ?? 0, 0, maxPoints),
          aiScore: clampPoints(answer.manualScore ?? answer.aiScore ?? 0, 0, maxPoints),
          maxPoints,
        }
      })

      const scoreSummary = calculateScoreSummary(sanitizedQuestions, normalizedAnswers)
      const grade = calculateGradeFromPercentage(
        scoreSummary.percentage,
        officialExam.settings?.examPercentage ?? 60
      )
      const finalGrade = body.bonusGrade != null
        ? Math.min(7.0, Math.max(1.0, Number(body.bonusGrade)))
        : grade

      const { error: upErr } = await supabase
        .from("exam_submissions")
        .update({
          answers:           normalizedAnswers,
          score:             scoreSummary.percentage,
          grade:             finalGrade,
          correct_count:     scoreSummary.correctCount,
          earned_points:     scoreSummary.earnedPoints,
          total_points:      scoreSummary.totalPoints,
          manually_reviewed: true,
        })
        .eq("id", submissionId)

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

      return NextResponse.json({
        success: true,
        score:          scoreSummary.percentage,
        grade:          finalGrade,
        correct_count:  scoreSummary.correctCount,
        earned_points:  scoreSummary.earnedPoints,
        total_points:   scoreSummary.totalPoints,
        answers:        normalizedAnswers,
      })
    }

    // ── Restaurar examen desde papelera ────────────────────────────────────
    if (action === "restore") {
      const { examId, teacherId } = body
      if (!examId || !teacherId) {
        return NextResponse.json({ error: "examId y teacherId son requeridos" }, { status: 400 })
      }
      const { error } = await supabase
        .from("teacher_exams")
        .update({ deleted_at: null })
        .eq("id", examId)
        .eq("teacher_id", teacherId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── Eliminar permanente ──────────────────────────────────────────────────
    if (action === "permanent_delete") {
      const { examId, teacherId } = body
      if (!examId || !teacherId) {
        return NextResponse.json({ error: "examId y teacherId son requeridos" }, { status: 400 })
      }
      await supabase.from("exam_submissions").delete().eq("exam_id", examId)
      const { error } = await supabase
        .from("teacher_exams")
        .delete()
        .eq("id", examId)
        .eq("teacher_id", teacherId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── Mover a papelera (soft delete) ───────────────────────────────────────
    if (action === "soft_delete") {
      const { examId, teacherId } = body
      if (!examId || !teacherId) {
        return NextResponse.json({ error: "examId y teacherId son requeridos" }, { status: 400 })
      }
      const { error } = await supabase
        .from("teacher_exams")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", examId)
        .eq("teacher_id", teacherId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── Dar décimas (bonus grade) ────────────────────────────────────────
    if (action === "apply_bonus_grade") {
      const { submissionId, bonusGrade } = body
      if (!submissionId) return NextResponse.json({ error: "submissionId requerido" }, { status: 400 })
      const grade = Math.min(7.0, Math.max(1.0, Number(bonusGrade)))
      const { error } = await supabase.from("exam_submissions").update({ grade }).eq("id", submissionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, grade })
    }

    // ── Dar más tiempo (reopen exam access for student) ───────────────────
    if (action === "grant_extra_time") {
      const { submissionId, examId: targetExamId, extraMinutes } = body
      if (!submissionId || !targetExamId) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 })
      // Ensure exam is active (reopen if needed)
      await supabase.from("teacher_exams").update({ status: "active", closed_at: null }).eq("id", targetExamId)
      // Mark submission with extra time flag
      await supabase.from("exam_submissions").update({ manually_reviewed: false }).eq("id", submissionId)
      return NextResponse.json({ success: true, extraMinutes })
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

      return NextResponse.json({
        exam: {
          ...data,
          questions: sanitizeQuestions(data.questions || []).map(stripTeacherAnswerKey),
        },
      })
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
      const showDeleted = searchParams.get("showDeleted") === "true"
      const query = supabase
        .from("teacher_exams")
        .select("id, code, title, topic, status, created_at, settings, deleted_at")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false })

      const { data } = showDeleted
        ? await query.not("deleted_at", "is", null)
        : await query.is("deleted_at", null)

      const examsWithCount = await Promise.all(
        (data || []).map(async (exam: any) => {
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
