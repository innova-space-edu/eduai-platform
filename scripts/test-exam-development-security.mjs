import fs from "node:fs"
import path from "node:path"

await import("./apply-exam-development-security.mjs")

const saveRoute = fs.readFileSync(
  path.join(process.cwd(), "app", "api", "examen", "developments", "route.ts"),
  "utf8",
)
const reviewRoute = fs.readFileSync(
  path.join(process.cwd(), "app", "api", "examen", "developments", "by-submission", "route.ts"),
  "utf8",
)
const feedbackRoute = fs.readFileSync(
  path.join(process.cwd(), "app", "api", "agents", "exam-feedback", "route.ts"),
  "utf8",
)
const studentPage = fs.readFileSync(
  path.join(process.cwd(), "app", "examen", "p", "[code]", "page.tsx"),
  "utf8",
)

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`[exam-development-security-test] Falta ${label}: ${text}`)
}

for (const [label, text] of [
  ["draft table", '.from("exam_attempt_drafts")'],
  ["exam capability", '.eq("exam_id", examId)'],
  ["attempt capability", '.eq("client_attempt_id", clientAttemptId)'],
  ["active attempt", 'draft.status === "in_progress"'],
  ["submitted retry", 'draft.status === "submitted"'],
  ["submission binding", 'requestedSubmissionId === draftSubmissionId'],
  ["closed attempt", 'El intento ya no acepta cambios de desarrollo.'],
  ["official exam", '.from("teacher_exams")'],
  ["official questions", '.select("questions")'],
  ["official question index", 'const officialQuestion = officialQuestions[questionIndex] as any'],
  ["official question id", 'const officialQuestionId = String(officialQuestion.id'],
  ["question id binding", 'requestedQuestionId !== officialQuestionId'],
  ["official prompt", 'const officialQuestionText = String(officialQuestion.question'],
  ["official answer", 'const officialExpectedLatex = String('],
  ["official steps", 'const officialExpectedSteps = Array.isArray(officialQuestion.expectedSteps)'],
  ["official rubric", 'const officialRubric = Array.isArray(officialQuestion.rubric)'],
  ["official score", 'const officialMaxPoints = getQuestionMaxPoints(officialQuestion)'],
  ["server evaluator answer", 'expectedLatex: officialExpectedLatex'],
  ["server evaluator rubric", 'rubric: officialRubric'],
  ["server evaluator points", 'maxPoints: officialMaxPoints'],
]) requireText(saveRoute, text, label)

const saveDraftGuard = saveRoute.indexOf('.from("exam_attempt_drafts")')
const officialExamRead = saveRoute.indexOf('.from("teacher_exams")')
const firstStorageWrite = saveRoute.indexOf("supabase.storage.from(BUCKET).upload")
const evaluatorCall = saveRoute.indexOf("const evaluation = await evaluateLatex")
if (!(saveDraftGuard >= 0 && officialExamRead > saveDraftGuard && firstStorageWrite > officialExamRead && evaluatorCall > officialExamRead)) {
  throw new Error("[exam-development-security-test] Intento y pauta oficial deben verificarse antes de Storage/evaluador")
}
if (saveRoute.includes("question_id: questionId") || saveRoute.includes("      questionId,")) {
  throw new Error("[exam-development-security-test] La identidad de la pregunta no puede depender del navegador")
}
if (saveRoute.includes("expectedLatex: body.expectedLatex") || saveRoute.includes("rubric: body.rubric") || saveRoute.includes("maxPoints: body.maxPoints")) {
  throw new Error("[exam-development-security-test] La pauta/rúbrica/puntaje no pueden venir del navegador")
}

for (const [label, text] of [
  ["server auth import", 'createClient as createServerClient'],
  ["teacher session", 'const auth = await createServerClient()'],
  ["auth getUser", 'await auth.auth.getUser()'],
  ["teacher ownership table", '.from("teacher_exams")'],
  ["teacher ownership", '.eq("teacher_id", user.id)'],
  ["owner-safe not found", 'Entrega no encontrada para este docente'],
]) requireText(reviewRoute, text, label)

const authIndex = reviewRoute.indexOf("const auth = await createServerClient()")
const submissionRead = reviewRoute.indexOf('.from("exam_submissions")')
const ownershipIndex = reviewRoute.indexOf('.eq("teacher_id", user.id)')
const developmentsRead = reviewRoute.indexOf('.from("exam_question_developments")')
const signedUrlUse = reviewRoute.indexOf("previewPngUrl: await createSignedUrl")
if (!(authIndex >= 0 && submissionRead > authIndex)) {
  throw new Error("[exam-development-security-test] La sesión docente debe validarse antes de leer la entrega")
}
if (!(ownershipIndex > submissionRead && developmentsRead > ownershipIndex && signedUrlUse > ownershipIndex)) {
  throw new Error("[exam-development-security-test] Ownership docente debe preceder desarrollos y URLs firmadas")
}

for (const [label, text] of [
  ["feedback fail closed client", "function getFeedbackAdminClient()"],
  ["feedback service role", "process.env.SUPABASE_SERVICE_ROLE_KEY"],
  ["feedback attempt input", "clientAttemptId requerido"],
  ["feedback attempt column", 'answers, client_attempt_id'],
  ["feedback submission binding", '.eq("id", safeSubmissionId)'],
  ["feedback attempt binding", '.eq("client_attempt_id", safeAttemptId)'],
]) requireText(feedbackRoute, text, label)

if (feedbackRoute.includes("SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
  throw new Error("[exam-development-security-test] Feedback no puede degradar service role hacia anon key")
}
const feedbackClient = feedbackRoute.indexOf("const supabase = getFeedbackAdminClient()")
const feedbackRead = feedbackRoute.indexOf('.from("exam_submissions")')
const feedbackAttemptBinding = feedbackRoute.indexOf('.eq("client_attempt_id", safeAttemptId)')
if (!(feedbackClient >= 0 && feedbackRead > feedbackClient && feedbackAttemptBinding > feedbackRead)) {
  throw new Error("[exam-development-security-test] Feedback debe enlazar submission + attempt antes de leer la pauta")
}

requireText(studentPage, "clientAttemptId: attemptIdRef.current", "student feedback capability")

if (
  saveRoute.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") ||
  reviewRoute.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") ||
  feedbackRoute.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
) {
  throw new Error("[exam-development-security-test] service role no puede exponerse como NEXT_PUBLIC")
}

console.log("[exam-development-security-test] attempt + official rubric + teacher URLs + student feedback capability verified")
