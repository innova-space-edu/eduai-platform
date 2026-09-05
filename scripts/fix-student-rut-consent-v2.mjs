import fs from "node:fs"

const pagePath = "app/examen/p/[code]/page.tsx"
const routePath = "app/api/agents/examen-docente/route.ts"

let page = fs.readFileSync(pagePath, "utf8")
let route = fs.readFileSync(routePath, "utf8")

// Nombre y curso ya fueron resueltos por el servidor al iniciar. Los seguimos
// enviando en autosave/submit para mantener compatibilidad con la idempotencia
// existente, aunque la entrega final vuelve a validar el RUT contra la nómina.
if (!page.includes(`action: "autosave_attempt",\n            examId: snapshot.exam.id,\n            studentName: snapshot.name,`)) {
  page = page.replace(
    `action: "autosave_attempt",\n            examId: snapshot.exam.id,\n            studentRut: snapshot.rut,`,
    `action: "autosave_attempt",\n            examId: snapshot.exam.id,\n            studentName: snapshot.name,\n            studentCourse: snapshot.course,\n            studentRut: snapshot.rut,`,
  )
}

if (!page.includes(`action: "submit",\n            examId: exam.id,\n            studentName: name,`)) {
  page = page.replace(
    `action: "submit",\n            examId: exam.id,\n            studentRut: normalizeRutInput(rut),`,
    `action: "submit",\n            examId: exam.id,\n            studentName: name,\n            studentCourse: course,\n            studentRut: normalizeRutInput(rut),`,
  )
}

function restoreIdentityDestructure(block) {
  if (block.includes(`examId,\n        studentName,\n        studentCourse,\n        studentRut,`)) return block
  return block.replace(
    `examId,\n        studentRut,`,
    `examId,\n        studentName,\n        studentCourse,\n        studentRut,`,
  )
}

const autosaveStart = route.indexOf(`    if (action === "autosave_attempt") {`)
const createStart = route.indexOf(`    if (action === "create") {`, autosaveStart)
if (autosaveStart >= 0 && createStart > autosaveStart) {
  const block = restoreIdentityDestructure(route.slice(autosaveStart, createStart))
  route = route.slice(0, autosaveStart) + block + route.slice(createStart)
}

const submitStart = route.indexOf(`    if (action === "submit") {`)
const closeStart = route.indexOf(`    if (action === "close") {`, submitStart)
if (submitStart >= 0 && closeStart > submitStart) {
  const block = restoreIdentityDestructure(route.slice(submitStart, closeStart))
  route = route.slice(0, submitStart) + block + route.slice(closeStart)
}

fs.writeFileSync(pagePath, page)
fs.writeFileSync(routePath, route)

if (!page.includes(`studentName: name`) || !page.includes(`studentCourse: course`)) {
  throw new Error("[fix-student-rut-consent-v2] submit no conserva identidad resuelta")
}
if (!route.includes(`studentName,\n        studentCourse,\n        studentRut,`)) {
  throw new Error("[fix-student-rut-consent-v2] faltan variables de compatibilidad en API")
}

console.log("[fix-student-rut-consent-v2] contratos de autosave/idempotencia preservados")
