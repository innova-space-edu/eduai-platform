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

for (const file of ["fix-exam-generate.diff", "fix-exam-create-page.diff"]) {
  const target = path.join(root, file)
  if (fs.existsSync(target)) {
    fs.rmSync(target)
    changed = true
    console.log(`[planner-maintenance] removed ${file}`)
  }
}

console.log(changed ? "[planner-maintenance] repository updated" : "[planner-maintenance] no changes required")
