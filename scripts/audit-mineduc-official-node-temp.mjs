import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = "data/mineduc"
const ORIGIN = "https://www.curriculumnacional.cl"

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name)
  return statSync(full).isDirectory() ? walk(full) : name.endsWith(".json") ? [full] : []
})

function decodeHtml(s = "") {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>|<\/li>|<\/div>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í").replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ").trim()
}

function normText(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(ver actividades|ver mas actividades|basal|complementario|transversal)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
}
function normCode(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[._]/g, " ").replace(/\s+/g, " ").trim().replace(/\bOA\s*0?(\d)\b/g, "OA 0$1")
}
function tokenScore(a, b) {
  const A = new Set(normText(a).split(" ").filter((x) => x.length > 2))
  const B = new Set(normText(b).split(" ").filter((x) => x.length > 2))
  if (!A.size || !B.size) return 0
  let common = 0
  for (const t of A) if (B.has(t)) common++
  const p = common / A.size, r = common / B.size
  return p + r ? 2 * p * r / (p + r) : 0
}
function extractCode(text) {
  const patterns = [
    /\bFG-[A-Z0-9]+(?:-[A-Z0-9]+)*-(?:OAC|OAH|OAA)-[A-Z0-9]+\b/i,
    /\b(?:OA|OAT)\s+\d{2}\s+[A-Z]{2,5}\s+(?:SC|NM|NT)\b/i,
    /\b[A-Z]{2,5}\d{2}\s+OA(?:H|A)?\s+(?:\d{2}|[A-Z])\b/i,
    /\b[A-Z]{2,5}\dM\s+OA(?:H|A)?\s+(?:\d{2}|[A-Z])\b/i,
  ]
  for (const p of patterns) { const m = String(text).match(p); if (m) return normCode(m[0]) }
  return ""
}
function extractOfficial(html, url) {
  const records = []
  const re = /<h([2-5])[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[1-5][^>]*>|$)/gi
  let m
  while ((m = re.exec(html))) {
    const heading = decodeHtml(m[2])
    if (!/objetivo de aprendizaje/i.test(heading)) continue
    const code = extractCode(heading)
    if (!code) continue
    const description = decodeHtml(m[3]).replace(/Ver actividades[\s\S]*$/i, "").trim()
    if (description.length > 8) records.push({ code, description, url })
  }
  return [...new Map(records.map((r) => [r.code, r])).values()]
}
function extractLocal(json) {
  const found = []
  function visit(value, trail = []) {
    if (Array.isArray(value)) return value.forEach((x, i) => visit(x, [...trail, String(i)]))
    if (!value || typeof value !== "object") return
    const description = typeof value.descripcion === "string" ? value.descripcion.trim() : typeof value.description === "string" ? value.description.trim() : ""
    const rawCode = typeof value.codigo_oficial === "string" && value.codigo_oficial.trim() ? value.codigo_oficial.trim() : typeof value.id === "string" ? value.id.trim() : ""
    if (description && rawCode && (/\bOA/i.test(rawCode) || /objetiv|\.oa\b|oat/i.test(trail.join(".")))) found.push({ rawCode, code: extractCode(rawCode) || normCode(rawCode), description })
    for (const [k, child] of Object.entries(value)) visit(child, [...trail, k])
  }
  visit(json)
  return [...new Map(found.map((x) => [`${x.code}|${normText(x.description)}`, x])).values()]
}

