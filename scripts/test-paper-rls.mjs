import fs from "node:fs"

const sql = fs.readFileSync("supabase/migrations/20260818181716_optimize_paper_rls_policies.sql", "utf8")

for (const policy of [
  "paper_documents_select_own",
  "paper_documents_insert_own",
  "paper_documents_update_own",
  "paper_documents_delete_own",
  "paper_chunks_select_own",
  "paper_chunks_insert_own",
  "paper_chunks_update_own",
  "paper_chunks_delete_own",
  '"Users can insert own paper extractions"',
  '"Users can read own paper extractions"',
  '"Users can update own paper extractions"',
  "paper_extractions_delete_own",
]) {
  if (!sql.includes(policy)) throw new Error(`[paper-rls] missing policy ${policy}`)
}

if (!sql.includes("(select auth.uid())")) throw new Error("[paper-rls] auth.uid() must be statement-scoped")

for (const duplicate of [
  "paper_extractions_insert_own",
  "paper_extractions_select_own",
  "paper_extractions_update_own",
]) {
  if (!sql.includes(`drop policy if exists ${duplicate}`)) {
    throw new Error(`[paper-rls] duplicate extraction policy not removed: ${duplicate}`)
  }
}

const altered = sql.match(/alter policy/g) || []
if (altered.length < 12) throw new Error("[paper-rls] expected complete Paper ownership policy normalization")

console.log("[paper-rls] Paper documents/chunks/extractions use authenticated statement-scoped ownership without duplicates")
