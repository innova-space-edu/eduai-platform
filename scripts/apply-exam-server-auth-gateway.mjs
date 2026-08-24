import fs from "node:fs"
import path from "node:path"

const target = path.join(process.cwd(), "app", "api", "agents", "examen-docente", "route.ts")
if (!fs.existsSync(target)) throw new Error("[exam-server-auth] examen-docente route no encontrada")

let source = fs.readFileSync(target, "utf8")
let changed = false

function insertImport(importLine, afterLine) {
  if (source.includes(importLine)) return
  if (!source.includes(afterLine)) throw new Error(`[exam-server-auth] import marker no encontrado: ${afterLine}`)
  source = source.replace(afterLine, `${afterLine}\n${importLine}`)
  changed = true
}

insertImport(
  'import { createClient as createServerClient } from "@/lib/supabase/server"',
  'import { createClient } from "@supabase/supabase-js"',
)
insertImport(
  'import { runAIStructured } from "@/lib/ai/gateway"',
  'import { createClient as createServerClient } from "@/lib/supabase/server"',
)

const evaluationStart = source.indexOf("async function evaluateWithAI(")
const postStart = source.indexOf("\nexport async function POST(request: NextRequest) {", evaluationStart)
if (evaluationStart < 0 || postStart < 0) {
  throw new Error("[exam-server-auth] evaluateWithAI/POST markers no encontrados")
}

