import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const exists = (file) => fs.existsSync(path.join(root, file))
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

const requiredFiles = [
  "app/api/process-content/route.ts",
  "app/api/creator/projects/route.ts",
  "app/api/creator/quality-review/route.ts",
  "app/api/creator/transform/route.ts",
  "app/api/creator/comics/storyboard/route.ts",
  "app/creator-hub/templates/page.tsx",
  "app/creator-hub/projects/[id]/page.tsx",
  "components/creator-hub/UniversalLayerEditor.tsx",
  "components/creator-hub/UniversalProjectEditor.tsx",
  "supabase/migrations/202607260001_creator_hub_foundation.sql",
]

for (const file of requiredFiles) check(exists(file), `Falta el archivo requerido: ${file}`)

const proxy = read("proxy.ts")
check(proxy.includes('pathname === "/api/process-content"'), "El proxy no protege /api/process-content")
check(proxy.includes("SPECIALIZED_PROJECT_EDITORS"), "El proxy no dirige proyectos al editor universal")

const processRoute = read("app/api/process-content/route.ts")
check(processRoute.includes("safeRemoteFetch"), "La generación por URL no usa protección SSRF")
check(processRoute.includes("MAX_REQUEST_BYTES"), "La generación no define límite de solicitud")
check(processRoute.includes("supabase.auth.getUser"), "La generación principal no verifica autenticación")

const templatesRoute = read("app/api/creative-templates/route.ts")
for (const mime of [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]) {
  check(templatesRoute.includes(mime), `La biblioteca de plantillas no contempla ${mime}`)
}

const projectStore = read("components/creator-hub/project-store.ts")
check(projectStore.includes("loadCloudCreatorHubProject"), "Los proyectos no se pueden reabrir desde la nube")
check(projectStore.includes("saveCreatorHubProjectVersion"), "No existe guardado de versiones")

const universal = read("components/creator-hub/UniversalLayerEditor.tsx")
for (const feature of ["hidden", "locked", "moveArrayItem", "prepareVisibleCreatorData"]) {
  check(universal.includes(feature), `El editor universal no contiene la función ${feature}`)
}

const comics = read("app/creator-hub/comics/page.tsx")
check(comics.includes("generateAllImages"), "Cómics no permite generar todas las imágenes")
check(comics.includes("visualDescription"), "Cómics no conserva ficha visual de personajes")
check(comics.includes("imagePrompt"), "Cómics no usa prompts por viñeta")

const palette = read("components/ui/ColorPalette.tsx")
check(palette.includes('type="color"'), "La paleta no incluye color personalizado")
check(palette.includes("onChange(palette.color)"), "Los botones de color no notifican el cambio")

if (failures.length) {
  console.error("\nCreator Hub integrity: FAILED")
  failures.forEach((failure) => console.error(` - ${failure}`))
  process.exit(1)
}

console.log(`Creator Hub integrity: OK (${requiredFiles.length} archivos y controles críticos validados)`)
