import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, extname } from "node:path"

const ROOT = "data/mineduc"

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (extname(name) === ".json") out.push(full)
  }
  return out
}

function collectCandidates(value, trail = [], out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCandidates(item, [...trail, String(index)], out))
    return out
  }
  if (!value || typeof value !== "object") return out

  const id = typeof value.id === "string" ? value.id.trim() : ""
  const code = typeof value.codigo_oficial === "string" ? value.codigo_oficial.trim() : ""
  const description = typeof value.descripcion === "string" ? value.descripcion.trim() : ""
  const officialLike = /\bOA(?:H|A|T)?\b/i.test(id) || /\bOA(?:H|A|T)?\b/i.test(code)
  if (officialLike && description) {
    out.push({ id, code, description, trail: trail.join(".") })
  }

  for (const [key, child] of Object.entries(value)) collectCandidates(child, [...trail, key], out)
  return out
}

const files = walk(ROOT).sort()
const rows = []
for (const file of files) {
  let json
  try {
    json = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    rows.push({ path: relative(".", file), parseError: String(error) })
    continue
  }
  const candidates = collectCandidates(json)
  const unique = new Map()
  for (const c of candidates) {
    const key = (c.code || c.id).toUpperCase().replace(/\s+/g, " ")
    if (!unique.has(key)) unique.set(key, c)
  }
  rows.push({
    path: relative(".", file),
    topKeys: Object.keys(json),
    nivel: json?.metadata?.nivel || json?.nivel || "",
    curso: json?.metadata?.curso || json?.curso || json?.metadata?.subnivel || json?.subnivel || "",
    asignatura: json?.metadata?.asignatura || json?.asignatura || json?.metadata?.nucleo || json?.nucleo || "",
    estado: json?.metadata?.estado || "",
    updated: json?.metadata?.ultima_actualizacion_manual || "",
    oaOccurrences: candidates.length,
    oaUnique: unique.size,
    sampleCodes: [...unique.values()].slice(0, 6).map((c) => c.code || c.id),
  })
}

const summary = {
  files: rows.length,
  parseErrors: rows.filter((r) => r.parseError).length,
  withOA: rows.filter((r) => (r.oaUnique || 0) > 0).length,
  totalUniquePerFile: rows.reduce((sum, r) => sum + (r.oaUnique || 0), 0),
  byRoot: Object.fromEntries([...new Set(rows.map((r) => r.path.split("/")[2] || "root"))].sort().map((root) => [root, rows.filter((r) => (r.path.split("/")[2] || "root") === root).length])),
}

console.log("MINEDUC_INVENTORY_START")
console.log(JSON.stringify({ summary, rows }, null, 2))
console.log("MINEDUC_INVENTORY_END")
