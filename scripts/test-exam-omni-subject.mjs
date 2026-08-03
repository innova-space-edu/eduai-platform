import { existsSync, readFileSync } from "node:fs"

const checks = [
  {
    path: "app/examen/crear/page.tsx",
    required: [
      "EXAM_OMNI_SUBJECT_PATCH_V1",
      "getAvailableAsignaturas",
      "availableSubjects",
      "PEDAGOGICAL_MODES",
      "buildSubjectGenerationDirective",
      "pedagogicalContext",
      "aiRequireOA",
      "aiSourceContext",
      "Perfil pedagógico activo",
      "MODOS PEDAGÓGICOS",
    ],
  },
  {
    path: "app/api/agents/exam-generate/route.ts",
    required: [
      "EXAM_OMNI_SUBJECT_API_V1",
      "evaluación escolar multiasignatura",
      "mixed_choice_development",
      "No inventes citas",
      "Historia/ciudadanía",
      "Artes/música",
    ],
  },
  {
    path: "lib/exam/subject-pedagogy.ts",
    required: [
      "PEDAGOGICAL_MODES",
      "getSubjectPedagogyProfile",
      "buildSubjectGenerationDirective",
      "OBJETIVOS DE APRENDIZAJE QUE DEBEN SER EVALUADOS",
    ],
  },
]

const failures = []

for (const check of checks) {
  if (!existsSync(check.path)) {
    failures.push(`${check.path}: archivo inexistente`)
    continue
  }

  const source = readFileSync(check.path, "utf8")
  for (const token of check.required) {
    if (!source.includes(token)) failures.push(`${check.path}: falta ${token}`)
  }
}

const page = existsSync("app/examen/crear/page.tsx")
  ? readFileSync("app/examen/crear/page.tsx", "utf8")
  : ""

if ((page.match(/EXAM_OMNI_SUBJECT_PATCH_V1/g) || []).length !== 1) {
  failures.push("app/examen/crear/page.tsx: el parche multiasignatura no es idempotente")
}

const api = existsSync("app/api/agents/exam-generate/route.ts")
  ? readFileSync("app/api/agents/exam-generate/route.ts", "utf8")
  : ""

if ((api.match(/EXAM_OMNI_SUBJECT_API_V1/g) || []).length !== 1) {
  failures.push("app/api/agents/exam-generate/route.ts: el parche de API no es idempotente")
}

if (!page.includes("selectedOAs") || !page.includes("selectedOAIds")) {
  failures.push("El creador no conserva la selección curricular de OA")
}

if (!page.includes("getAvailableAsignaturas(curriculumNivel, curriculumCurso)")) {
  failures.push("La asignatura no está conectada al nivel y curso seleccionados")
}

if (failures.length) {
  console.error("[test-exam-omni] falló la verificación integral")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("[test-exam-omni] creador multiasignatura, OA y motor pedagógico verificados")
