import fs from "node:fs"

const sql = fs.readFileSync("supabase/migrations/20260818181006_optimize_hot_rls_policies.sql", "utf8")

for (const marker of [
  "notebooks_select",
  "nb_sources_select",
  "nb_chunks_select",
  "nb_messages_select",
  "messages_select_own",
  "video_jobs_insert_own",
  "video_jobs_read_own",
  "video_jobs_update_own",
]) {
  if (!sql.includes(marker)) throw new Error(`[hot-rls] missing policy ${marker}`)
}

if (!sql.includes("(select auth.uid())")) {
  throw new Error("[hot-rls] auth.uid() must be statement-scoped")
}

for (const legacy of [
  '"Users can insert their own video jobs"',
  '"Users can read their own video jobs"',
  '"Users can update their own video jobs"',
  '"Users can view their own video jobs"',
  "video_jobs_select_own",
]) {
  if (!sql.includes(`drop policy if exists ${legacy}`)) {
    throw new Error(`[hot-rls] overlapping Video policy not removed: ${legacy}`)
  }
}

for (const policy of ["video_jobs_insert_own", "video_jobs_read_own", "video_jobs_update_own"]) {
  const matches = sql.match(new RegExp(`alter policy ${policy}\\b`, "g")) || []
  if (matches.length !== 1) throw new Error(`[hot-rls] canonical Video policy must be altered exactly once: ${policy}`)
}

console.log("[hot-rls] Notebook/RAG/messages use statement-scoped auth and Video keeps one policy per operation")
