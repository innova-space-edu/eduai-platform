import fs from "node:fs"

const ROUTE = "app/api/agents/examen-docente/route.ts"
const PAGE = "app/examen/p/[code]/page.tsx"
const MARKER = "EDUAI_EXAM_ROSTER_GATE_V2"
const NOT_FOUND_MESSAGE =
  "Este RUT no está registrado en ningún curso activo de la base de datos. Avise al docente encargado para que pueda acceder con el código provisorio."

let route = fs.readFileSync(ROUTE, "utf8")
const page = fs.readFileSync(PAGE, "utf8")

// Este script corre al final de los transformadores del build. Su objetivo es
// impedir que una versión híbrida de la página pueda iniciar un intento usando
// solamente un RUT sintácticamente válido. La autorización real siempre debe
// provenir de student_roster en el servidor.
if (!route.includes(MARKER)) {
  const helperStart = route.indexOf("async function resolveActiveRosterStudent(rutClean: string) {")
  const helperEnd = route.indexOf("\n}\n", helperStart)
  if (helperStart < 0 || helperEnd < 0) {
    throw new Error(
      "[student-roster-gate] falta resolveActiveRosterStudent; se cancela el build para no publicar acceso inseguro",
    )
  }

  let helper = route.slice(helperStart, helperEnd + 3)

  // Solo la nómina activa del año escolar actual puede autorizar el ingreso.
  // Así un registro antiguo que haya quedado activo no habilita evaluaciones
  // del año vigente.
  if (!helper.includes("const currentSchoolYear = String(new Date().getFullYear())")) {
    helper = helper.replace(
      "async function resolveActiveRosterStudent(rutClean: string) {\n",
      "async function resolveActiveRosterStudent(rutClean: string) {\n  const currentSchoolYear = String(new Date().getFullYear())\n",
    )
  }

  if (!helper.includes('.eq("school_year", currentSchoolYear)')) {
    helper = helper.replace(
      '.eq("active", true)\n',
      '.eq("active", true)\n    .eq("school_year", currentSchoolYear)\n',
    )
  }

  if (!helper.includes('.eq("rut_clean", rutClean)') || !helper.includes('.eq("active", true)')) {
    throw new Error(
      "[student-roster-gate] la consulta de nómina no filtra por RUT y estado activo",
    )
  }

  helper = helper.replace(
    "async function resolveActiveRosterStudent(rutClean: string) {\n",
    `// ${MARKER}\nasync function resolveActiveRosterStudent(rutClean: string) {\n`,
  )
  route = route.slice(0, helperStart) + helper + route.slice(helperEnd + 3)

  const startBegin = route.indexOf('    if (action === "start_or_resume_attempt") {')
  const startEnd = route.indexOf(
    "    // ── Guardado automático del avance",
    startBegin,
  )
  if (startBegin < 0 || startEnd < 0) {
    throw new Error("[student-roster-gate] no se encontró start_or_resume_attempt")
  }

  let startBlock = route.slice(startBegin, startEnd)
  if (!startBlock.includes("const rosterStudent = await resolveActiveRosterStudent(rutClean)")) {
    throw new Error(
      "[student-roster-gate] start_or_resume_attempt no valida student_roster antes de iniciar",
    )
  }

  const rosterCheckIndex = startBlock.indexOf(
    "const rosterStudent = await resolveActiveRosterStudent(rutClean)",
  )
  const draftLookupIndex = startBlock.indexOf('.from("exam_attempt_drafts")')
  if (draftLookupIndex >= 0 && rosterCheckIndex > draftLookupIndex) {
    throw new Error(
      "[student-roster-gate] la validación de nómina debe ocurrir antes de recuperar o crear intentos",
    )
  }

  const oldMissing = `      if (!rosterStudent) {\n        return NextResponse.json(\n          { error: "No encontramos un estudiante activo con ese RUT. Revisa el RUT o consulta a tu docente." },\n          { status: 404 }\n        )\n      }`
  const newMissing = `      if (!rosterStudent) {\n        return NextResponse.json(\n          {\n            error: "${NOT_FOUND_MESSAGE}",\n            code: "STUDENT_NOT_IN_ROSTER",\n            requiresProvisionalCode: true,\n          },\n          { status: 404 }\n        )\n      }`

  if (startBlock.includes(oldMissing)) {
    startBlock = startBlock.replace(oldMissing, newMissing)
  } else if (!startBlock.includes('code: "STUDENT_NOT_IN_ROSTER"')) {
    throw new Error(
      "[student-roster-gate] no se pudo reforzar el mensaje de RUT no registrado",
    )
  }

  route = route.slice(0, startBegin) + startBlock + route.slice(startEnd)
  fs.writeFileSync(ROUTE, route)
}

const finalRoute = fs.readFileSync(ROUTE, "utf8")
const finalStart = finalRoute.slice(
  finalRoute.indexOf('    if (action === "start_or_resume_attempt") {'),
  finalRoute.indexOf(
    "    // ── Guardado automático del avance",
    finalRoute.indexOf('    if (action === "start_or_resume_attempt") {'),
  ),
)

for (const required of [
  MARKER,
  '.from("student_roster")',
  '.eq("rut_clean", rutClean)',
  '.eq("active", true)',
  '.eq("school_year", currentSchoolYear)',
  'code: "STUDENT_NOT_IN_ROSTER"',
  "requiresProvisionalCode: true",
  NOT_FOUND_MESSAGE,
]) {
  if (!finalRoute.includes(required)) {
    throw new Error(`[student-roster-gate] falta protección requerida: ${required}`)
  }
}

if (!finalStart.includes("resolveActiveRosterStudent(rutClean)")) {
  throw new Error("[student-roster-gate] el inicio no consulta la nómina")
}

// El cliente debe mantener el error en la pantalla de registro: no debe avanzar
// a phase=exam cuando la API devuelve 404/403/409.
if (
  !page.includes('if (!res.ok || !data?.success)') ||
  !page.includes('throw new Error(data?.error || "No se pudo verificar tu identidad.")')
) {
  throw new Error(
    "[student-roster-gate] la página pública no conserva el rechazo del servidor",
  )
}

console.log(
  "[student-roster-gate] RUT no registrado bloqueado; se deriva al código provisorio",
)
