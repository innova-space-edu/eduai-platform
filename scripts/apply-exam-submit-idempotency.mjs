import fs from "node:fs"
import path from "node:path"

const target = path.join(process.cwd(), "app", "api", "agents", "examen-docente", "route.ts")
if (!fs.existsSync(target)) throw new Error("[exam-submit-idempotency] examen-docente route no encontrada")

let source = fs.readFileSync(target, "utf8")
let changed = false

const oldAttemptId = `      const rutClean = normalizeRutClean(studentRut)
      const effectiveClientAttemptId = String(clientAttemptId || createServerAttemptId())`
const newAttemptId = `      const rutClean = normalizeRutClean(studentRut)
      let effectiveClientAttemptId = String(clientAttemptId || "").trim()`

if (!source.includes(newAttemptId)) {
  if (!source.includes(oldAttemptId)) throw new Error("[exam-submit-idempotency] marcador clientAttemptId no encontrado")
  source = source.replace(oldAttemptId, newAttemptId)
  changed = true
}

const validationMarker = `      if (!isValidRut(rutClean)) {
        return NextResponse.json(
          { error: "RUT inválido. Escríbelo sin puntos ni guion, incluyendo el dígito verificador o K." },
          { status: 400 }
        )
      }

      const { data: officialExam, error: officialExamError } = await supabase`

const guardedValidation = `      if (!isValidRut(rutClean)) {
        return NextResponse.json(
          { error: "RUT inválido. Escríbelo sin puntos ni guion, incluyendo el dígito verificador o K." },
          { status: 400 }
        )
      }

      const normalizedStudentCourse = String(studentCourse).trim()

      // Recupera el intento persistido cuando el cliente perdió el id local.
      // Esto mantiene una identidad estable para el submit y evita crear intentos
      // distintos para el mismo RUT/curso/examen.
      const { data: existingDraft, error: existingDraftError } = await supabase
        .from("exam_attempt_drafts")
        .select("id, client_attempt_id, status, submission_id")
        .eq("exam_id", examId)
        .eq("student_rut_clean", rutClean)
        .eq("student_course", normalizedStudentCourse)
        .maybeSingle()

      if (existingDraftError) throw existingDraftError
      if (!effectiveClientAttemptId && existingDraft?.client_attempt_id) {
        effectiveClientAttemptId = String(existingDraft.client_attempt_id)
      }

      // Idempotencia antes de cualquier llamada IA. Una entrega previa para el
      // mismo examen + RUT + curso se devuelve tal cual; no se vuelve a corregir.
      let existingSubmission: any = null
      if (existingDraft?.submission_id) {
        const { data, error } = await supabase
          .from("exam_submissions")
          .select("*")
          .eq("id", existingDraft.submission_id)
          .eq("exam_id", examId)
          .maybeSingle()
        if (error) throw error
        existingSubmission = data || null
      }

      if (!existingSubmission) {
        const { data, error } = await supabase
          .from("exam_submissions")
          .select("*")
          .eq("exam_id", examId)
          .eq("student_rut_clean", rutClean)
          .eq("student_course", normalizedStudentCourse)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw error
        existingSubmission = data || null
      }

      if (existingSubmission) {
        const { data: existingExam } = await supabase
          .from("teacher_exams")
          .select("questions, settings")
          .eq("id", examId)
          .maybeSingle()
        const existingQuestions = sanitizeQuestions(existingExam?.questions || [])
        const showExistingResult = existingExam?.settings?.showResultToStudent !== false
        return NextResponse.json({
          success: true,
          deduplicated: true,
          generationAvoided: true,
          submission: existingSubmission,
          reviewQuestions: showExistingResult
            ? existingQuestions.map(buildStudentReviewQuestion)
            : [],
        })
      }

      if (!effectiveClientAttemptId) {
        effectiveClientAttemptId = createServerAttemptId()
      }

      const { data: officialExam, error: officialExamError } = await supabase`

if (!source.includes("generationAvoided: true,\n          submission: existingSubmission")) {
  if (!source.includes(validationMarker)) throw new Error("[exam-submit-idempotency] bloque de validación submit no encontrado")
  source = source.replace(validationMarker, guardedValidation)
  changed = true
}

// El upsert debe usar el curso normalizado que participó en la identidad idempotente.
if (source.includes("          student_course:  studentCourse,")) {
  source = source.replace("          student_course:  studentCourse,", "          student_course:  normalizedStudentCourse,")
  changed = true
}

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[exam-submit-idempotency] reenvíos públicos reutilizan la entrega antes de gastar IA")
} else {
  console.log("[exam-submit-idempotency] ya aplicado")
}
