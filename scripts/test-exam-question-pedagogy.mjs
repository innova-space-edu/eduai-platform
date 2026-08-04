import { existsSync, readFileSync } from "node:fs"

const pagePath = "app/examen/crear/page.tsx"
const apiPath = "app/api/agents/exam-generate/route.ts"
const failures = []

if (!existsSync(pagePath)) failures.push(`${pagePath}: inexistente`)
if (!existsSync(apiPath)) failures.push(`${apiPath}: inexistente`)

const page = existsSync(pagePath) ? readFileSync(pagePath, "utf8") : ""
const api = existsSync(apiPath) ? readFileSync(apiPath, "utf8") : ""

for (const token of [
  "EXAM_QUESTION_PEDAGOGY_META_V1",
  "QuestionPedagogyMeta",
  "getQuestionPedagogyPayload",
  "oaCodes",
  "pedagogicalMode",
  "Habilidad: {q.skill}",
  "<strong>Evidencia:</strong>",
]) {
  if (!page.includes(token)) failures.push(`${pagePath}: falta ${token}`)
}

for (const token of ["oaCodes, pedagogicalMode, skill y evidence", "Usa solo códigos OA"]) {
  if (!api.includes(token)) failures.push(`${apiPath}: falta ${token}`)
}

const payloadCount = (page.match(/\.\.\.getQuestionPedagogyPayload\(q\)/g) || []).length
if (payloadCount < 4) {
  failures.push(`Solo ${payloadCount} formatos conservan la trazabilidad pedagógica`)
}

if (failures.length) {
  console.error("[test-exam-question-pedagogy] falló")
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log("[test-exam-question-pedagogy] trazabilidad OA y pedagógica verificada")
