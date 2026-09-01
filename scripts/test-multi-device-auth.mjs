import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const roots = ["app", "components", "lib"]
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"])
const offenders = []

function ext(path) {
  const index = path.lastIndexOf(".")
  return index >= 0 ? path.slice(index) : ""
}

function walk(path, files = []) {
  if (!existsSync(path)) return files
  const info = statSync(path)
  if (info.isFile()) {
    if (extensions.has(ext(path))) files.push(path)
    return files
  }
  for (const entry of readdirSync(path)) walk(join(path, entry), files)
  return files
}

for (const root of roots) {
  for (const path of walk(root)) {
    const source = readFileSync(path, "utf8")
    if (/\.auth\.signOut\(\)/.test(source)) offenders.push(path)
  }
}

if (offenders.length) {
  throw new Error(`[multi-device-auth] Hay cierres globales de sesión en: ${offenders.join(", ")}`)
}

const login = readFileSync("app/(auth)/login/page.tsx", "utf8")
if (!login.includes("signInWithPassword")) throw new Error("[multi-device-auth] El login por contraseña no está disponible")
if (/signOut\s*\(/.test(login)) throw new Error("[multi-device-auth] El login no debe cerrar otras sesiones antes de iniciar")

const client = readFileSync("lib/supabase/client.ts", "utf8")
if (!client.includes("createBrowserClient")) throw new Error("[multi-device-auth] El cliente SSR/browser de Supabase no está configurado")

console.log("[multi-device-auth] sesiones independientes por dispositivo verificadas en el código")

// Se ejecuta después del parche base de timeline aplicado durante prebuild.
// Sustituye las barras simplificadas por una envolvente min/max tipo Audacity.
await import("./apply-multimedia-audacity-waveform.mjs")