if (!source.slice(evaluationStart, postStart).includes('module: "exam-grading"')) {
  const replacement = `async function evaluateWithAI(
  questions: any[],
  answers: any[],
  context: { teacherId: string; examId: string }
): Promise<any[]> {
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
        studentAnswer: renderedLatex ? \`LaTeX renderizado del desarrollo: \${renderedLatex}\` : developmentText,
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
        studentAnswer: renderedLatex ? \`LaTeX renderizado del desarrollo: \${renderedLatex}\` : developmentText,
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
      const header = \`[\${idx}] Tipo: \${e.type}\\nPregunta: \${e.question}\`

      if (e.type === "development" || e.type === "mixed_choice_development") {
        return \`\${header}
Alternativa seleccionada: \${e.selectedOption || ""}
Alternativa correcta: \${e.correctAnswerLabel || ""}
Respuesta modelo: \${e.modelAnswer || ""}
Rúbrica: \${JSON.stringify(e.rubric || [])}
Puntaje máximo del desarrollo: \${e.maxPoints ?? 0}
Desarrollo del estudiante: \${e.studentAnswer}\`
      }

      return \`\${header}
Opción correcta: \${e.correctAnswerLabel || ""}
Estudiante eligió: \${e.selectedOption || ""}
Explicación correcta: \${e.modelAnswer || ""}
Puntaje máximo de justificación: \${e.maxPoints ?? 0}
Justificación del estudiante: \${e.studentAnswer}\`
    })
    .join("\\n\\n")

  const prompt = \`Eres un evaluador educativo estricto pero justo. Evalúa las siguientes respuestas de un estudiante.

REGLAS:
- Para DESARROLLO: evalúa de 0 a maxPoints según la rúbrica y la respuesta modelo. Da puntaje parcial si hay aciertos parciales.
- Para ALTERNATIVA + DESARROLLO: evalúa SOLO el desarrollo de 0 a maxPoints. La alternativa ya se evalúa aparte.
- Para VERDADERO/FALSO con justificación: evalúa SOLO la calidad de la justificación de 0 a maxPoints. La selección V/F ya se evaluó aparte.
- En V/F, sé consistente con la opción marcada por el estudiante. Si la justificación contradice su propia selección o muestra confusión, menciónalo y baja el puntaje.
- Si el estudiante demuestra comprensión aunque use otras palabras, dale crédito.
- Nunca otorgues un score mayor que maxScore ni menor que 0.
- Devuelve una evaluación por cada elemento recibido, usando el índice relativo mostrado.

PREGUNTAS A EVALUAR:
\${questionsBlock}\`

  try {
    const result = await runAIStructured<{ evaluations: Array<{
      index: number
      score: number
      maxScore: number
      feedback: string
      isCorrect: boolean
    }> }>({
      messages: [
        {
          role: "system",
          content: "Eres un evaluador educativo. Corrige con criterios pedagógicos, puntaje parcial y retroalimentación breve en español.",
        },
        { role: "user", content: prompt },
      ],
      schema: {
        type: "object",
        properties: {
          evaluations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "integer" },
                score: { type: "number" },
                maxScore: { type: "number" },
                feedback: { type: "string" },
                isCorrect: { type: "boolean" },
              },
              required: ["index", "score", "maxScore", "feedback", "isCorrect"],
            },
          },
        },
        required: ["evaluations"],
      },
      maxOutputTokens: 2048,
      lite: true,
      context: {
        userId: context.teacherId,
        module: "exam-grading",
        sourceId: context.examId,
        reusePolicy: "exact_private",
        visibility: "private",
      },
      supabase,
    })

    const evals = Array.isArray(result.data?.evaluations) ? result.data.evaluations : []
    applyEvaluations(evals, toEvaluate, answers, questions)
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

const PUBLIC_STUDENT_ACTIONS = new Set([
  "public_exam_by_code",
  "start_or_resume_attempt",
  "autosave_attempt",
  "submit",
])

const TEACHER_EXAM_ACTIONS = new Set([
  "close",
  "reopen",
  "update",
  "delete",
  "restore",
  "permanent_delete",
  "soft_delete",
])

const TEACHER_SUBMISSION_ACTIONS = new Set([
  "update_submission",
  "apply_bonus_grade",
])

async function currentTeacherId(): Promise<string | null> {
  const auth = await createServerClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return null
  return user.id
}

async function ownedExam(examId: unknown, teacherId: string) {
  const id = String(examId || "").trim()
  if (!id) return null
  const { data, error } = await supabase
    .from("teacher_exams")
    .select("id, teacher_id")
    .eq("id", id)
    .eq("teacher_id", teacherId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

async function ownedSubmission(submissionId: unknown, teacherId: string) {
  const id = String(submissionId || "").trim()
  if (!id) return null
  const { data: submission, error } = await supabase
    .from("exam_submissions")
    .select("id, exam_id")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!submission?.exam_id) return null

  const exam = await ownedExam(submission.exam_id, teacherId)
  return exam ? submission : null
}

async function authorizeTeacherAction(action: string, body: any, teacherId: string) {
  if (action === "create") return { allowed: true as const }

  if (TEACHER_EXAM_ACTIONS.has(action)) {
    const exam = await ownedExam(body.examId, teacherId)
    return exam
      ? { allowed: true as const }
      : { allowed: false as const, status: 404, error: "Examen no encontrado para este docente" }
  }

  if (TEACHER_SUBMISSION_ACTIONS.has(action)) {
    const submission = await ownedSubmission(body.submissionId, teacherId)
    return submission
      ? { allowed: true as const }
      : { allowed: false as const, status: 404, error: "Entrega no encontrada para este docente" }
  }

  if (action === "grant_extra_time") {
    const submission = await ownedSubmission(body.submissionId, teacherId)
    if (!submission) {
      return { allowed: false as const, status: 404, error: "Entrega no encontrada para este docente" }
    }
    const targetExamId = String(body.examId || "").trim()
    if (!targetExamId || targetExamId !== String(submission.exam_id)) {
      return { allowed: false as const, status: 403, error: "La entrega no pertenece al examen indicado" }
    }
    return { allowed: true as const }
  }

  // Toda acción no pública sigue requiriendo sesión; si no tiene un target
  // conocido, el dispatcher decidirá si es válida sin exponer datos privados.
  return { allowed: true as const }
}
`

  source = source.slice(0, evaluationStart) + replacement + source.slice(postStart)
  changed = true
}

const postAuthMarker = `    const body = await request.json()
    const { action } = body`
