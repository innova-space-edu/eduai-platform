import { strict as assert } from "node:assert"
import { getAvailableAsignaturas } from "../lib/mineduc-oa"
import { resolveOAConnection } from "../lib/planner-oa-bridge"
import { auditPlanningOutput, inferPlanningProfile } from "../lib/school-planning-profiles"

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
const audit = auditPlanningOutput("Feria con etapas, roles, stands, seguridad, cronograma, rúbrica y OA oficiales", feriaProfile)
assert.equal(audit.score, 100, "El auditor de feria debe reconocer una salida completa")
console.log("✓ Auditor integral de feria científica: 100/100")

console.log("\nPlanificador escolar integral: todas las pruebas pasaron.")
