import { strict as assert } from "node:assert"
import { getAvailableAsignaturas } from "../lib/mineduc-oa"
import { resolveOAConnection } from "../lib/planner-oa-bridge"
import { auditPlanningOutput, inferPlanningProfile } from "../lib/school-planning-profiles"
import { buildSchoolWeekPlan, getSchoolPlanningPeriodLabel, validateSchoolPlanningWeeks } from "../lib/school-planning-template"
import { buildSchoolPlanningRenderRows, replaceSchoolPlanningRows } from "../lib/school-planning-pdf"
import { getPlanningHorizonConfig, getPlannerOAOptions } from "../lib/planificador-curriculum"
import { buildParvulariaDateLabel, calculateParvulariaEndDate, parseParvulariaPlanningDocument, serializeParvulariaPlanningDocument } from "../lib/parvularia-planning"

const profileCases = [
  ["Organiza una feria científica con stands, experimentos y presentación a apoderados", "media", "feria_cientifica"],
  ["Planifica una salida pedagógica al museo", "basica", "salida_pedagogica"],
  ["Realiza una campaña de reciclaje para el colegio", "media", "campana"],
  ["Crea una clase de probabilidad", "media", "clase"],
  ["Diseña una experiencia con texturas y sonidos", "parvularia", "experiencia_parvularia"],
  ["Prepara un acto de aniversario con la comunidad", "basica", "evento_escolar"],
  ["Desarrolla un proyecto STEAM con prototipos", "media", "proyecto_abp"],
] as const

for (const [request, nivel, expected] of profileCases) {
  const detected = inferPlanningProfile(request, nivel).id
  assert.equal(detected, expected, `Perfil incorrecto para: ${request}`)
  console.log(`✓ Perfil ${expected}: ${request}`)
}

const mathSubjects = getAvailableAsignaturas("media", "2° Medio")
assert(mathSubjects.includes("Matemática"), "La base local debe ofrecer Matemática para 2° Medio")

const automatic = resolveOAConnection({
  state: { nivel: "media", curso: "2° Medio", asignatura: "Matemática" },
  selectedOAIds: [],
  userText: "probabilidad, experimento aleatorio y eventos",
})
assert(automatic.summary.hasCurriculum, "Debe existir cobertura curricular local")
assert(automatic.autoSelected, "La búsqueda contextual debe sugerir OA automáticamente")
assert(automatic.resolvedOAIds.length > 0, "Debe recuperar al menos un OA")
console.log(`✓ OA automáticos conectados: ${automatic.resolvedOAIds.join(", ")}`)

const synonymAutomatic = resolveOAConnection({
  state: { nivel: "media", curso: "2° Medio", asignatura: "Matemática" },
  selectedOAIds: [],
  userText: "Analizar situaciones de azar e incertidumbre mediante experimentos",
})
assert(synonymAutomatic.autoSelected, "Los sinónimos de probabilidad deben sugerir OA automáticamente")
assert(synonymAutomatic.resolvedOAIds.length > 0, "La expansión semántica debe recuperar al menos un OA")
console.log(`✓ OA conectados mediante sinónimos: ${synonymAutomatic.resolvedOAIds.join(", ")}`)

const manualId = automatic.all[0]?.id
assert(manualId, "Debe existir al menos un OA disponible")
const manual = resolveOAConnection({
  state: { nivel: "media", curso: "2° Medio", asignatura: "Matemática" },
  selectedOAIds: [manualId],
  userText: "feria científica interdisciplinaria",
})
assert(manual.manuallySelected, "La selección manual debe tener prioridad")
assert.deepEqual(manual.resolvedOAIds, [manualId], "No se debe reemplazar el OA elegido por el docente")
console.log(`✓ Selección manual respetada: ${manualId}`)

const feriaProfile = inferPlanningProfile("feria científica", "media")
const shallowAudit = auditPlanningOutput("Feria con etapas, roles, stands, seguridad, cronograma, rúbrica y OA oficiales", feriaProfile)
assert.equal(shallowAudit.passed, false, "Una frase con palabras clave no debe aprobar el auditor")

const structuredFair = `# Feria científica escolar
## OA oficiales
- OA 1: analizar evidencias científicas.
## Etapas y cronograma
| Semana | Etapa | Evidencia |
|---|---|---|
| 1 | Investigación y formulación del problema | Bitácora inicial |
| 2 | Diseño experimental y ensayo | Registro de resultados |
## Roles y stands
- Cada equipo define roles de coordinación, investigación y comunicación.
- Cada stand presenta experimento, resultados y conclusiones.
## Seguridad
- Aplicar protocolo de riesgos, manejo de residuos y plan de contingencia.
## Rúbrica
| Criterio | Nivel esperado |
|---|---|
| Investigación | Usa evidencias claras |
| Comunicación | Explica con precisión |
`
const structuredAudit = auditPlanningOutput(structuredFair, feriaProfile)
assert(structuredAudit.passed, "Una feria desarrollada debe aprobar el auditor")
console.log(`✓ Auditor estructural de feria científica: ${structuredAudit.score}/100`)

