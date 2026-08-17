import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

const targets = [
  "app/api/agents/exam-feedback/route.ts",
  "app/api/agents/exam-math-rescore/route.ts",
  "app/api/agents/exam-time/route.ts",
  "app/api/agents/examen-docente/route.ts",
]

const helper = `function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!url || !key) throw new Error("Supabase no está configurado en el servidor")
  return createClient(url, key, { auth: { persistSession: false } })
}
`

for (const relative of targets) {
  const file = path.join(root, relative)
  let source = fs.readFileSync(file, "utf8")
  let changed = false

  if (!source.includes("function createServerSupabase()")) {
    const declaration = /const supabase = createClient\([\s\S]*?\n\)\n/
    if (!declaration.test(source)) {
      throw new Error(`[provider-client-init] No se encontró cliente Supabase global en ${relative}`)
    }
    source = source.replace(declaration, `${helper}\n`)
    changed = true
  }

  const next = source.replace(/\bsupabase\s*\.from\(/g, "createServerSupabase().from(")
  if (next !== source) {
    source = next
    changed = true
  }

  if (changed) {
    fs.writeFileSync(file, source)
    console.log(`[provider-client-init] lazy Supabase aplicado en ${relative}`)
  } else {
    console.log(`[provider-client-init] ${relative} ya estaba corregido`)
  }
}

const accessRelative = "app/api/exam-access/route.ts"
const accessFile = path.join(root, accessRelative)
let access = fs.readFileSync(accessFile, "utf8")
let accessChanged = false

if (!access.includes("function createAdminClient()")) {
  const declaration = /const admin = createClient\(supabaseUrl, serviceKey \|\| anonKey, \{\n  auth: \{ persistSession: false \},\n\}\)\n/
  if (!declaration.test(access)) {
    throw new Error(`[provider-client-init] No se encontró cliente admin global en ${accessRelative}`)
  }
  access = access.replace(
    declaration,
    `function createAdminClient() {\n  if (!supabaseUrl || !(serviceKey || anonKey)) throw new Error("Supabase no está configurado en el servidor")\n  return createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false } })\n}\n`,
  )
  accessChanged = true
}

const nextAccess = access.replace(/\badmin\s*\.from\(/g, "createAdminClient().from(")
if (nextAccess !== access) {
  access = nextAccess
  accessChanged = true
}

if (accessChanged) {
  fs.writeFileSync(accessFile, access)
  console.log(`[provider-client-init] lazy Supabase aplicado en ${accessRelative}`)
} else {
  console.log(`[provider-client-init] ${accessRelative} ya estaba corregido`)
}

console.log("[provider-client-init] inicialización server-side diferida verificada")
