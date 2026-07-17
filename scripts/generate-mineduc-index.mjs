import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = join(process.cwd(), "data", "mineduc")
const OUTPUT = join(ROOT, "index.json")

const LEVELS = [
  { id: "parvularia", name: "Educación Parvularia" },
  { id: "basica", name: "Educación Básica" },
  { id: "media", name: "Educación Media" },
]

function walk(dir) {
  const result = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) result.push(...walk(full))
    else if (name.endsWith(".json")) result.push(full)
  }
  return result
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function verificationStatus(data) {
  return data?.metadata?.estado_verificacion || "pendiente_verificacion"
}

function courseEntry(path) {
  const rel = relative(ROOT, path).replace(/\\/g, "/")
  const parts = rel.split("/")
  const nivel = parts[0]

  if (nivel === "parvularia") {
    if (parts.length !== 2 || parts[1] === "index.json") return null
    return {
      path: rel,
      nivel,
      curso: parts[1].replace(/\.json$/, ""),
      estado_verificacion: verificationStatus(readJson(path)),
    }
  }

  if (!["basica", "media"].includes(nivel) || parts.length !== 3) return null
  return {
    path: rel,
    nivel,
    curso: parts[1],
    asignatura: parts[2].replace(/\.json$/, ""),
    estado_verificacion: verificationStatus(readJson(path)),
  }
}

const files = walk(ROOT)
  .map(courseEntry)
  .filter(Boolean)
  .sort((a, b) => a.path.localeCompare(b.path, "es"))

const index = {
  version: 2,
  generado_automaticamente: true,
  nota: "No editar manualmente. Ejecutar npm run curriculum:index.",
  niveles: LEVELS.map((level) => ({
    ...level,
    files: files.filter((file) => file.nivel === level.id),
  })),
}

writeFileSync(OUTPUT, `${JSON.stringify(index, null, 2)}\n`, "utf8")
console.log(`Índice MINEDUC generado con ${files.length} archivos curriculares.`)
