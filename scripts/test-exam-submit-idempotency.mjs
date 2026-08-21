import fs from "node:fs"
import path from "node:path"

await import("./apply-exam-submit-idempotency.mjs")

const target = path.join(process.cwd(), "app", "api", "agents", "examen-docente", "route.ts")
const source = fs.readFileSync(target, "utf8")

function requireText(text, label) {
  if (!source.includes(text)) throw new Error(`[test-exam-submit-idempotency] Falta ${label}: ${text}`)
}

for (const [label, text] of [
  ["attempt id recuperable", 'let effectiveClientAttemptId = String(clientAttemptId || "").trim()'],
  ["lookup draft", '.from("exam_attempt_drafts")'],
  ["draft identity rut", '.eq("student_rut_clean", rutClean)'],
  ["draft identity course", '.eq("student_course", normalizedStudentCourse)'],
  ["submission lookup", '.from("exam_submissions")'],
  ["replay flag", 'deduplicated: true'],
  ["generation avoided", 'generationAvoided: true'],
  ["existing response", 'submission: existingSubmission'],
  ["stable course", 'student_course:  normalizedStudentCourse'],
]) requireText(text, label)

const submitStart = source.indexOf('if (action === "submit")')
const dedupeCheck = source.indexOf("if (existingSubmission) {", submitStart)
const gradingCall = source.indexOf("gradedAnswers = await evaluateWithAI(", submitStart)
if (!(submitStart >= 0 && dedupeCheck > submitStart && gradingCall > dedupeCheck)) {
  throw new Error("[test-exam-submit-idempotency] La entrega existente debe comprobarse antes de cualquier evaluación IA")
}

const officialExamLookup = source.indexOf("const { data: officialExam, error: officialExamError }", submitStart)
if (!(dedupeCheck > submitStart && officialExamLookup > dedupeCheck)) {
  throw new Error("[test-exam-submit-idempotency] La reutilización debe resolverse antes del flujo completo de corrección")
}

console.log("[test-exam-submit-idempotency] reenvíos públicos no vuelven a consumir corrección IA")
