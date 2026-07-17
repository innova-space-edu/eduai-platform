import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import * as cheerio from "cheerio"

const ROOT = "data/mineduc"
const ORIGIN = "https://www.curriculumnacional.cl"

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (name.endsWith(".json")) out.push(full)
  }
  return out
}

function normText(value = "") {
  return String(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ver actividades|basal|complementario|transversal)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normCode(value = "") {
  return String(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bOA\s*0?(\d)\b/g, "OA 0$1")
}

function tokenScore(a, b) {
  const A = new Set(normText(a).split(" ").filter((x) => x.length > 2))
  const B = new Set(normText(b).split(" ").filter((x) => x.length > 2))
  if (!A.size || !B.size) return 0
  let common = 0
  for (const t of A) if (B.has(t)) common++
  const precision = common / A.size
  const recall = common / B.size
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0
}

function extractCode(text) {
  const patterns = [
    /\bFG-[A-Z0-9]+(?:-[A-Z0-9]+)*-(?:OAC|OAH|OAA)-[A-Z0-9]+\b/i,
    /\b(?:OA|OAT)\s+\d{2}\s+[A-Z]{2,5}\s+(?:SC|NM|NT)\b/i,
    /\b[A-Z]{2,5}\d{2}\s+OA(?:H|A)?\s+(?:\d{2}|[A-Z])\b/i,
    /\b[A-Z]{2,5}\dM\s+OA(?:H|A)?\s+(?:\d{2}|[A-Z])\b/i,
    /\b[A-Z]{2,5}\d{2}\s+OA\s+\d{2}\b/i,
  ]
  for (const pattern of patterns) {
    const match = String(text).match(pattern)
    if (match) return normCode(match[0])
  }
  return ""
}

function extractOfficial(html, url) {
  const $ = cheerio.load(html)
  const records = []
  $("h2,h3,h4,h5").each((_, el) => {
    const heading = $(el).text().replace(/\s+/g, " ").trim()
    if (!/objetivo de aprendizaje/i.test(heading)) return
    const code = extractCode(heading)
    if (!code) return
    const parts = []
    let node = $(el).next()
    while (node.length) {
      const tag = (node[0]?.tagName || "").toLowerCase()
      if (/^h[1-5]$/.test(tag)) break
      const text = node.text().replace(/\s+/g, " ").trim()
      if (text && !/^ver (actividades|mas)/i.test(text)) parts.push(text)
      node = node.next()
    }
    const description = parts.join(" ").replace(/Ver actividades.*$/i, "").trim()
    if (description.length > 8) records.push({ code, description, url })
  })
  const unique = new Map()
  for (const item of records) if (!unique.has(item.code)) unique.set(item.code, item)
  return [...unique.values()]
}

function extractLocal(json) {
  const found = []
  function visit(value, trail = []) {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, [...trail, String(index)]))
    if (!value || typeof value !== "object") return
    const description = typeof value.descripcion === "string" ? value.descripcion.trim()
      : typeof value.description === "string" ? value.description.trim() : ""
    const rawCode = typeof value.codigo_oficial === "string" && value.codigo_oficial.trim()
      ? value.codigo_oficial.trim()
      : typeof value.id === "string" ? value.id.trim() : ""
    if (description && rawCode && (/\bOA/i.test(rawCode) || /objetiv/i.test(trail.join(".")))) {
      found.push({ rawCode, code: extractCode(rawCode) || normCode(rawCode), description, trail: trail.join(".") })
    }
    for (const [key, child] of Object.entries(value)) visit(child, [...trail, key])
  }
  visit(json)
  const unique = new Map()
  for (const item of found) {
    const key = `${item.code}|${normText(item.description)}`
    if (!unique.has(key)) unique.set(key, item)
  }
  return [...unique.values()]
}

const slugs = {
  artes_visuales: "artes-visuales",
  ciencias_naturales: "ciencias-naturales",
  educacion_fisica_y_salud: "educacion-fisica-salud",
  historia_geografia_y_cs_sociales: "historia-geografia-ciencias-sociales",
  lenguaje: "lenguaje-comunicacion",
  lengua_literatura: "lengua-literatura",
  matematica: "matematica",
  musica: "musica",
  orientacion: "orientacion",
  tecnologia: "tecnologia",
  ingles: "ingles",
}

