import fs from "node:fs"
import path from "node:path"

await import("./apply-exam-server-auth-gateway.mjs")

const target = path.join(process.cwd(), "app", "api", "agents", "examen-docente", "route.ts")
const source = fs.readFileSync(target, "utf8")

function requireText(text, label) {
  if (!source.includes(text)) throw new Error(`[test-exam-server-auth] Falta ${label}: ${text}`)
}

for (const [label, text] of [
  ["server auth import", 'createClient as createServerClient'],
  ["AI Gateway import", 'runAIStructured'],
  ["public student action allowlist", 'const PUBLIC_STUDENT_ACTIONS = new Set(['],
  ["public exam action", '"public_exam_by_code"'],
  ["public resume action", '"start_or_resume_attempt"'],
  ["public autosave action", '"autosave_attempt"'],
  ["public submit action", '"submit"'],
  ["teacher session", 'const teacherId = await currentTeacherId()'],
  ["ignore client teacher id", 'body.teacherId = teacherId'],
  ["central ownership", 'authorizeTeacherAction(String(action || ""), body, teacherId)'],
  ["owned exam", '.eq("teacher_id", teacherId)'],
  ["owned submission", 'const exam = await ownedExam(submission.exam_id, teacherId)'],
  ["extra time exam match", 'targetExamId !== String(submission.exam_id)'],
  ["private GET auth", 'Acceso docente requerido'],
  ["private GET ownership", '.eq("teacher_id", user.id)'],
  ["cross teacher GET block", 'No puedes consultar exámenes de otro docente'],
  ["teacher id on submit", '.select("id, teacher_id, questions, settings, status")'],
  ["grading context teacher", 'teacherId: String(officialExam.teacher_id)'],
  ["grading context exam", 'examId: String(examId)'],
  ["structured grading", 'runAIStructured<{ evaluations: Array<{'],
  ["grading module", 'module: "exam-grading"'],
  ["private reuse", 'reusePolicy: "exact_private"'],
  ["private visibility", 'visibility: "private"'],
]) requireText(text, label)

for (const legacyModel of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]) {
  if (source.includes(legacyModel)) {
    throw new Error(`[test-exam-server-auth] Modelo legacy hardcodeado todavía presente: ${legacyModel}`)
  }
}

if (source.includes('const geminiModels = [')) {
  throw new Error("[test-exam-server-auth] La evaluación abierta todavía usa routing Gemini manual")
}
if (source.includes('new Groq({ apiKey: groqKey })')) {
  throw new Error("[test-exam-server-auth] La evaluación abierta todavía instancia Groq fuera del AI Gateway")
}

const postStart = source.indexOf("export async function POST(request: NextRequest) {")
const publicAction = source.indexOf('if (action === "public_exam_by_code")', postStart)
const authGuard = source.indexOf('if (!PUBLIC_STUDENT_ACTIONS.has(String(action || "")))', postStart)
if (!(postStart >= 0 && authGuard > postStart && publicAction > authGuard)) {
  throw new Error("[test-exam-server-auth] La barrera docente debe ejecutarse antes del dispatcher de acciones")
}

const getStart = source.indexOf("export async function GET(request: NextRequest) {")
const getPublic = source.indexOf("if (code) {", getStart)
const getAuth = source.indexOf("const auth = await createServerClient()", getStart)
if (!(getStart >= 0 && getPublic > getStart && getAuth > getPublic)) {
  throw new Error("[test-exam-server-auth] GET por código debe seguir público y la autenticación debe preceder los GET privados")
}

console.log("[test-exam-server-auth] acciones docentes ownership-safe + grading AI Core verificados")
