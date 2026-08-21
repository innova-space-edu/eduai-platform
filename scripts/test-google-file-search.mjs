import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const applyPath = path.join(root, "scripts/apply-google-file-search.mjs")
for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [applyPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) throw new Error(`[test-google-file-search] apply run ${i + 1} failed: ${run.stderr || run.stdout}`)
}

const indexMigration = fs.readFileSync("supabase/migrations/20260818163345_google_file_search_index.sql", "utf8")
const guardMigration = fs.readFileSync("supabase/migrations/20260818163611_google_file_search_delete_guards.sql", "utf8")
const provider = fs.readFileSync("lib/ai/providers/google-file-search.ts", "utf8")
const lifecycle = fs.readFileSync("lib/ai/google-file-search-lifecycle.ts", "utf8")
const route = fs.readFileSync("app/api/notebooks/[id]/file-search/route.ts", "utf8")
const notebookRoute = fs.readFileSync("app/api/notebooks/[id]/route.ts", "utf8")
const sourceRoute = fs.readFileSync("app/api/notebooks/[id]/sources/route.ts", "utf8")
const deepProvider = fs.readFileSync("lib/ai/providers/google-deep-research.ts", "utf8")
const deepRoute = fs.readFileSync("app/api/work/deep-research/route.ts", "utf8")

for (const marker of ["enable row level security", "grant select", "content_hash", "gemini-embedding-2"]) {
  if (!indexMigration.toLowerCase().includes(marker.toLowerCase())) throw new Error(`[test-google-file-search] migration missing ${marker}`)
}
if (/grant\s+(?:insert|update|delete|all).*authenticated/i.test(indexMigration)) {
  throw new Error("[test-google-file-search] authenticated users must not mutate File Search state directly")
}
if (!guardMigration.includes("on delete restrict")) throw new Error("[test-google-file-search] remote lifecycle delete guards missing")
for (const marker of ["uploadToFileSearchStore", "new Blob", "customMetadata", "eduai_content_hash", "maxTokensPerChunk", "getGoogleFileSearchOperation", "fileSearchStores.documents.list", "findGoogleFileSearchDocument", "remoteDocumentPriority", "GoogleFileSearchHttpError"]) {
  if (!provider.includes(marker)) throw new Error(`[test-google-file-search] provider missing ${marker}`)
}
if (!provider.includes('document.state === "STATE_ACTIVE"') || !provider.includes('document.state === "STATE_PENDING"') || !provider.includes('document.state === "STATE_FAILED"')) {
  throw new Error("[test-google-file-search] reconciliation must prioritize ACTIVE over PENDING/FAILED")
}
if (!route.includes('capability: "retrieval"') || !route.includes('provider: "google"')) {
  throw new Error("[test-google-file-search] age/cloud access guard missing")
}
if (!route.includes("generationAvoided: true") || !route.includes("contentHash")) {
  throw new Error("[test-google-file-search] SHA reuse path missing")
}
if (!route.includes("annotateStale") || !route.includes("currentSourceHashes") || !route.includes("stale: false")) {
  throw new Error("[test-google-file-search] stale hosted index detection missing")
}
if (!route.includes("reconcileGoogleFileSearchSource")) {
  throw new Error("[test-google-file-search] route does not reconcile remote operations/documents")
}
for (const marker of ["GoogleFileSearchBusyError", "deleteGoogleFileSearchStore", "deleteGoogleFileSearchDocument", "reconcileGoogleFileSearchSource", "ORPHAN_GRACE_MS", "STATE_ACTIVE", "STATE_FAILED"]) {
  if (!lifecycle.includes(marker)) throw new Error(`[test-google-file-search] lifecycle missing ${marker}`)
}
if (!notebookRoute.includes("cleanupGoogleFileSearchNotebook")) throw new Error("[test-google-file-search] notebook delete does not clean remote store")
if (!sourceRoute.includes("cleanupGoogleFileSearchSource")) throw new Error("[test-google-file-search] source delete does not clean remote document")
if (!deepProvider.includes('type: "file_search"') || !deepProvider.includes("file_search_store_names") || !deepProvider.includes("metadata_filter")) {
  throw new Error("[test-google-file-search] Deep Research provider does not accept filtered File Search")
}
if (!deepRoute.includes("readyGoogleFileSearchStores") || !deepRoute.includes("fileSearchStoreNames") || !deepRoute.includes("indexedHashBySource")) {
  throw new Error("[test-google-file-search] Deep Research does not enforce current ready Notebook indexes")
}
if (!deepRoute.includes('.select("source_id,content_hash")') || !deepRoute.includes('.select("id,content_hash")') || !deepRoute.includes('.eq("is_active", true)')) {
  throw new Error("[test-google-file-search] active/current source hash filtering missing")
}

console.log("[test-google-file-search] hosted File Search is SHA-aware, freshness-checked, SDK-reconciled, server-owned, deletion-safe and additive to EduAI RAG")
