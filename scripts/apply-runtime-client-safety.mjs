import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(root, relativePath), source)
}

function patchSupabaseRoute(relativePath) {
  let source = read(relativePath)
  let changed = false

  const simpleBlocks = [
    `const supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL || "",\n  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""\n)`,
    `const supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL || "",\n  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",\n  { auth: { persistSession: false } },\n)`,
    `const supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL || "",\n  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",\n  { auth: { persistSession: false } }\n)`,
  ]

  const lazyHelper = `let supabaseClientCache: ReturnType<typeof createClient> | null = null\n\nfunction getSupabase() {\n  if (supabaseClientCache) return supabaseClientCache\n  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ""\n  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()\n  if (!url || !key) throw new Error("Supabase no está configurado en el servidor.")\n  supabaseClientCache = createClient(url, key, { auth: { persistSession: false } })\n  return supabaseClientCache\n}`

  if (!source.includes("function getSupabase()")) {
    const block = simpleBlocks.find((candidate) => source.includes(candidate))
    if (!block) throw new Error(`[runtime-client-safety] No se encontró cliente Supabase global en ${relativePath}`)
    source = source.replace(block, lazyHelper)
    changed = true
  }

  if (source.includes("supabase.")) {
    source = source.replaceAll("supabase.", "getSupabase().")
    changed = true
  }

  if (changed) write(relativePath, source)
  console.log(`[runtime-client-safety] ${relativePath}: ${changed ? "actualizado" : "ya seguro"}`)
}

function patchExamAccess() {
  const relativePath = "app/api/exam-access/route.ts"
  let source = read(relativePath)
  let changed = false

  const oldAdmin = `const admin = createClient(supabaseUrl, serviceKey || anonKey, {\n  auth: { persistSession: false },\n})`
  const lazyAdmin = `let adminClientCache: ReturnType<typeof createClient> | null = null\n\nfunction getAdmin() {\n  if (adminClientCache) return adminClientCache\n  const key = serviceKey || anonKey\n  if (!supabaseUrl || !key) throw new Error("Supabase no está configurado en el servidor.")\n  adminClientCache = createClient(supabaseUrl, key, { auth: { persistSession: false } })\n  return adminClientCache\n}`

  if (!source.includes("function getAdmin()")) {
    if (!source.includes(oldAdmin)) throw new Error(`[runtime-client-safety] No se encontró cliente admin global en ${relativePath}`)
    source = source.replace(oldAdmin, lazyAdmin)
    changed = true
  }

  if (source.includes("admin.")) {
    source = source.replaceAll("admin.", "getAdmin().")
    changed = true
  }

  if (changed) write(relativePath, source)
  console.log(`[runtime-client-safety] ${relativePath}: ${changed ? "actualizado" : "ya seguro"}`)
}

for (const relativePath of [
  "app/api/agents/exam-feedback/route.ts",
  "app/api/agents/exam-math-rescore/route.ts",
  "app/api/agents/exam-time/route.ts",
  "app/api/agents/examen-docente/route.ts",
]) {
  patchSupabaseRoute(relativePath)
}

patchExamAccess()

console.log("[runtime-client-safety] clientes Supabase sensibles movidos a inicialización lazy")
