import fs from "node:fs"
import path from "node:path"

const notebookRoutePath = path.join(process.cwd(), "app/api/notebooks/[id]/route.ts")
const sourceRoutePath = path.join(process.cwd(), "app/api/notebooks/[id]/sources/route.ts")
const deepProviderPath = path.join(process.cwd(), "lib/ai/providers/google-deep-research.ts")
const deepRoutePath = path.join(process.cwd(), "app/api/work/deep-research/route.ts")

let notebookRoute = fs.readFileSync(notebookRoutePath, "utf8")
let sourceRoute = fs.readFileSync(sourceRoutePath, "utf8")
let deepProvider = fs.readFileSync(deepProviderPath, "utf8")
let deepRoute = fs.readFileSync(deepRoutePath, "utf8")
let changed = false

function replace(target, from, to, label) {
  let source = target === "notebook" ? notebookRoute : target === "source" ? sourceRoute : target === "provider" ? deepProvider : deepRoute
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`[google-file-search] marker not found: ${label}`)
  source = source.replace(from, to)
  if (target === "notebook") notebookRoute = source
  else if (target === "source") sourceRoute = source
  else if (target === "provider") deepProvider = source
  else deepRoute = source
  changed = true
}

if (!notebookRoute.includes('from "@/lib/ai/google-file-search-lifecycle"')) {
  notebookRoute = notebookRoute.replace(
    'import { createClient } from "@/lib/supabase/server"\n',
    'import { createClient } from "@/lib/supabase/server"\nimport { cleanupGoogleFileSearchNotebook } from "@/lib/ai/google-file-search-lifecycle"\n',
  )
  changed = true
}
replace(
  "notebook",
  `  const { error } = await supabase\n    .from("notebooks")`,
  `  try {\n    await cleanupGoogleFileSearchNotebook({ ownerId: user.id, notebookId: id })\n  } catch (cleanupError) {\n    const message = cleanupError instanceof Error ? cleanupError.message : "No se pudo limpiar Google File Search"\n    return NextResponse.json({ error: message }, { status: 502 })\n  }\n\n  const { error } = await supabase\n    .from("notebooks")`,
  "Notebook remote cleanup before delete",
)

if (!sourceRoute.includes('from "@/lib/ai/google-file-search-lifecycle"')) {
  sourceRoute = sourceRoute.replace(
    'import { createClient } from "@/lib/supabase/server"\n',
    'import { createClient } from "@/lib/supabase/server"\nimport { cleanupGoogleFileSearchSource } from "@/lib/ai/google-file-search-lifecycle"\n',
  )
  changed = true
}
replace(
  "source",
  `  const { error } = await supabase\n    .from("notebook_sources")\n    .delete()`,
  `  try {\n    await cleanupGoogleFileSearchSource({ ownerId: user.id, notebookId: id, sourceId })\n  } catch (cleanupError) {\n    const typed = cleanupError as Error & { status?: number }\n    return NextResponse.json({ error: typed.message || "No se pudo limpiar Google File Search" }, { status: typed.status || 502 })\n  }\n\n  const { error } = await supabase\n    .from("notebook_sources")\n    .delete()`,
  "Source remote cleanup before delete",
)

replace(
  "provider",
  `export async function startGoogleDeepResearch(input: {\n  prompt: string\n  max?: boolean\n  visualization?: boolean\n}) {`,
  `export async function startGoogleDeepResearch(input: {\n  prompt: string\n  max?: boolean\n  visualization?: boolean\n  fileSearchStoreNames?: string[]\n}) {`,
  "Deep Research File Search input",
)
replace(
  "provider",
  `    background: true,\n    agent_config: {`,
  `    background: true,\n    ...(input.fileSearchStoreNames?.length ? {\n      tools: [{ type: "file_search", file_search_store_names: input.fileSearchStoreNames }],\n    } : {}),\n    agent_config: {`,
  "Deep Research File Search tool",
)

replace(
  "provider",
  `    if (candidate && /^https?:\\/\\//i.test(candidate)) {`,
  `    if (object.type === "file_citation" && typeof object.file_name === "string" && typeof object.source === "string") {\n      const source = object.source\n      if (!seen.has(source)) seen.set(source, { title: object.file_name.slice(0, 240), uri: source })\n    }\n    if (candidate && /^https?:\\/\\//i.test(candidate)) {`,
  "File Search citation extraction",
)

if (!deepRoute.includes("async function readyGoogleFileSearchStores(")) {
  const marker = "function responseForStoredJob(job: DeepResearchJob) {"
  const index = deepRoute.indexOf(marker)
  if (index < 0) throw new Error("[google-file-search] Deep Research response marker missing")
  const helper = `async function readyGoogleFileSearchStores(input: {\n  supabase: Awaited<ReturnType<typeof createClient>>\n  notebookId: string | null\n  includeSources: boolean\n}) {\n  if (!input.notebookId || !input.includeSources) return [] as string[]\n  const { data: store } = await input.supabase\n    .from("eduai_google_file_search_stores")\n    .select("store_name,status")\n    .eq("notebook_id", input.notebookId)\n    .eq("status", "active")\n    .maybeSingle()\n  if (!store?.store_name) return [] as string[]\n\n  const { count } = await input.supabase\n    .from("eduai_google_file_search_documents")\n    .select("id", { count: "exact", head: true })\n    .eq("notebook_id", input.notebookId)\n    .eq("status", "ready")\n  return (count || 0) > 0 ? [String(store.store_name)] : []\n}\n\n`
  deepRoute = deepRoute.slice(0, index) + helper + deepRoute.slice(index)
  changed = true
}

replace(
  "route",
  `    const local = await notebookContext({ supabase, userId: user.id, notebookId, query, includeSources })\n    const agent =`,
  `    const local = await notebookContext({ supabase, userId: user.id, notebookId, query, includeSources })\n    const fileSearchStoreNames = await readyGoogleFileSearchStores({ supabase, notebookId, includeSources })\n    const agent =`,
  "load ready File Search stores",
)
replace(
  "route",
  `        visualization,\n      },`,
  `        visualization,\n        fileSearchStoreNames,\n      },`,
  "File Search in fingerprint",
)
replace(
  "route",
  `    const interaction = await startGoogleDeepResearch({ prompt, max, visualization })`,
  `    const interaction = await startGoogleDeepResearch({ prompt, max, visualization, fileSearchStoreNames })`,
  "Deep Research start with File Search",
)
replace(
  "route",
  `          google_status: interaction.rawStatus,`,
  `          google_status: interaction.rawStatus,\n          file_search_store_names: fileSearchStoreNames,`,
  "File Search metadata",
)
replace(
  "route",
  `      sourceUrl: citation.uri,\n      sourceType: "web",`,
  `      sourceUrl: /^https?:\\/\\//i.test(citation.uri) ? citation.uri : undefined,\n      sourceType: /^https?:\\/\\//i.test(citation.uri) ? "web" : "file_search",`,
  "File Search citation type",
)

if (changed) {
  fs.writeFileSync(notebookRoutePath, notebookRoute)
  fs.writeFileSync(sourceRoutePath, sourceRoute)
  fs.writeFileSync(deepProviderPath, deepProvider)
  fs.writeFileSync(deepRoutePath, deepRoute)
  console.log("[google-file-search] Notebook lifecycle + Deep Research File Search integrados sin reemplazar RAG")
} else {
  console.log("[google-file-search] already applied")
}