const slugs = {
  artes_visuales: "artes-visuales", ciencias_naturales: "ciencias-naturales",
  educacion_fisica_y_salud: "educacion-fisica-salud", historia_geografia_y_cs_sociales: "historia-geografia-ciencias-sociales",
  lenguaje: "lenguaje-comunicacion", lengua_literatura: "lengua-literatura", matematica: "matematica",
  musica: "musica", orientacion: "orientacion", tecnologia: "tecnologia", ingles: "ingles",
}
function targets(path) {
  const p = path.replace(/\\/g, "/")
  let m = p.match(/basica\/(\d)_basico\/([^/]+)\.json$/)
  if (m) {
    const n = +m[1], subject = m[2], slug = subject === "ingles" && n <= 4 ? "ingles-propuesta" : slugs[subject]
    return slug ? [`${ORIGIN}/curriculum/${n <= 6 ? "1o-6o-basico" : "7o-basico-2o-medio"}/${slug}/${n}-basico`] : []
  }
  m = p.match(/media\/(\d)_medio\/([^/]+)\.json$/)
  if (m) {
    const n = +m[1], subject = m[2]
    if (n <= 2) {
      if (["biologia", "fisica", "quimica"].includes(subject)) return [`${ORIGIN}/curriculum/7o-basico-2o-medio/ciencias-naturales/${n}-medio`]
      return slugs[subject] ? [`${ORIGIN}/curriculum/7o-basico-2o-medio/${slugs[subject]}/${n}-medio`] : []
    }
    if (subject === "matematica") return [`${ORIGIN}/curriculum/3o-4o-medio/matematica-${n}o-medio/${n}-medio-fg`]
    if (subject === "lengua_literatura") return [`${ORIGIN}/curriculum/3o-4o-medio/lengua-literatura-${n}o-medio/${n}-medio-fg`]
    if (subject === "educacion_ciudadana") return [`${ORIGIN}/curriculum/3o-4o-medio/educacion-ciudadana-${n}-medio/${n}-medio-fg`]
    if (subject === "ciencias_para_la_ciudadania") return ["ambiente-sostenibilidad", "bienestar-salud", "seguridad-prevencion-autocuidado", "tecnologia-sociedad"].map((x) => `${ORIGIN}/curriculum/3o-4o-medio/${x}/${n}-medio-fg`)
  }
  m = p.match(/parvularia\/(sala_cuna_(?:menor|mayor)|medio_(?:menor|mayor)|nt[12])\.json$/)
  if (m) {
    const level = m[1].startsWith("sala_cuna") ? "sc-sala-cuna" : m[1].startsWith("medio") ? "nm-nivel-medio" : "nt-nivel-transicion"
    return ["comunicacion-integral", "desarrollo-personal-social", "interaccion-comprension-entorno"].map((x) => `${ORIGIN}/curriculum/educacion-parvularia/${x}/${level}`)
  }
  m = p.match(/parvularia\/common\/oat_(sc|nm|nt)\.json$/)
  if (m) {
    const level = m[1] === "sc" ? "sc-sala-cuna" : m[1] === "nm" ? "nm-nivel-medio" : "nt-nivel-transicion"
    return [`${ORIGIN}/curriculum/educacion-parvularia/desarrollo-personal-social/${level}`]
  }
  return []
}
function filterScience(records, path) {
  const m = path.match(/media\/(1|2)_medio\/(biologia|fisica|quimica)\.json$/)
  if (!m) return records
  const ranges = +m[1] === 1 ? { biologia:[1,8], fisica:[9,16], quimica:[17,20] } : { biologia:[1,8], fisica:[9,15], quimica:[16,18] }
  const [lo, hi] = ranges[m[2]]
  return records.filter((r) => /\bOAH\b|\bOAA\b/.test(r.code) || (() => { const x = r.code.match(/\bOA\s+(\d{2})\b/); return x && +x[1] >= lo && +x[1] <= hi })())
}
const cache = new Map()
async function fetchPage(url) {
  if (!cache.has(url)) cache.set(url, (async () => {
    try {
      const res = await fetch(url, { headers: { "user-agent": "EduAI-Curriculum-Audit/2026" }, redirect: "follow", signal: AbortSignal.timeout(25000) })
      const html = res.ok ? await res.text() : ""
      return { url: res.url || url, status: res.status, records: html ? extractOfficial(html, res.url || url) : [] }
    } catch (e) { return { url, status: 0, error: String(e), records: [] } }
  })())
  return cache.get(url)
}
function compare(local, official) {
  const byCode = new Map(official.map((x) => [x.code, x])), used = new Set(), matches = []
  let invalidCodes = 0
  for (const l of local) {
    let o = byCode.get(l.code), matchedBy = "code"
    if (!o) {
      invalidCodes++
      let best, score = 0
      for (const candidate of official) if (!used.has(candidate.code)) { const s = tokenScore(l.description, candidate.description); if (s > score) { score = s; best = candidate } }
      if (best && score >= .55) { o = best; matchedBy = "text" }
    }
    if (!o) { matches.push({ type:"extra", localCode:l.rawCode, local:l.description.slice(0,180) }); continue }
    used.add(o.code)
    const score = tokenScore(l.description, o.description), exact = normText(l.description) === normText(o.description)
    const type = exact ? "exact" : score >= .95 ? "format" : score >= .82 ? "near" : "altered"
    matches.push({ type, matchedBy, localCode:l.rawCode, officialCode:o.code, score:+score.toFixed(3), local:l.description.slice(0,220), official:o.description.slice(0,220) })
  }
  const missing = official.filter((o) => !used.has(o.code)).map((o) => ({ code:o.code, description:o.description.slice(0,180) }))
  const counts = Object.fromEntries(["exact","format","near","altered","extra"].map((t) => [t, matches.filter((m) => m.type === t).length]))
  const status = !official.length ? "official_page_unresolved" : missing.length === 0 && counts.altered === 0 && counts.extra === 0 && invalidCodes === 0 ? "correct" : missing.length <= 1 && counts.altered <= 1 && counts.extra === 0 ? "minor_review" : "incorrect_or_incomplete"
  return { status, counts, missing, invalidCodes, matches }
}

