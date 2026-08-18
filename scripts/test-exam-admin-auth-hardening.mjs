import fs from "node:fs"
import { spawnSync } from "node:child_process"

for (let run = 0; run < 2; run += 1) {
  const result = spawnSync(process.execPath, ["scripts/apply-exam-admin-auth-hardening.mjs"], { encoding: "utf8" })
  if (result.status !== 0) throw new Error(`[exam-admin-auth-test] apply run ${run + 1} failed: ${result.stderr || result.stdout}`)
}

const route = fs.readFileSync("app/api/agents/examen-docente/route.ts", "utf8")
const migration = fs.readFileSync("supabase/migrations/20260818182329_secure_exam_submissions_rls.sql", "utf8")

const publicMatch = route.match(/const PUBLIC_STUDENT_ACTIONS = new Set\(\[([\s\S]*?)\]\)/)
if (!publicMatch) throw new Error("[exam-admin-auth-test] public student action set missing")
const publicActions = [...publicMatch[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]).sort()
const expected = ["autosave_attempt", "public_exam_by_code", "start_or_resume_attempt", "submit"].sort()
if (JSON.stringify(publicActions) !== JSON.stringify(expected)) {
  throw new Error(`[exam-admin-auth-test] unexpected public actions: ${publicActions.join(",")}`)
}

for (const marker of [
  'createClient as createServerSupabaseClient',
  'authClient.auth.getUser()',
  'teacherId && teacherId !== userId',
  '.from("exam_submissions")',
  '.select("exam_id")',
  '.from("teacher_exams")',
  '.select("id, teacher_id")',
  'EXAM_ADMIN_POST_AUTH_GATE',
  '!PUBLIC_STUDENT_ACTIONS.has(String(action || ""))',
  'EXAM_ADMIN_GET_AUTH_GATE',
  'if (examId || teacherId)',
]) {
  if (!route.includes(marker)) throw new Error(`[exam-admin-auth-test] missing route marker: ${marker}`)
}

const postGate = route.indexOf("EXAM_ADMIN_POST_AUTH_GATE")
const createAction = route.indexOf('if (action === "create")')
if (postGate < 0 || createAction < 0 || postGate > createAction) {
  throw new Error("[exam-admin-auth-test] teacher actions are not behind the POST auth gate")
}

const getStart = route.indexOf("export async function GET(request: NextRequest)")
const publicCode = route.indexOf("if (code)", getStart)
const getGate = route.indexOf("EXAM_ADMIN_GET_AUTH_GATE", getStart)
if (getStart < 0 || publicCode < 0 || getGate < 0 || publicCode > getGate) {
  throw new Error("[exam-admin-auth-test] public sanitized code lookup must remain before private GET gate")
}

if (!migration.includes('drop policy if exists "Anyone can submit"') || !migration.includes('drop policy if exists "Student reads own submission"')) {
  throw new Error("[exam-admin-auth-test] public submission policies were not removed")
}
if (!migration.includes('(select auth.uid())') || !migration.includes('to authenticated')) {
  throw new Error("[exam-admin-auth-test] teacher submission read policy is not authenticated/statement-scoped")
}
if (/using\s*\(\s*true\s*\)/i.test(migration) || /with\s+check\s*\(\s*true\s*\)/i.test(migration)) {
  throw new Error("[exam-admin-auth-test] exam_submissions must not keep public true policies")
}

console.log("[exam-admin-auth-test] public student actions preserved; teacher/admin routes require authenticated ownership")
