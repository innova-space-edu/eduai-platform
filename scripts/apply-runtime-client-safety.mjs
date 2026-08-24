import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(root, relativePath), source)
}

function isIdentifierNamePosition(node) {
  const parent = node.parent
  if (!parent) return false
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true
  if (ts.isPropertyAssignment(parent) && parent.name === node && !ts.isComputedPropertyName(parent.name)) return true
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true
  if (ts.isPropertySignature(parent) && parent.name === node) return true
  if (ts.isMethodSignature(parent) && parent.name === node) return true
  if (ts.isBindingElement(parent) && parent.propertyName === node) return true
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return true
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true
  if (ts.isParameter(parent) && parent.name === node) return true
  if (ts.isTypeReferenceNode(parent)) return true
  return false
}

function replaceIdentifierReferences(source, relativePath, identifier, replacement) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const edits = []

  function visit(node) {
    if (ts.isIdentifier(node) && node.text === identifier && !isIdentifierNamePosition(node)) {
      edits.push({ start: node.getStart(sourceFile), end: node.getEnd(), replacement })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  if (!edits.length) return { source, changed: false }

  let next = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end)
  }
  return { source: next, changed: true }
}

function patchSupabaseRoute(relativePath) {
  let source = read(relativePath)
  let changed = false

  const simpleBlocks = [
    `const supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL || "",\n  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""\n)`,
    `const supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL || "",\n  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",\n  { auth: { persistSession: false } },\n)`,
    `const supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL || "",\n  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",\n  { auth: { persistSession: false } }\n)`,
  ]

  const lazyHelper = `function getSupabase() {\n  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ""\n  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()\n  if (!url || !key) throw new Error("Supabase no está configurado en el servidor.")\n  return createClient(url, key, { auth: { persistSession: false } })\n}`

  if (!source.includes("function getSupabase()")) {
    const block = simpleBlocks.find((candidate) => source.includes(candidate))
    if (!block) throw new Error(`[runtime-client-safety] No se encontró cliente Supabase global en ${relativePath}`)
    source = source.replace(block, lazyHelper)
    changed = true
  }

  const transformed = replaceIdentifierReferences(source, relativePath, "supabase", "getSupabase()")
  source = transformed.source
  changed ||= transformed.changed

  if (changed) write(relativePath, source)
  console.log(`[runtime-client-safety] ${relativePath}: ${changed ? "actualizado" : "ya seguro"}`)
}

function patchExamAccess() {
  const relativePath = "app/api/exam-access/route.ts"
  let source = read(relativePath)
  let changed = false

  const oldAdmin = `const admin = createClient(supabaseUrl, serviceKey || anonKey, {\n  auth: { persistSession: false },\n})`
  const lazyAdmin = `function getAdmin() {\n  const key = serviceKey || anonKey\n  if (!supabaseUrl || !key) throw new Error("Supabase no está configurado en el servidor.")\n  return createClient(supabaseUrl, key, { auth: { persistSession: false } })\n}`

  if (!source.includes("function getAdmin()")) {
    if (!source.includes(oldAdmin)) throw new Error(`[runtime-client-safety] No se encontró cliente admin global en ${relativePath}`)
    source = source.replace(oldAdmin, lazyAdmin)
    changed = true
  }

  const transformed = replaceIdentifierReferences(source, relativePath, "admin", "getAdmin()")
  source = transformed.source
  changed ||= transformed.changed

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
