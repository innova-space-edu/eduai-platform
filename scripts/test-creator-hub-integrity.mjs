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
  "app/api/creator/comics/image/route.ts",
  "app/creator-hub/templates/page.tsx",
  "app/creator-hub/projects/[id]/page.tsx",
  "components/creator-hub/UniversalLayerEditor.tsx",
  "components/creator-hub/UniversalProjectEditor.tsx",
  "components/creator-hub/DirectVisualCanvasEditor.tsx",
  "components/creator-hub/CreatorCanvasDownloadBar.tsx",
  "components/creator-hub/comics/ComicsCreatorStudio.tsx",
  "components/creator-hub/comics/DialogueOverlay.tsx",
  "lib/creator-canvas.ts",
  "lib/creator-canvas-downloads.ts",
  "lib/creator-template-preview.ts",
  "supabase/migrations/202607260001_creator_hub_foundation.sql",
]

for (const file of requiredFiles) check(exists(file), `Falta el archivo requerido: ${file}`)

const proxy = read("proxy.ts")
check(proxy.includes('pathname === "/api/process-content"'), "El proxy no protege /api/process-content")
check(proxy.includes("SPECIALIZED_PROJECT_EDITORS"), "El proxy no dirige proyectos al editor universal")
check(proxy.includes('"/api/creator/comics/image"'), "El proxy no reserva capacidad para el lote de historietas")

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
check(templatesRoute.includes("renderCreatorTemplatePreview"), "Las plantillas no generan una vista visual utilizable")
check(templatesRoute.includes("preview_path"), "Las plantillas no guardan su fondo visual")

const projectStore = read("components/creator-hub/project-store.ts")
check(projectStore.includes("loadCloudCreatorHubProject"), "Los proyectos no se pueden reabrir desde la nube")
check(projectStore.includes("saveCreatorHubProjectVersion"), "No existe guardado de versiones")

const universal = read("components/creator-hub/UniversalLayerEditor.tsx")
for (const feature of ["hidden", "locked", "moveArrayItem", "prepareVisibleCreatorData"]) {
  check(universal.includes(feature), `El editor universal no contiene la función ${feature}`)
}

const directCanvas = read("components/creator-hub/DirectVisualCanvasEditor.tsx")
for (const feature of [
  "contentEditable",
  "startGesture",
  "createTextCanvasElement",
  "createShapeCanvasElement",
  "createImageCanvasElement",
  "showLayers",
  "showStyle",
  "fontFamily",
  "backgroundColor",
  "creator-canvas-surface",
]) {
  check(directCanvas.includes(feature), `El lienzo directo no contiene la función ${feature}`)
}

const visualCreator = read("components/creator-hub/EditableVisualCreatorPage.tsx")
check(visualCreator.includes("creator-hub:sidebar-mode"), "El editor visual no puede liberar el espacio del panel lateral")
check(visualCreator.includes("DirectVisualCanvasEditor"), "Infografías y presentaciones no usan el editor directo")
check(visualCreator.includes("applyCanvasTemplate"), "El editor visual no aplica la plantilla como fondo")

const canvasDownloads = read("lib/creator-canvas-downloads.ts")
check(canvasDownloads.includes("downloadCreatorCanvasAsPDF"), "El lienzo no se exporta a PDF")
check(canvasDownloads.includes("downloadCreatorCanvasAsPPTX"), "El lienzo no se exporta a PPTX")

const comicsPage = read("app/creator-hub/comics/page.tsx")
check(comicsPage.includes("ComicsCreatorStudio"), "La ruta de historietas no carga el estudio modular")

const comics = read("components/creator-hub/comics/ComicsCreatorStudio.tsx")
for (const feature of [
  "generateAllImages",
  "generateVisualBible",
  "castImageUrl",
  "referenceImageUrl",
  "identityLocked",
  "imageLocked",
  "imageDirty",
  "consistencyMode",
  "runPool",
  "worldContext",
  "autoCast",
  "allowExtras",
  "appearsAlways",
  "DialogueOverlay",
]) {
  check(comics.includes(feature), `Mangas e historietas no contiene la función ${feature}`)
}
check(!comics.includes('name: "Guía"'), "El editor todavía crea un Guía predeterminado")
check(comics.includes("maxLength={12000}"), "El contexto del mundo no admite textos extensos")

const dialogueOverlay = read("components/creator-hub/comics/DialogueOverlay.tsx")
for (const feature of ["splitByKnownSpeakers", "caption", "max-h-[37%]", "bubbleClass"]) {
  check(dialogueOverlay.includes(feature), `La distribución de diálogo no contiene ${feature}`)
}

const comicImageRoute = read("app/api/creator/comics/image/route.ts")
for (const feature of [
  "inlineData",
  "castPrompt",
  "individualCharacterPrompt",
  "panelPrompt",
  "preferredModel",
  "referenceCount",
  "generated-images",
  "worldContext",
  "allowExtras",
  "appearsAlways",
]) {
  check(comicImageRoute.includes(feature), `El motor de consistencia visual no contiene ${feature}`)
}
check(comicImageRoute.includes("allowedReferenceHost"), "Las referencias visuales remotas no están restringidas al almacenamiento propio")
check(comicImageRoute.includes("Do not add named characters"), "Las imágenes pueden inventar personajes principales")

const storyboard = read("app/api/creator/comics/storyboard/route.ts")
for (const feature of ["fixedTraits", "outfit", "prohibitedChanges", "characterNames", "styleDirection", "worldContext", "autoCast", "allowExtras", "finalCast"]) {
  check(storyboard.includes(feature), `El storyboard no entrega o respeta ${feature}`)
}
check(storyboard.includes("no crees automáticamente un guía"), "El storyboard no prohíbe el guía automático")
check(storyboard.includes("12000"), "El storyboard no conserva contexto largo")

const palette = read("components/ui/ColorPalette.tsx")
check(palette.includes('type="color"'), "La paleta no incluye color personalizado")
check(palette.includes("onChange(palette.color)"), "Los botones de color no notifican el cambio")
check(!palette.includes("#a855f7"), "La paleta aún contiene el violeta neón anterior")

if (failures.length) {
  console.error("\nCreator Hub integrity: FAILED")
  failures.forEach((failure) => console.error(` - ${failure}`))
  process.exit(1)
}

console.log(`Creator Hub integrity: OK (${requiredFiles.length} archivos y controles críticos validados)`)
