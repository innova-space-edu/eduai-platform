import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = join(process.cwd(), "data", "mineduc")
const STRICT = process.argv.includes("--strict")
const VERIFIED = new Set(["verificado_oficial", "verificado_propuesta_oficial"])
const ALLOWED = new Set(["verificado_oficial", "verificado_propuesta_oficial", "pendiente_verificacion", "incompleto", "no_utilizar"])
const OFFICIAL_CODE = /^(?:(?:[A-Z]{2,5}\d{2}|[A-Z]{2,5}\dM) OA \d{2}|FG-[A-Z]{4}-[34]M-OAC-\d{2}|FG-CI(?:AS|BS|SA|TS)-3y4-OAC-\d{2}|(?:OA|OAT) \d{2} (?:IA|CC|CM|LV|LA|EEN|CES|PM) (?:SC|NM|NT))$/
const GENERIC_CODE = /^OA\s*0*\d+$/i

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...walk(full))
    else if (name.endsWith(".json")) out.push(full)
  }
  return out
}

function parse(path, errors) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    errors.push(`${relative(ROOT, path)}: JSON inválido (${error.message})`)
    return null
  }
}

function collectContentOA(data) {
  const out = []
  for (const unit of data?.unidades || []) {
    for (const item of unit?.oa || []) out.push(item)
  }
  for (const module of data?.modulos || []) {
    for (const item of module?.oa || []) out.push(item)
  }
  for (const scope of data?.ambitos || []) {
    for (const core of scope?.nucleos || []) {
      for (const item of core?.oa_contenido || []) out.push(item)
      for (const item of core?.oa_transversales || []) out.push(item)
    }
  }
  return out
}

const errors = []
const warnings = []
let pendingFiles = 0
const all = walk(ROOT)
const courseFiles = all.filter((path) => {
  const rel = relative(ROOT, path).replace(/\\/g, "/")
  return /^(parvularia\/(?!common\/)[^/]+|basica\/[^/]+\/[^/]+|media\/[^/]+\/[^/]+)\.json$/.test(rel)
})

for (const path of courseFiles) {
  const rel = relative(ROOT, path).replace(/\\/g, "/")
  const data = parse(path, errors)
  if (!data) continue
  const metadata = data.metadata || {}
  const status = metadata.estado_verificacion || "pendiente_verificacion"
  const isVerified = VERIFIED.has(status)

  if (!ALLOWED.has(status)) errors.push(`${rel}: estado_verificacion no permitido: ${status}`)

  const oas = collectContentOA(data)
  const codes = new Set()
  for (const item of oas) {
    const code = String(item?.codigo_oficial || item?.id || "").trim()
    const description = String(item?.descripcion || "").trim()
    if (!description) {
      const message = `${rel}: OA sin descripción`
      if (isVerified) errors.push(message)
      else warnings.push(message)
    }
    if (codes.has(code)) {
      const message = `${rel}: código duplicado ${code}`
      if (isVerified) errors.push(message)
      else warnings.push(message)
    }
    codes.add(code)

    if (isVerified) {
      if (!OFFICIAL_CODE.test(code)) errors.push(`${rel}: código oficial inválido en archivo verificado: ${code}`)
      if (GENERIC_CODE.test(code)) errors.push(`${rel}: código genérico prohibido en archivo verificado: ${code}`)
    }
  }

  if (isVerified) {
    const sourceUrls = [metadata.source_url, ...(metadata.source_urls || [])].filter(Boolean)
    if (!sourceUrls.length || sourceUrls.some((url) => !String(url).startsWith("https://www.curriculumnacional.cl/"))) {
      errors.push(`${rel}: archivo verificado sin source_url oficial específico`)
    }
    if (!metadata.fecha_consulta) errors.push(`${rel}: archivo verificado sin fecha_consulta`)
    if (!metadata.base_curricular) errors.push(`${rel}: archivo verificado sin base_curricular`)
    if (!oas.length) errors.push(`${rel}: archivo verificado sin OA de contenido`)
    if (status === "verificado_propuesta_oficial" && metadata.caracter_documento !== "propuesta_curricular") {
      errors.push(`${rel}: propuesta oficial verificada sin caracter_documento=propuesta_curricular`)
    }
  } else {
    pendingFiles++
    warnings.push(`${rel}: ${status}`)
  }
}

const indexPath = join(ROOT, "index.json")
const index = parse(indexPath, errors)
if (index) {
  const indexed = new Set((index.niveles || []).flatMap((level) => (level.files || []).map((file) => file.path)))
  const actual = new Set(courseFiles.map((path) => relative(ROOT, path).replace(/\\/g, "/")))
  for (const path of actual) if (!indexed.has(path)) errors.push(`index.json: falta ${path}`)
  for (const path of indexed) if (!actual.has(path)) errors.push(`index.json: referencia inexistente ${path}`)
  if (indexed.has("official-curriculum.template.json")) errors.push("index.json: la plantilla ficticia no puede cargarse")
}

console.log(`Currículum MINEDUC: ${courseFiles.length} archivos, ${pendingFiles} archivos pendientes, ${warnings.length} advertencias, ${errors.length} errores.`)
if (warnings.length) console.log(`Advertencias de revisión: ${warnings.length}`)
if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"))
  if (STRICT) process.exit(1)
}