const files = walk(ROOT).filter((p) => !/(index\.json|official-curriculum\.template\.json|meta\/|shared\/)/.test(p.replace(/\\/g,"/"))).sort()
const results = []
for (let i = 0; i < files.length; i += 4) {
  results.push(...await Promise.all(files.slice(i,i+4).map(async (file) => {
    const path = relative(".", file).replace(/\\/g,"/"), json = JSON.parse(readFileSync(file,"utf8")), local = extractLocal(json)
    const fetched = await Promise.all(targets(path).map(fetchPage))
    const official = filterScience([...new Map(fetched.flatMap((x) => x.records).map((r) => [r.code,r])).values()], path)
    return { path, declaredStatus:json?.metadata?.estado || json?.estado || "", localRecords:local.length, officialRecords:official.length, targets:fetched.map((x) => ({url:x.url,http:x.status,oa:x.records.length})), ...compare(local,official) }
  })))
}
const summary = {
  auditedFiles:results.length,
  correct:results.filter((r)=>r.status==="correct").length,
  minorReview:results.filter((r)=>r.status==="minor_review").length,
  incorrectOrIncomplete:results.filter((r)=>r.status==="incorrect_or_incomplete").length,
  unresolvedOfficialPage:results.filter((r)=>r.status==="official_page_unresolved").length,
  localRecords:results.reduce((s,r)=>s+r.localRecords,0), officialRecordsExpectedPerFile:results.reduce((s,r)=>s+r.officialRecords,0),
  missingOfficialRecords:results.reduce((s,r)=>s+r.missing.length,0), alteredRecords:results.reduce((s,r)=>s+r.counts.altered,0),
  extraRecords:results.reduce((s,r)=>s+r.counts.extra,0), invalidOrNonOfficialCodes:results.reduce((s,r)=>s+r.invalidCodes,0),
}
const problematic = results.filter((r)=>r.status!=="correct").map((r)=>({
  path:r.path, declaredStatus:r.declaredStatus, status:r.status, localRecords:r.localRecords, officialRecords:r.officialRecords,
  counts:r.counts, missingCount:r.missing.length, invalidCodes:r.invalidCodes, targets:r.targets,
  missingSample:r.missing.slice(0,8), mismatchSample:r.matches.filter((m)=>m.type==="altered"||m.type==="extra").slice(0,5),
}))
console.log("OA_OFFICIAL_AUDIT_START")
console.log(JSON.stringify({summary,problematic},null,2))
console.log("OA_OFFICIAL_AUDIT_END")
