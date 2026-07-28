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
  "app/api/whiteboard/notebooks/route.ts",
  "app/api/whiteboard/notebooks/[id]/route.ts",
  "supabase/migrations/202607260004_whiteboard_math_studio.sql",
  "scripts/whiteboard-template/rotation-upgrade.b64",
  "scripts/whiteboard-template/ai-visual-upgrade.b64",
]

for (const file of requiredFiles) check(exists(file), `Falta el archivo requerido: ${file}`)

const page = read("components/whiteboard/WhiteboardMathStudio.tsx")
for (const feature of [
  "Cuaderno digital interactivo",
  "shapes2d",
  "shapes3d",
  "graphs",
  "page-settings",
  "getUserMedia",
  "/api/agents/imagenes",
  "exportJson",
  "importMaterial",
  "exportPage",
  "reorder",
  "/api/whiteboard/notebooks",
  "panelOpen",
  "rotationX",
  "rotationY",
  "rotationZ",
  "plot3d",
  "parentId",
  "compileExpression",
  "Contenido dentro del elemento",
  'mode: "drag" | "resize" | "rotate"',
  'interaction.mode==="rotate"',
  "Arrastra para girar la figura o el gráfico",
  'data-shape-render="sphere-shell"',
  'data-graph-render="rotatable-3d"',
  'type AiVisualMode = "image" | "sticker"',
  'data-ai-visual-panel="compact"',
  "Imagen / Sticker IA",
  "Generar e insertar sticker",
  "transparentBackground: isSticker",
  "setAiPreview(imageUrl)",
]) check(page.includes(feature), `La pizarra digital no contiene: ${feature}`)

check(page.indexOf("topItems.map") >= 0 && page.indexOf("topItems.map") < page.indexOf("strokes.map((s)"), "Los trazos no se renderizan por encima de los objetos")
check(page.includes("useState(false), [zoom"), "El panel de herramientas no comienza cerrado")
check(page.includes('pointerEvents={interactive?"all":"none"}'), "Los objetos bloquean el dibujo cuando está activo el lápiz")
check(page.includes('onPointerDown={(e)=>beginItem(e,selected,"rotate")}'), "El botón Girar no inicia la rotación con el mouse")
check(page.includes("rotationX:original.rotationX-dy*.72"), "El arrastre vertical no modifica la rotación X")
check(page.includes("rotationY:original.rotationY+dx*.72"), "El arrastre horizontal no modifica la rotación Y")
check(!page.includes("Generar imagen para tus apuntes"), "El generador IA todavía usa el modal grande anterior")
check(!page.includes('setShowAi(true)} className="flex w-full'), "El botón antiguo del modal IA sigue presente")

for (const removedFeature of [
  "/api/whiteboard/recognize",
  "/api/whiteboard/solve",
  "MathRenderer",
  "segmentStrokes",
  "runMath(\"solve\")",
  "Editar LaTeX",
]) check(!page.includes(removedFeature), `La interfaz aún depende de la función retirada: ${removedFeature}`)

const notebooks = read("app/api/whiteboard/notebooks/route.ts")
check(notebooks.includes("whiteboard_notebooks"), "No existe persistencia de cuadernos")
check(notebooks.includes("whiteboard_pages"), "No existe persistencia de páginas")
check(notebooks.includes("blocks: Array.isArray(value.blocks)"), "La API no conserva objetos visuales del lienzo")

const proxy = read("proxy.ts")
check(proxy.includes('\"/pizarra-interactiva\"'), "La ruta de la pizarra no está protegida")

const migration = read("supabase/migrations/202607260004_whiteboard_math_studio.sql")
for (const table of ["whiteboard_notebooks", "whiteboard_pages"]) {
  check(migration.includes(table), `La migración no crea ${table}`)
}

if (failures.length) {
  console.error("\nEduAI Digital Whiteboard: FAILED")
  failures.forEach((failure) => console.error(` - ${failure}`))
  process.exit(1)
}

console.log(`EduAI Digital Whiteboard: OK (${requiredFiles.length} archivos y controles críticos validados)`)
