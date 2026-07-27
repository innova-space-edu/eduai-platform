import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const failures = []
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const exists = (file) => fs.existsSync(path.join(root, file))
const check = (condition, message) => { if (!condition) failures.push(message) }

const requiredFiles = [
  "app/pizarra-interactiva/page.tsx",
  "components/whiteboard/WhiteboardMathStudio.tsx",
  "app/api/whiteboard/recognize/route.ts",
  "app/api/whiteboard/solve/route.ts",
  "app/api/whiteboard/notebooks/route.ts",
  "app/api/whiteboard/notebooks/[id]/route.ts",
  "lib/whiteboard/types.ts",
  "lib/whiteboard/geometry.ts",
  "lib/whiteboard/math-engine.ts",
  "services/whiteboard-math-engine/main.py",
  "services/whiteboard-math-engine/requirements.txt",
  "supabase/migrations/202607260004_whiteboard_math_studio.sql",
]

for (const file of requiredFiles) check(exists(file), `Falta el archivo requerido: ${file}`)

const page = read("components/whiteboard/WhiteboardMathStudio.tsx")
for (const feature of [
  "Editar LaTeX",
  "renderBlockImages",
  "segmentStrokes",
  'runMath("solve")',
  'runMath("verify")',
  'runMath("hint")',
  'runMath("graph")',
  "/api/whiteboard/notebooks",
  "cloudStatus",
  "GraphView",
]) check(page.includes(feature), `La interfaz no contiene: ${feature}`)

const recognize = read("app/api/whiteboard/recognize/route.ts")
check(recognize.includes('return { strokes: { strokes }, formats }'), "El payload Mathpix no usa doble anidación")
check(recognize.includes("recognizeWithGemini"), "No existe respaldo visual con Gemini")
check(recognize.includes("segmentStrokes"), "El OCR no trabaja por bloques")
check(recognize.includes("supabase.auth.getUser"), "El OCR no verifica sesión")

const solve = read("app/api/whiteboard/solve/route.ts")
check(solve.includes("callPythonMathEngine"), "La resolución no intenta usar SymPy")
check(solve.includes("solveDeterministically"), "No existe respaldo determinista")
check(solve.includes("solveWithAI"), "No existe respaldo pedagógico con IA")

const engine = read("lib/whiteboard/math-engine.ts")
for (const feature of ["polynomialForEquation", "verifyProcedure", "graphFromLatex", "ExpressionParser"]) {
  check(engine.includes(feature), `El motor local no contiene: ${feature}`)
}

const proxy = read("proxy.ts")
check(proxy.includes('"/pizarra-interactiva"'), "La ruta de pizarra no está protegida")
check(proxy.includes("isWhiteboardAPI"), "Las APIs de pizarra no están aisladas en el proxy")
check(proxy.includes('"/api/whiteboard/recognize"'), "No existe límite específico para OCR")
check(proxy.includes('"/api/whiteboard/solve"'), "No existe límite específico para resolución")

const migration = read("supabase/migrations/202607260004_whiteboard_math_studio.sql")
for (const table of ["whiteboard_notebooks", "whiteboard_pages", "whiteboard_recognition_runs", "whiteboard_solution_runs"]) {
  check(migration.includes(table), `La migración no crea ${table}`)
}

if (failures.length) {
  console.error("\nWhiteboard Math Studio: FAILED")
  failures.forEach((failure) => console.error(` - ${failure}`))
  process.exit(1)
}

console.log(`Whiteboard Math Studio: OK (${requiredFiles.length} archivos y controles críticos validados)`)