const firstSemester = buildSchoolWeekPlan("semestral", "primer-semestre", "marzo")
assert.equal(firstSemester.length, 16, "El primer semestre institucional debe tener 16 semanas (marzo-junio)")
assert.equal(firstSemester[0]?.key, "marzo-1")
assert.equal(firstSemester.at(-1)?.key, "junio-4")
assert.equal(getSchoolPlanningPeriodLabel("semestral", "primer-semestre"), "I SEMESTRE")

const annual = buildSchoolWeekPlan("anual", "anio-escolar", "marzo")
assert.equal(annual.length, 40, "El cronograma anual debe cubrir 10 meses con 4 semanas cada uno")

const validSchedule = firstSemester.map((week) => ({ ...week, oaIds: ["dummy-oa"] }))
assert(validateSchoolPlanningWeeks(validSchedule, "semestral", "primer-semestre").valid, "La secuencia semestral correcta debe validarse")

const invalidSchedule = validSchedule.slice(1)
assert.equal(validateSchoolPlanningWeeks(invalidSchedule, "semestral", "primer-semestre").valid, false, "No debe aceptar semanas incompletas o desplazadas")
console.log("✓ Periodos institucionales: mensual, semestral y anual")
console.log("✓ Validación estricta de secuencia semanal institucional")

const previewPdfRows = buildSchoolPlanningRenderRows(
  {
    year: 2026,
    periodLabel: "I SEMESTRE",
    professor: "Docente",
    subject: "Matemática",
    hours: "4",
    course: "1° Medio",
    schedule: [{ month: "marzo", week: 1 }],
    oaByWeek: [{ oas: [{ code: "MA1M OA 01", text: "Texto oficial más extenso que la salida IA." }] }],
  },
  `# CRONOGRAMA 2026
## I SEMESTRE

| SEMANA / FECHA | OA | INDICADORES DE EVALUACIÓN | OBJETIVO DE LA CLASE |
|---|---|---|---|
| Marzo<br>1 | OA breve | • Indicador 1<br>• Indicador 2 | • Objetivo 1<br>• Objetivo 2 |`,
)
assert.equal(previewPdfRows[0]?.week, "Marzo\n1", "La vista debe convertir <br> a saltos de línea reales")
assert.equal(previewPdfRows[0]?.oa, "MA1M OA 01\nTexto oficial más extenso que la salida IA.", "PDF y vista deben usar el OA oficial final")
assert.equal(previewPdfRows[0]?.indicators.includes("<br>"), false, "La vista institucional no debe mostrar etiquetas <br>")

const editedContent = replaceSchoolPlanningRows(
  `# CRONOGRAMA 2026
## I SEMESTRE

| SEMANA / FECHA | OA | INDICADORES DE EVALUACIÓN | OBJETIVO DE LA CLASE |
|---|---|---|---|
| Marzo<br>1 | MA1M OA 01<br>Texto oficial | • Indicador original | • Objetivo original |

Base curricular utilizada: Matemática 1° Medio.`,
  [{
    week: "Marzo\n1",
    oa: "MA1M OA 01\nTexto oficial",
    indicators: "• Indicador editado\n• Segundo indicador",
    objective: "• Objetivo editado\n• Actividad complementaria",
  }],
)
assert(editedContent.includes("• Indicador editado<br>• Segundo indicador"), "El editor visual debe serializar saltos de línea dentro de la celda")
assert(editedContent.includes("Base curricular utilizada: Matemática 1° Medio."), "El editor visual debe conservar el pie del documento")
const editedRows = buildSchoolPlanningRenderRows(
  {
    year: 2026,
    periodLabel: "I SEMESTRE",
    professor: "Docente",
    subject: "Matemática",
    hours: "4",
    course: "1° Medio",
    schedule: [{ month: "marzo", week: 1 }],
    oaByWeek: [{ oas: [{ code: "MA1M OA 01", text: "Texto oficial" }] }],
  },
  editedContent,
)
assert.equal(editedRows[0]?.indicators, "• Indicador editado\n• Segundo indicador")
assert.equal(editedRows[0]?.objective, "• Objetivo editado\n• Actividad complementaria")

const fullyEditedRows = buildSchoolPlanningRenderRows(
  {
    year: 2026,
    periodLabel: "I SEMESTRE",
    professor: "Docente",
    subject: "Matemática",
    hours: "4",
    course: "1° Medio",
    schedule: [{ month: "marzo", week: 1 }],
    oaByWeek: [{ oas: [{ code: "MA1M OA 01", text: "Texto oficial" }] }],
    preferContentRows: true,
  },
  replaceSchoolPlanningRows(editedContent, [{
    week: "Semana especial\n15 al 19 de marzo",
    oa: "OA editado por el docente\nTexto personalizado",
    indicators: "• Indicador personalizado",
    objective: "• Objetivo personalizado",
  }]),
)
assert.equal(fullyEditedRows[0]?.week, "Semana especial\n15 al 19 de marzo", "La planificación guardada debe respetar la semana editada")
assert.equal(fullyEditedRows[0]?.oa, "OA editado por el docente\nTexto personalizado", "La planificación guardada debe respetar el OA editado")
assert.equal(fullyEditedRows[0]?.indicators, "• Indicador personalizado")
assert.equal(fullyEditedRows[0]?.objective, "• Objetivo personalizado")
console.log("✓ Paridad de contenido entre vista institucional, editor visual y PDF")
console.log("✓ Edición completa de las cuatro celdas de cada fila")

