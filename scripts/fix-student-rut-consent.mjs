import fs from "node:fs"

const routePath = "app/api/agents/examen-docente/route.ts"
let source = fs.readFileSync(routePath, "utf8")

// La primera versión del parche comparte un patrón entre inicio y autosave.
// Aseguramos explícitamente que el inicio conserve el RUT formateado.
const startNeedle = `      const studentCourse = String(rosterStudent.course || "").trim()\n      if (!studentName || !studentCourse) {\n        return NextResponse.json(\n          { error: "Tu registro de estudiante está incompleto. Consulta a tu docente antes de continuar." },\n          { status: 409 }\n        )\n      }\n\n      const totalQuestions = Array.isArray(officialExam.questions) ? officialExam.questions.length : 0`
const startFixed = `      const studentCourse = String(rosterStudent.course || "").trim()\n      if (!studentName || !studentCourse) {\n        return NextResponse.json(\n          { error: "Tu registro de estudiante está incompleto. Consulta a tu docente antes de continuar." },\n          { status: 409 }\n        )\n      }\n\n      const formattedRut = formatRut(rutClean)\n      const totalQuestions = Array.isArray(officialExam.questions) ? officialExam.questions.length : 0`
if (source.includes(startNeedle)) source = source.replace(startNeedle, startFixed)

// En autosave ya no se actualiza identidad; eliminamos la variable si quedó sin uso.
const autosaveMarker = `    // ── Guardado automático del avance ───────────────────────────────────────`
const createMarker = `    if (action === "create") {`
const autosaveStart = source.indexOf(autosaveMarker)
const autosaveEnd = source.indexOf(createMarker, autosaveStart)
if (autosaveStart >= 0 && autosaveEnd > autosaveStart) {
  let block = source.slice(autosaveStart, autosaveEnd)
  block = block.replace(`      const formattedRut = formatRut(rutClean)\n`, "")
  source = source.slice(0, autosaveStart) + block + source.slice(autosaveEnd)
}

// El submit debe usar identidad de la nómina y no depender de nombre/curso del navegador.
const submitStart = source.indexOf(`    if (action === "submit") {`)
const closeStart = source.indexOf(`    if (action === "close") {`, submitStart)
if (submitStart >= 0 && closeStart > submitStart) {
  let block = source.slice(submitStart, closeStart)
  block = block.replace(`        studentName,\n        studentCourse,\n`, "")
  source = source.slice(0, submitStart) + block + source.slice(closeStart)
}

if (!source.includes(`const formattedRut = formatRut(rutClean)`) || !source.includes(`studentName,\n            studentCourse,\n            studentRut: formattedRut`)) {
  throw new Error("[fix-student-rut-consent] no se pudo verificar la identidad de inicio")
}
if (!source.includes(`authoritativeName`) || !source.includes(`student_roster_id: rosterStudent.id`)) {
  throw new Error("[fix-student-rut-consent] submit no quedó vinculado a la nómina")
}

fs.writeFileSync(routePath, source)
console.log("[fix-student-rut-consent] parche verificado")
