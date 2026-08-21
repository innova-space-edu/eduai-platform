import fs from "node:fs"

// Reuse the canonical exam auth regression suite instead of maintaining a
// second set of route markers that can diverge from exam-server-auth-gateway.
await import("./test-exam-server-auth-gateway.mjs")
await import("./test-exam-development-security.mjs")

const migration = fs.readFileSync(
  "supabase/migrations/20260818182329_secure_exam_submissions_rls.sql",
  "utf8",
)

if (
  !migration.includes('drop policy if exists "Anyone can submit"') ||
  !migration.includes('drop policy if exists "Student reads own submission"')
) {
  throw new Error("[exam-admin-auth-test] public submission policies were not removed")
}
if (!migration.includes("(select auth.uid())") || !migration.includes("to authenticated")) {
  throw new Error(
    "[exam-admin-auth-test] teacher submission read policy is not authenticated/statement-scoped",
  )
}
if (/using\s*\(\s*true\s*\)/i.test(migration) || /with\s+check\s*\(\s*true\s*\)/i.test(migration)) {
  throw new Error("[exam-admin-auth-test] exam_submissions must not keep public true policies")
}

console.log(
  "[exam-admin-auth-test] canonical teacher auth + development security + closed exam_submissions RLS verified",
)
