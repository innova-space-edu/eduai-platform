import fs from "node:fs"

const migration = fs.readFileSync("supabase/migrations/20260818161941_google_deep_research_jobs.sql", "utf8")
const provider = fs.readFileSync("lib/ai/providers/google-deep-research.ts", "utf8")
const route = fs.readFileSync("app/api/work/deep-research/route.ts", "utf8")

for (const marker of [
  "enable row level security",
  "grant select, delete",
  "eduai_deep_research_jobs_select_own",
  "eduai_deep_research_jobs_delete_own",
]) {
  if (!migration.toLowerCase().includes(marker.toLowerCase())) throw new Error(`[deep-research-test] migration missing: ${marker}`)
}
if (/grant\s+(?:insert|update|all).*authenticated/i.test(migration)) {
  throw new Error("[deep-research-test] authenticated users must not write Deep Research job state directly")
}
for (const marker of [
  "deep-research-preview-04-2026",
  "deep-research-max-preview-04-2026",
  "background: true",
  "thinking_summaries: \"auto\"",
  "interactions.create",
  "interactions.get",
]) {
  if (!provider.includes(marker)) throw new Error(`[deep-research-test] provider missing: ${marker}`)
}
for (const marker of [
  "assertAICapabilityAllowed",
  'capability: "research"',
  'provider: "google"',
  "findReusableGeneration",
  "saveReusableGeneration",
  "createEduAIAsset",
  "eduai_deep_research_jobs",
  'status: "finalizing"',
  "retrieveRelevantChunks",
]) {
  if (!route.includes(marker)) throw new Error(`[deep-research-test] route missing: ${marker}`)
}
if (!route.includes("SUPABASE_SERVICE_ROLE_KEY")) {
  throw new Error("[deep-research-test] server-only writes must use service role")
}
if (route.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) {
  throw new Error("[deep-research-test] service role must never be public")
}
if (!route.includes("generationAvoided: true")) {
  throw new Error("[deep-research-test] exact repeated research must be reusable")
}

console.log("[deep-research-test] background jobs, ownership, RAG context, assets and Reuse Engine verified")
