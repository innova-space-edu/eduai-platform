import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOTS = ["app", "components", "lib"]
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"])
const EMPTY_SIGN_OUT = /\.auth\.signOut\(\)/g

function extension(path) {
  const index = path.lastIndexOf(".")
  return index >= 0 ? path.slice(index) : ""
}

function walk(path, files = []) {
  if (!existsSync(path)) return files
  const info = statSync(path)
  if (info.isFile()) {
    if (EXTENSIONS.has(extension(path))) files.push(path)
    return files
  }
  for (const entry of readdirSync(path)) walk(join(path, entry), files)
  return files
}

let changedFiles = 0
let replacements = 0

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const source = readFileSync(path, "utf8")
    const matches = source.match(EMPTY_SIGN_OUT)
    if (!matches?.length) continue

    const next = source.replace(EMPTY_SIGN_OUT, '.auth.signOut({ scope: "local" })')
    writeFileSync(path, next)
    changedFiles += 1
    replacements += matches.length
  }
}

console.log(`[auth-sessions] ${replacements} cierre(s) global(es) convertidos a sesión local en ${changedFiles} archivo(s)`)
