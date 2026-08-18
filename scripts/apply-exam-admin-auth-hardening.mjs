import fs from "node:fs"
import path from "node:path"

const routePath = path.join(process.cwd(), "app/api/agents/examen-docente/route.ts")
let source = fs.readFileSync(routePath, "utf8")
let changed = false

if (!source.includes('createClient as createServerSupabaseClient')) {
  const marker = 'import { createClient } from "@supabase/supabase-js"\n'
  if (!source.includes(marker)) throw new Error("[exam-admin-auth] Supabase import marker missing")
  source = source.replace(
    marker,
    `${marker}import { createClient as createServerSupabaseClient } from "@/lib/supabase/server"\n`,
  )
  changed = true
}

if (!source.includes("const PUBLIC_STUDENT_ACTIONS = new Set")) {
  const marker = "function createServerAttemptId(): string {"
  if (!source.includes(marker)) throw new Error("[exam-admin-auth] helper insertion marker missing")
  const helper = `const PUBLIC_STUDENT_ACTIONS = new Set([\n  "public_exam_by_code",\n  "start_or_resume_attempt",\n  "autosave_attempt",\n  "submit",\n])\n\nasync function getAuthenticatedExamUser() {\n  const authClient = await createServerSupabaseClient()\n  const { data: { user }, error } = await authClient.auth.getUser()\n  return error ? null : user\n}\n\nasync function verifyTeacherScope(userId: string, input: {\n  teacherId?: string | null\n  examId?: string | null\n  submissionId?: string | null\n}) {\n  const teacherId = String(input.teacherId || "").trim() || null\n  let examId = String(input.examId || "").trim() || null\n  const submissionId = String(input.submissionId || "").trim() || null\n\n  if (teacherId && teacherId !== userId) {\n    return { ok: false as const, status: 403, error: "No autorizado para este docente" }\n  }\n\n  if (submissionId) {\n    const { data: submission, error } = await supabase\n      .from("exam_submissions")\n      .select("exam_id")\n      .eq("id", submissionId)\n      .maybeSingle()\n    if (error) return { ok: false as const, status: 500, error: error.message }\n    if (!submission) return { ok: false as const, status: 404, error: "Entrega no encontrada" }\n    if (examId && examId !== submission.exam_id) {\n      return { ok: false as const, status: 403, error: "La entrega no pertenece al examen indicado" }\n    }\n    examId = String(submission.exam_id)\n  }\n\n  if (examId) {\n    const { data: exam, error } = await supabase\n      .from("teacher_exams")\n      .select("id, teacher_id")\n      .eq("id", examId)\n      .maybeSingle()\n    if (error) return { ok: false as const, status: 500, error: error.message }\n    if (!exam) return { ok: false as const, status: 404, error: "Examen no encontrado" }\n    if (exam.teacher_id !== userId) {\n      return { ok: false as const, status: 403, error: "No autorizado para este examen" }\n    }\n  }\n\n  return { ok: true as const }\n}\n\n`
  source = source.replace(marker, helper + marker)
  changed = true
}

if (!source.includes("EXAM_ADMIN_POST_AUTH_GATE")) {
  const marker = `    const body = await request.json()\n    const { action } = body\n\n    // ── Cargar examen público por código (estudiantes) ──────────────────────`
  if (!source.includes(marker)) throw new Error("[exam-admin-auth] POST action marker missing")
  const replacement = `    const body = await request.json()\n    const { action } = body\n\n    // EXAM_ADMIN_POST_AUTH_GATE\n    if (!PUBLIC_STUDENT_ACTIONS.has(String(action || ""))) {\n      const user = await getAuthenticatedExamUser()\n      if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })\n\n      const scope = await verifyTeacherScope(user.id, {\n        teacherId: typeof body.teacherId === "string" ? body.teacherId : null,\n        examId: typeof body.examId === "string" ? body.examId : null,\n        submissionId: typeof body.submissionId === "string" ? body.submissionId : null,\n      })\n      if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })\n    }\n\n    // ── Cargar examen público por código (estudiantes) ──────────────────────`
  source = source.replace(marker, replacement)
  changed = true
}

if (!source.includes("EXAM_ADMIN_GET_AUTH_GATE")) {
  const getStart = source.indexOf("export async function GET(request: NextRequest)")
  if (getStart < 0) throw new Error("[exam-admin-auth] GET route missing")
  const marker = "    if (examId) {"
  const markerIndex = source.indexOf(marker, getStart)
  if (markerIndex < 0) throw new Error("[exam-admin-auth] GET examId branch marker missing")
  const gate = `    // EXAM_ADMIN_GET_AUTH_GATE\n    if (examId || teacherId) {\n      const user = await getAuthenticatedExamUser()\n      if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })\n\n      const scope = await verifyTeacherScope(user.id, { teacherId, examId })\n      if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })\n    }\n\n`
  source = source.slice(0, markerIndex) + gate + source.slice(markerIndex)
  changed = true
}

if (!source.includes("EXAM_ADMIN_POST_AUTH_GATE") || !source.includes("EXAM_ADMIN_GET_AUTH_GATE")) {
  throw new Error("[exam-admin-auth] auth gates were not materialized")
}

if (changed) {
  fs.writeFileSync(routePath, source)
  console.log("[exam-admin-auth] teacher/admin exam routes require authenticated ownership")
} else {
  console.log("[exam-admin-auth] already applied")
}