function officialTargets(path) {
  const p = path.replace(/\\/g, "/")
  let m = p.match(/data\/mineduc\/basica\/(\d)_basico\/([^/]+)\.json$/)
  if (m) {
    const n = Number(m[1]); const subject = m[2]
    const slug = subject === "ingles" && n <= 4 ? "ingles-propuesta" : slugs[subject]
    const cycle = n <= 6 ? "1o-6o-basico" : "7o-basico-2o-medio"
    return slug ? [`${ORIGIN}/curriculum/${cycle}/${slug}/${n}-basico`] : []
  }
  m = p.match(/data\/mineduc\/media\/(\d)_medio\/([^/]+)\.json$/)
  if (m) {
    const n = Number(m[1]); const subject = m[2]
    if (n <= 2) {
      if (["biologia", "fisica", "quimica"].includes(subject)) return [`${ORIGIN}/curriculum/7o-basico-2o-medio/ciencias-naturales/${n}-medio`]
      const slug = slugs[subject]
      return slug ? [`${ORIGIN}/curriculum/7o-basico-2o-medio/${slug}/${n}-medio`] : []
    }
    if (subject === "matematica") return [`${ORIGIN}/curriculum/3o-4o-medio/matematica-${n}o-medio/${n}-medio-fg`]
    if (subject === "lengua_literatura") return [`${ORIGIN}/curriculum/3o-4o-medio/lengua-literatura-${n}o-medio/${n}-medio-fg`]
    if (subject === "educacion_ciudadana") return [`${ORIGIN}/curriculum/3o-4o-medio/educacion-ciudadana-${n}-medio/${n}-medio-fg`]
    if (subject === "ciencias_para_la_ciudadania") return [
      `${ORIGIN}/curriculum/3o-4o-medio/ambiente-sostenibilidad/${n}-medio-fg`,
      `${ORIGIN}/curriculum/3o-4o-medio/bienestar-salud/${n}-medio-fg`,
      `${ORIGIN}/curriculum/3o-4o-medio/seguridad-prevencion-autocuidado/${n}-medio-fg`,
      `${ORIGIN}/curriculum/3o-4o-medio/tecnologia-sociedad/${n}-medio-fg`,
    ]
  }
  m = p.match(/data\/mineduc\/parvularia\/(sala_cuna_(?:menor|mayor)|medio_(?:menor|mayor)|nt[12])\.json$/)
  if (m) {
    const level = m[1].startsWith("sala_cuna") ? "sc-sala-cuna" : m[1].startsWith("medio") ? "nm-nivel-medio" : "nt-nivel-transicion"
    return [
      `${ORIGIN}/curriculum/educacion-parvularia/comunicacion-integral/${level}`,
      `${ORIGIN}/curriculum/educacion-parvularia/desarrollo-personal-social/${level}`,
      `${ORIGIN}/curriculum/educacion-parvularia/interaccion-comprension-entorno/${level}`,
    ]
  }
  m = p.match(/data\/mineduc\/parvularia\/common\/oat_(sc|nm|nt)\.json$/)
  if (m) {
    const level = m[1] === "sc" ? "sc-sala-cuna" : m[1] === "nm" ? "nm-nivel-medio" : "nt-nivel-transicion"
    return [`${ORIGIN}/curriculum/educacion-parvularia/desarrollo-personal-social/${level}`]
  }
  return []
}

function filterOfficialForFile(records, path) {
  const p = path.replace(/\\/g, "/")
  const science = p.match(/media\/(1|2)_medio\/(biologia|fisica|quimica)\.json$/)
  if (!science) return records
  const year = Number(science[1]); const branch = science[2]
  const ranges = year === 1 ? { biologia: [1, 8], fisica: [9, 16], quimica: [17, 20] } : { biologia: [1, 8], fisica: [9, 15], quimica: [16, 18] }
  const [min, max] = ranges[branch]
  return records.filter((r) => {
    if (/\bOAH\b|\bOAA\b/.test(r.code)) return true
    const match = r.code.match(/\bOA\s+(\d{2})\b/)
    return match ? Number(match[1]) >= min && Number(match[1]) <= max : false
  })
}

const cache = new Map()
async function fetchOfficial(url) {
  if (cache.has(url)) return cache.get(url)
  const promise = (async () => {
    try {
      const res = await fetch(url, { headers: { "user-agent": "EduAI-Curriculum-Audit/2026" }, signal: AbortSignal.timeout(25000), redirect: "follow" })
      if (!res.ok) return { url, status: res.status, records: [] }
      const html = await res.text()
      return { url: res.url, status: res.status, records: extractOfficial(html, res.url) }
    } catch (error) {
      return { url, status: 0, error: String(error), records: [] }
    }
  })()
  cache.set(url, promise)
  return promise
}

