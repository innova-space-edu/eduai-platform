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
]) requireText(saveRoute, text, label)

const saveDraftGuard = saveRoute.indexOf('.from("exam_attempt_drafts")')
const firstStorageWrite = saveRoute.indexOf("supabase.storage.from(BUCKET).upload")
const evaluatorCall = saveRoute.indexOf("const evaluation = await evaluateLatex")
if (!(saveDraftGuard >= 0 && firstStorageWrite > saveDraftGuard && evaluatorCall > saveDraftGuard)) {
  throw new Error("[exam-development-security-test] El intento debe verificarse antes de Storage y del evaluador")
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

if (saveRoute.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") || reviewRoute.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) {
  throw new Error("[exam-development-security-test] service role no puede exponerse como NEXT_PUBLIC")
}

console.log("[exam-development-security-test] intent capability + teacher-owned signed URLs verified")