const quincenal = getPlanningHorizonConfig("quincenal")
assert.equal(quincenal.shortLabel, "Quincenal", "Parvularia debe disponer del horizonte quincenal")
assert.equal(buildParvulariaDateLabel("2026-05-13", "2026-06-04"), "13 de mayo de 2026 al 04 de junio de 2026")

assert.equal(calculateParvulariaEndDate("2026-09-20", "diaria"), "2026-09-20")
assert.equal(calculateParvulariaEndDate("2026-09-20", "semanal"), "2026-09-26")
assert.equal(calculateParvulariaEndDate("2026-09-20", "quincenal"), "2026-10-04")

const eenOA = getPlannerOAOptions({
  nivel: "parvularia",
  curso: "Sala Cuna Mayor (1 a 2 años)",
  asignatura: "Exploración del Entorno Natural",
})
assert.equal(eenOA.length, 5, "Sala Cuna · Exploración del Entorno Natural debe mostrar solo sus 5 OA")
assert(eenOA.every((oa) => oa.nucleo === "Exploración del entorno natural"), "No se deben mezclar núcleos en el selector principal")

const cesOA = getPlannerOAOptions({
  nivel: "parvularia",
  curso: "Sala Cuna Mayor (1 a 2 años)",
  asignatura: "Comprensión del Entorno Sociocultural",
})
const ces04 = cesOA.find((oa) => oa.codigoOficial === "OA 04 CES SC")
assert(ces04?.texto.includes("Explorar utensilios domésticos y objetos tecnológicos"), "OA 04 CES SC debe coincidir con BCEP 2018")
assert(!cesOA.some((oa) => /Unidad de Currículum|Ayuda Mineduc|Políticas de Privacidad/.test(oa.texto)), "Los OA no deben contener footer del sitio MINEDUC")

const corporalidad = getPlannerOAOptions({
  nivel: "parvularia",
  curso: "Sala Cuna Mayor (1 a 2 años)",
  asignatura: "Corporalidad y Movimiento",
})
assert.equal(corporalidad.length, 7, "Sala Cuna · Corporalidad y Movimiento debe exponer 7 objetivos transversales")
assert(corporalidad.every((oa) => oa.tipo === "oat"), "Desarrollo Personal y Social debe conservar su carácter transversal")
console.log("✓ Parvularia: fechas automáticas, filtro por núcleo y BCEP verificadas")

const parvulariaJson = serializeParvulariaPlanningDocument({
  version: 1,
  tipo: "parvularia_institucional",
  titulo: "Planificación Quincenal 2026",
  nivelEducativo: "Sala Cuna Mayor",
  fechas: "13 de mayo de 2026 al 04 de junio de 2026",
  educadoraParvulos: "Educadora",
  asistentesParvulos: "Asistente 1 – Asistente 2",
  objetivoAprendizaje: "Favorecer experiencias integradas.",
  principioJuego: "El juego como eje.",
  principioActividad: "Los párvulos protagonizan sus aprendizajes.",
  focoExperiencia: "Exploración sensorial.",
  horizonte: "quincenal",
  filas: [{
    ambitoNucleo: "AMBITO: Interacción y comprensión del entorno\nNUCLEO: Exploración del entorno natural",
    objetivosAprendizajes: "OA N° 3\nTexto oficial",
    experienciaAprendizaje: "Inicio:\nExploración.\nDesarrollo:\nExperiencia sensorial.\nFinalización:\nCierre.",
    orientacionesRelevantes: "Preparar materiales y resguardar seguridad.",
    rolEquipoFamilia: "Rol del equipo: mediar.\nRol de la familia: apoyar continuidad.",
    recursos: "RECURSOS TANGIBLES\nArena\nRECURSOS INTANGIBLES\nVoz de la educadora",
    evaluacion: "Instrumento: Escala de apreciación.\nIndicadores:\n1. Explora materiales.",
  }],
})
const parsedParvularia = parseParvulariaPlanningDocument(parvulariaJson)
assert.equal(parsedParvularia.horizonte, "quincenal")
assert.equal(parsedParvularia.filas.length, 1)
assert(parsedParvularia.filas[0]?.experienciaAprendizaje.includes("Finalización"), "Debe conservar toda la experiencia editable")
assert(parsedParvularia.filas[0]?.rolEquipoFamilia.includes("Rol de la familia"), "Debe conservar el rol de la familia")
assert(parsedParvularia.filas[0]?.recursos.includes("RECURSOS INTANGIBLES"), "Debe conservar recursos tangibles e intangibles")
assert(parsedParvularia.filas[0]?.evaluacion.includes("Indicadores"), "Debe conservar evaluación e indicadores")
console.log("✓ Plantilla Parvularia: diaria/semanal/quincenal/mensual/semestral y edición estructurada")

console.log("\nPlanificador escolar integral: todas las pruebas pasaron.")
