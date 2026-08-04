import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function assert(condition, message) {
  if (!condition) throw new Error(`[test-paper-pipeline] ${message}`)
}

const extraction = read("lib/papers/extraction.ts")
const parserClient = read("lib/papers/parser-client.ts")
const inspector = read("lib/papers/pdf-inspector.ts")
const paperPage = read("app/paper/page.tsx")
const historyPanel = read("components/paper/PaperHistoryPanel.tsx")
const largePage = read("app/paper-large/page.tsx")
const extractRoute = read("app/api/agents/paper/extract/route.ts")
const chatRoute = read("app/api/agents/paper/route.ts")
const parserApp = read("services/paper-parser/app.py")
const packageJson = JSON.parse(read("package.json"))

assert(
  packageJson.dependencies?.["@firecrawl/pdf-inspector"],
  "Falta @firecrawl/pdf-inspector en dependencies.",
)
assert(
  extraction.includes("extractWithPdfInspector"),
  "La extracción no importa pdf-inspector.",
)
assert(
  extraction.includes("const SERVER_BUFFER_MAX_MB"),
  "No está aplicado el modo remoto para PDF grandes.",
)
assert(
  extraction.includes("createSignedUrl(filePath"),
  "El pipeline no crea URL firmada para el parser remoto.",
)
assert(
  extraction.includes("sourceFileSizeBytes > 0 && sourceFileSizeBytes <= serverBufferMaxBytes"),
  "Los PDF de tamaño desconocido podrían descargarse dentro de Vercel.",
)
assert(
  extraction.includes('inspector.pdfType === "TextBased"'),
  "Falta el respaldo local para builds de clasificación solamente.",
)
assert(
  extraction.includes("if (!forceRefresh)") && extraction.includes("fromCache: true"),
  "El pipeline no reutiliza documentos procesados desde la caché.",
)
assert(
  inspector.includes("extractionAvailable"),
  "pdf-inspector no distingue clasificación de extracción completa.",
)
assert(
  parserClient.includes("EXTERNAL_PARSER_BUDGET_MS = 52_000"),
  "El cliente externo no respeta el presupuesto de Hobby.",
)
assert(
  parserClient.includes("source_url"),
  "El cliente del parser no admite URL firmada.",
)
assert(
  paperPage.includes("uploadPdfResumable"),
  "Chat Paper no usa carga TUS reanudable.",
)
assert(
  paperPage.includes("PdfPreview"),
  "Chat Paper no incluye la vista previa bajo demanda.",
)
assert(
  paperPage.includes("PaperHistoryPanel") && paperPage.includes("historyOpen"),
  "Chat Paper no incluye el panel lateral de materiales guardados.",
)
assert(
  paperPage.includes("handleOpenHistoryItem") && paperPage.includes("forceRefresh: false"),
  "El historial no abre materiales usando la caché existente.",
)
assert(
  historyPanel.includes("fixed inset-y-0 left-0") && historyPanel.includes("Más nuevos primero"),
  "El historial no está implementado como panel lateral izquierdo ordenado por novedad.",
)
assert(
  historyPanel.includes("Listo · caché") && historyPanel.includes("Reutiliza el análisis guardado"),
  "El historial no informa la reutilización de la caché.",
)
assert(
  paperPage.includes('action: "prepare-upload"'),
  "Chat Paper no solicita la preparación de subida consolidada.",
)
assert(
  paperPage.includes('fetch("/api/agents/paper/extract"'),
  "Chat Paper no usa la función consolidada de Paper.",
)
assert(
  !paperPage.includes("/api/agents/paper/upload-url"),
  "Chat Paper todavía referencia upload-url.",
)
assert(
  !paperPage.includes('/api/agents/paper/upload"'),
  "Chat Paper todavía referencia la subida multipart antigua.",
)
assert(
  largePage.includes("uploadPdfResumable"),
  "La página de PDF grandes no usa TUS.",
)
assert(
  largePage.includes('action: "prepare-upload"'),
  "La página de PDF grandes no usa la preparación consolidada.",
)
assert(
  extractRoute.includes("export async function GET()") && extractRoute.includes("newestFirst: true"),
  "La ruta consolidada no entrega el historial ordenado desde el más nuevo.",
)
assert(
  extractRoute.includes("paper_documents") && extractRoute.includes("storedFiles"),
  "El historial no combina Storage con la caché de documentos.",
)
assert(
  extractRoute.includes('body?.action === "prepare-upload"'),
  "La ruta extract no procesa la preparación de subida.",
)
assert(
  extractRoute.includes("createSignedUploadUrl"),
  "La ruta extract no crea la URL de subida segura.",
)
assert(
  extractRoute.includes("updateBucket"),
  "La ruta extract no actualiza el límite de un bucket papers existente.",
)
assert(
  extractRoute.includes("fileSizeLimit: MAX_PDF_SIZE_BYTES"),
  "El bucket papers no usa el límite configurado por Chat Paper.",
)
assert(
  extractRoute.includes("export const maxDuration = 60"),
  "La ruta extract no está en el bundle compartido de 60 segundos.",
)
assert(
  chatRoute.includes("export const maxDuration = 60"),
  "La ruta principal de Paper no está en el bundle compartido.",
)
assert(
  !exists("app/api/agents/paper/parser-health/route.ts"),
  "La ruta parser-health redundante volvió a aparecer.",
)
assert(
  !exists("app/api/agents/paper/upload/route.ts"),
  "La ruta multipart antigua volvió a aparecer.",
)
assert(
  !exists("app/api/agents/paper/upload-url/route.ts"),
  "La ruta upload-url redundante volvió a aparecer.",
)
assert(
  parserApp.includes("source_url: str | None"),
  "El Space no acepta source_url.",
)
assert(
  parserApp.includes("follow_redirects=False"),
  "El Space permite redirecciones remotas inseguras.",
)
assert(
  parserApp.includes("_validate_pdf_signature"),
  "El Space no valida la firma PDF.",
)

console.log("[test-paper-pipeline] Pipeline PDF híbrido, historial y caché verificados correctamente.")