function classify(local, official) {
  const officialByCode = new Map(official.map((x) => [x.code, x]))
  const usedOfficial = new Set()
  const matches = []
  let invalidCodes = 0
  for (const l of local) {
    let o = officialByCode.get(l.code)
    let matchedBy = "code"
    if (!o) {
      invalidCodes++
      let best = null; let bestScore = 0
      for (const candidate of official) {
        if (usedOfficial.has(candidate.code)) continue
        const score = tokenScore(l.description, candidate.description)
        if (score > bestScore) { bestScore = score; best = candidate }
      }
      if (best && bestScore >= 0.55) { o = best; matchedBy = "text" }
    }
    if (!o) {
      matches.push({ type: "extra", localCode: l.rawCode, local: l.description.slice(0, 180) })
      continue
    }
    usedOfficial.add(o.code)
    const score = tokenScore(l.description, o.description)
    const exact = normText(l.description) === normText(o.description)
    const type = exact ? "exact" : score >= 0.95 ? "format" : score >= 0.82 ? "near" : "altered"
    matches.push({ type, matchedBy, localCode: l.rawCode, officialCode: o.code, score: Number(score.toFixed(3)), local: l.description.slice(0, 220), official: o.description.slice(0, 220) })
  }
  const missing = official.filter((o) => !usedOfficial.has(o.code)).map((o) => ({ code: o.code, description: o.description.slice(0, 180) }))
  const counts = Object.fromEntries(["exact", "format", "near", "altered", "extra"].map((t) => [t, matches.filter((m) => m.type === t).length]))
  const status = !official.length ? "official_page_unresolved" : missing.length === 0 && counts.altered === 0 && counts.extra === 0 && invalidCodes === 0 ? "correct" : missing.length <= 1 && counts.altered <= 1 && counts.extra === 0 ? "minor_review" : "incorrect_or_incomplete"
  return { status, counts, missing, invalidCodes, matches }
}

const allFiles = walk(ROOT)
  .filter((p) => !/(index\.json|official-curriculum\.template\.json|meta\/|shared\/)/.test(p.replace(/\\/g, "/")))
  .sort()

const results = []
for (let i = 0; i < allFiles.length; i += 4) {
  const batch = allFiles.slice(i, i + 4)
  const batchResults = await Promise.all(batch.map(async (file) => {
    const path = relative(".", file).replace(/\\/g, "/")
    const json = JSON.parse(readFileSync(file, "utf8"))
    const local = extractLocal(json)
    const targets = officialTargets(path)
    const fetched = await Promise.all(targets.map(fetchOfficial))
    const official = filterOfficialForFile([...new Map(fetched.flatMap((x) => x.records).map((r) => [r.code, r])).values()], path)
    const comparison = classify(local, official)
    return {
      path,
      declaredStatus: json?.metadata?.estado || json?.estado || "",
      targets: fetched.map((x) => ({ url: x.url, http: x.status, oa: x.records.length })),
      localRecords: local.length,
      officialRecords: official.length,
      ...comparison,
    }
  }))
  results.push(...batchResults)
}

const summary = {
  auditedFiles: results.length,
  correct: results.filter((r) => r.status === "correct").length,
  minorReview: results.filter((r) => r.status === "minor_review").length,
  incorrectOrIncomplete: results.filter((r) => r.status === "incorrect_or_incomplete").length,
  unresolvedOfficialPage: results.filter((r) => r.status === "official_page_unresolved").length,
  localRecords: results.reduce((s, r) => s + r.localRecords, 0),
  officialRecordsExpectedPerFile: results.reduce((s, r) => s + r.officialRecords, 0),
  missingOfficialRecords: results.reduce((s, r) => s + r.missing.length, 0),
  alteredRecords: results.reduce((s, r) => s + r.counts.altered, 0),
  extraRecords: results.reduce((s, r) => s + r.counts.extra, 0),
  invalidOrNonOfficialCodes: results.reduce((s, r) => s + r.invalidCodes, 0),
}

const problematic = results
  .filter((r) => r.status !== "correct")
  .map((r) => ({
    path: r.path,
    declaredStatus: r.declaredStatus,
    status: r.status,
    localRecords: r.localRecords,
    officialRecords: r.officialRecords,
    counts: r.counts,
    missingCount: r.missing.length,
    invalidCodes: r.invalidCodes,
    targets: r.targets,
    missingSample: r.missing.slice(0, 8),
    mismatchSample: r.matches.filter((m) => m.type === "altered" || m.type === "extra").slice(0, 5),
  }))

console.log("OA_OFFICIAL_AUDIT_START")
console.log(JSON.stringify({ summary, problematic }, null, 2))
console.log("OA_OFFICIAL_AUDIT_END")