const postAuthBlock = `${postAuthMarker}

    if (!PUBLIC_STUDENT_ACTIONS.has(String(action || ""))) {
      const teacherId = await currentTeacherId()
      if (!teacherId) {
        return NextResponse.json({ error: "Autenticación docente requerida" }, { status: 401 })
      }

      // Nunca confiar en teacherId enviado por el navegador.
      body.teacherId = teacherId
      const authorization = await authorizeTeacherAction(String(action || ""), body, teacherId)
      if (!authorization.allowed) {
        return NextResponse.json({ error: authorization.error }, { status: authorization.status })
      }
    }`

if (!source.includes("Autenticación docente requerida")) {
  if (!source.includes(postAuthMarker)) throw new Error("[exam-server-auth] POST auth marker no encontrado")
  source = source.replace(postAuthMarker, postAuthBlock)
  changed = true
}

source = source.replaceAll(
  '.select("id, questions, settings, status")',
  '.select("id, teacher_id, questions, settings, status")',
)

const oldEvalCall = "gradedAnswers = await evaluateWithAI(sanitizedQuestions, gradedAnswers)"
const newEvalCall = `gradedAnswers = await evaluateWithAI(sanitizedQuestions, gradedAnswers, {
        teacherId: String(officialExam.teacher_id),
        examId: String(examId),
      })`
if (!source.includes(newEvalCall)) {
  if (!source.includes(oldEvalCall)) throw new Error("[exam-server-auth] evaluateWithAI call no encontrado")
  source = source.replace(oldEvalCall, newEvalCall)
  changed = true
}

const getStart = source.indexOf("export async function GET(request: NextRequest) {")
if (getStart < 0) throw new Error("[exam-server-auth] GET marker no encontrado")

if (!source.slice(getStart).includes("Acceso docente requerido")) {
  const getReplacement = `export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const requestedTeacherId = searchParams.get("teacherId")
    const examId = searchParams.get("examId")

    // Consulta pública para estudiantes: nunca expone claves de respuesta.
    if (code) {
      const { data, error } = await supabase
        .from("teacher_exams")
        .select("id, code, title, topic, instructions, questions, settings, status")
        .eq("code", code)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })
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

    const auth = await createServerClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Acceso docente requerido" }, { status: 401 })
    }

    if (examId) {
      const { data: exam, error: examError } = await supabase
        .from("teacher_exams")
        .select("*")
        .eq("id", examId)
        .eq("teacher_id", user.id)
        .maybeSingle()

      if (examError || !exam) {
        return NextResponse.json({ error: "Examen no encontrado para este docente" }, { status: 404 })
      }

      const { data: submissions, error: submissionsError } = await supabase
        .from("exam_submissions")
        .select("*")
        .eq("exam_id", examId)
        .order("submitted_at", { ascending: true })

      if (submissionsError) throw submissionsError
      return NextResponse.json({ exam, submissions: submissions || [] })
    }

    if (requestedTeacherId) {
      if (requestedTeacherId !== user.id) {
        return NextResponse.json({ error: "No puedes consultar exámenes de otro docente" }, { status: 403 })
      }

      const showDeleted = searchParams.get("showDeleted") === "true"
      const query = supabase
        .from("teacher_exams")
        .select("id, code, title, topic, status, created_at, settings, deleted_at")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false })

      const { data, error } = showDeleted
        ? await query.not("deleted_at", "is", null)
        : await query.is("deleted_at", null)
      if (error) throw error

      const examsWithCount = await Promise.all(
        (data || []).map(async (exam: any) => {
          const { count } = await supabase
            .from("exam_submissions")
            .select("*", { count: "exact", head: true })
            .eq("exam_id", exam.id)

          return { ...exam, submissionCount: count || 0 }
        })
      )

      return NextResponse.json({ exams: examsWithCount })
    }

    return NextResponse.json({ error: "Parámetros faltantes" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error interno del servidor" },
      { status: 500 }
    )
  }
}`

  source = source.slice(0, getStart) + getReplacement + "\n"
  changed = true
}

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[exam-server-auth] acciones docentes autenticadas + grading migrado a AI Gateway")
} else {
  console.log("[exam-server-auth] ya aplicado")
}
