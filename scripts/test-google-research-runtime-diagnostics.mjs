import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const applyPath = path.join(root, "scripts/apply-google-research-runtime-diagnostics.mjs")
for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [applyPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) throw new Error(`[test-google-research-runtime] apply run ${i + 1} failed: ${run.stderr || run.stdout}`)
}

const health = fs.readFileSync("app/api/admin/ai-core/health/route.ts", "utf8")
const panel = fs.readFileSync("components/admin/AICoreHealthPanel.tsx", "utf8")
const stage2 = fs.readFileSync("scripts/apply-production-hardening-stage2.mjs", "utf8")
const env = fs.readFileSync(".env.example", "utf8")

for (const table of ["eduai_deep_research_jobs", "eduai_google_file_search_stores", "eduai_google_file_search_documents"]) {
  if (!health.includes(`"${table}"`)) throw new Error(`[test-google-research-runtime] missing required table ${table}`)
}
for (const marker of ["deepResearch: hasGoogleDeepResearch()", "fileSearch: hasGoogleFileSearch()", "fileSearchEmbeddingModel: googleFileSearchEmbeddingModel()"]) {
  if (!health.includes(marker)) throw new Error(`[test-google-research-runtime] missing health marker ${marker}`)
}
if (!panel.includes("Google Deep Research") || !panel.includes("Google File Search") || !panel.includes("File Search embeddings:")) {
  throw new Error("[test-google-research-runtime] Model Lab does not surface Google research diagnostics")
}
if (!stage2.includes("apply-google-research-runtime-diagnostics.mjs") || !stage2.includes("test-google-research-runtime-diagnostics.mjs")) {
  throw new Error("[test-google-research-runtime] diagnostics are not wired into stage2")
}
if (!env.includes("GOOGLE_FILE_SEARCH_EMBEDDING_MODEL=models/gemini-embedding-2") || !env.includes("GOOGLE_DEEP_RESEARCH_MAX_ENABLED=false") || !env.includes("EDUAI_AI_PROVIDER_ORDER_RETRIEVAL=google")) {
  throw new Error("[test-google-research-runtime] environment reference is incomplete")
}
if (/fileSearch(?:ApiKey|Key)|deepResearch(?:ApiKey|Key)/i.test(health)) {
  throw new Error("[test-google-research-runtime] health response must not expose Google secrets")
}

console.log("[test-google-research-runtime] Google Deep Research/File Search diagnostics, tables and env docs verified")
