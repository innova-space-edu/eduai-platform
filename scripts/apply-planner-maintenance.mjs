import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const routePath = path.join(root, "app/api/agents/educador/route.ts")
const route = fs.readFileSync(routePath, "utf8")

const oldRubric = "Incluye criterios sobre dominio del contenido, explicación del problema ambiental, propuesta/intervención, actividad práctica, manejo de preguntas, comunicación oral, uso de evidencias/recursos, conciencia y promoción del cuidado del entorno."
const newRubric = "Construye criterios adaptativos según la solicitud, la asignatura, el nivel y el producto evaluado. Incluye dominio del contenido, calidad del producto o desempeño, proceso de trabajo, uso de evidencias o recursos, comunicación, responsabilidad y seguridad cuando corresponda. Agrega criterios ambientales solo si el tema realmente se relaciona con medioambiente, sustentabilidad o cuidado del entorno. Para feria científica incorpora investigación, evidencia experimental o prototipo, stand, explicación pública, roles y seguridad. Para parvularia usa observación cualitativa, exploración, mediación, participación y bienestar."

let changed = false
let nextRoute = route
if (route.includes(oldRubric)) {
  nextRoute = route.replace(oldRubric, newRubric)
  fs.writeFileSync(routePath, nextRoute, "utf8")
  changed = true
  console.log("[planner-maintenance] rubric prompt generalized")
} else {
  console.log("[planner-maintenance] rubric prompt already generalized")
}

const curricularRoutePath = path.join(root, "app/api/agents/planificador-curricular/route.ts")
if (fs.existsSync(curricularRoutePath)) {
  let curricularRoute = fs.readFileSync(curricularRoutePath, "utf8")

  if (!curricularRoute.includes("function isMacroPlanningForSchool")) {
    curricularRoute = curricularRoute.replace(
      "function truncate(text: string, max = 2400) {",
      "function isMacroPlanningForSchool(tiempo: TiempoPlanificacion, nivel: NivelKey) {\n  return nivel !== \"parvularia\" && (tiempo === \"semanal\" || tiempo === \"mensual\" || tiempo === \"semestral\" || tiempo === \"anual\")\n}\n\nfunction truncate(text: string, max = 2400) {"
    )
  }

  curricularRoute = curricularRoute.replace(
    "const horizon = getPlanningHorizonConfig(tiempo)",
    "const isMacro = isMacroPlanningForSchool(tiempo, nivel)\n  const horizon = getPlanningHorizonConfig(tiempo)"
  )

  curricularRoute = curricularRoute.replace(
    "const horizonText = buildPlanningHorizonText(tiempo, sesiones, duracionMinutos, periodoLabel)",
    "const horizonText = buildPlanningHorizonText(tiempo, sesiones, isMacro ? \"\" : duracionMinutos, periodoLabel)"
  )

  curricularRoute = curricularRoute.replace(
    "5. Para planificación semestral/anual, no desarrolles cada clase completa; distribuye meses, semanas o tramos y deja puente para el agente diario.",
    "5. Para planificación semanal, mensual, semestral o anual de básica y media, genera cronograma institucional por semanas o meses; no desarrolles una clase diaria. Parvularia conserva su enfoque actual por ámbitos, núcleos y experiencias."
  )

  curricularRoute = curricularRoute.replace(
    "8. La respuesta debe quedar lista para copiar, guardar o exportar.",
    "8. La respuesta debe quedar lista para copiar, guardar o exportar.\n9. Si el horizonte es semanal, mensual, semestral o anual y el nivel no es parvularia, NO uses minutos, NO uses inicio-desarrollo-cierre, NO escribas sesión de 45 minutos y NO conviertas marzo-junio en una sola clase. Usa tabla: Semana/Fecha | OA | Indicadores de evaluación | Objetivo de la clase / actividad general | Evaluación/evidencia | Recursos. Máximo 4 objetivos o actividades generales por semana."
  )

  curricularRoute = curricularRoute.replace(
    "- Duración por sesión: ${duracionMinutos} minutos",
    "- Duración por sesión: ${isMacro ? \"No aplica en cronograma institucional\" : `${duracionMinutos} minutos`}"
  )

  fs.writeFileSync(curricularRoutePath, curricularRoute, "utf8")
  changed = true
  console.log("[planner-maintenance] curricular macro guard connected")
}

const educatorPagePath = path.join(root, "app/educador/page.tsx")
if (fs.existsSync(educatorPagePath)) {
  let educatorPage = fs.readFileSync(educatorPagePath, "utf8")

  if (!educatorPage.includes("function buildPromptWithContext")) {
    educatorPage = educatorPage.replace(
      "  async function handleRegenerate() {",
      `  function buildPromptWithContext(basePrompt: string) {
    const docenteIdea = config.contexto.trim()
    const unidadTexto = selectedUnit?.label || "Sin bloque/unidad local seleccionada"
    const oaTexto = selectedOAObjects.length
      ? selectedOAObjects.map((oa) => `${oa.codigoOficial || oa.id}: ${oa.texto}`).join("\\n")
      : "Sin OA seleccionado manualmente"
    const oatTexto = config.nivel === "parvularia" && config.selectedOATIds.length
      ? config.selectedOATIds.join(", ")
      : "Sin OAT seleccionado"

    return [
      basePrompt,
      "",
      "IMPORTANTE: usa como eje central la información que escribió el docente en el cuadro 'Tu proyecto o idea'. No la ignores.",
      "",
      "CONTEXTO ESCRITO POR EL DOCENTE:",
      docenteIdea || "El docente no escribió contexto adicional.",
      "",
      "CONFIGURACIÓN ACTIVA:",
      ` + "`" + `- Nivel: ${config.nivel}` + "`" + `,
      ` + "`" + `- Curso/Subnivel: ${config.curso}` + "`" + `,
      ` + "`" + `- Asignatura/Núcleo: ${config.asignatura}` + "`" + `,
      ` + "`" + `- Tipo de planificación: ${config.tiempoPlanificacion}` + "`" + `,
      ` + "`" + `- Mes: ${config.mes}` + "`" + `,
      ` + "`" + `- Sesiones: ${config.sesiones}` + "`" + `,
      ` + "`" + `- Duración: ${config.duracionMinutos} min` + "`" + `,
      "",
      "UNIDAD/BLOQUE SELECCIONADO:",
      unidadTexto,
      "",
      "OA SELECCIONADOS:",
      oaTexto,
      "",
      config.nivel === "parvularia" ? "OAT SELECCIONADOS:" : "",
      config.nivel === "parvularia" ? oatTexto : "",
    ].filter(Boolean).join("\\n")
  }

  async function handleRegenerate() {`
    )
  }

  educatorPage = educatorPage.replace(
    "onClick={() => sendMessage(qp.prompt)}",
    "onClick={() => sendMessage(buildPromptWithContext(qp.prompt))}"
  )

  fs.writeFileSync(educatorPagePath, educatorPage, "utf8")
  changed = true
  console.log("[planner-maintenance] quick prompts include teacher context")
}

for (const file of ["fix-exam-generate.diff", "fix-exam-create-page.diff"]) {
  const target = path.join(root, file)
  if (fs.existsSync(target)) {
    fs.rmSync(target)
    changed = true
    console.log(`[planner-maintenance] removed ${file}`)
  }
}

console.log(changed ? "[planner-maintenance] repository updated" : "[planner-maintenance] no changes required")
