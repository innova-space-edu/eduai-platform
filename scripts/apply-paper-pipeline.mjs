import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const extractionPath = path.join(root, "lib/papers/extraction.ts")
const healthRoutePath = path.join(root, "app/api/agents/paper/parser-health/route.ts")
const legacyUploadRoutePath = path.join(root, "app/api/agents/paper/upload/route.ts")
const paperRoutePaths = [
  path.join(root, "app/api/agents/paper/route.ts"),
  path.join(root, "app/api/agents/paper/extract/route.ts"),
]
const paperPagePath = path.join(root, "app/paper/page.tsx")
const paperPages = [
  paperPagePath,
  path.join(root, "app/paper-large/page.tsx"),
]

async function removeWarmupCode() {
  for (const filePath of paperPages) {
    let source = await fs.readFile(filePath, "utf8")
    source = source.replace(
      /\n\s*\/\/ Activa el Space durante la subida[^\n]*\n\s*void fetch\("\/api\/agents\/paper\/parser-health", \{ cache: "no-store" \}\)\.catch\(\(\) => \{\}\)/g,
      "",
    )
    await fs.writeFile(filePath, source)
  }
}

async function removeTemporaryHealthRoute() {
  await fs.rm(healthRoutePath, { force: true })
  try {
    await fs.rmdir(path.dirname(healthRoutePath))
  } catch {
    // La carpeta puede contener otros archivos o ya no existir.
  }
}

async function consolidateUploadFlow() {
  let source = await fs.readFile(paperPagePath, "utf8")

  const fallbackPattern = /\n\s*} else if \(\[400, 401, 413\]\.includes\(signedRes\.status\)\) \{\n\s*throw new Error\(await readErrorResponse\(signedRes\)\)\n\s*} else \{\n\s*\/\/ Fallback:[\s\S]*?uploadData = await uploadRes\.json\(\)\n\s*}/

  source = source.replace(
    fallbackPattern,
    `
      } else {
        throw new Error(await readErrorResponse(signedRes))
      }`,
  )

  await fs.writeFile(paperPagePath, source)
  await fs.rm(legacyUploadRoutePath, { force: true })
  try {
    await fs.rmdir(path.dirname(legacyUploadRoutePath))
  } catch {
    // upload-url y extract permanecen en esta carpeta.
  }
}

async function ensureNativeTextFallback() {
  let source = await fs.readFile(extractionPath, "utf8")
  source = source.replaceAll(
    `  if (!inspector.available) {
    localCandidate = await extractTextWithPdfParse(buffer)
  }`,
    `  if (!inspector.available || (!inspector.success && inspector.pdfType === "TextBased")) {
    localCandidate = await extractTextWithPdfParse(buffer)
  }`,
  )
  await fs.writeFile(extractionPath, source)
}

async function normalizePaperRouteDurations() {
  for (const filePath of paperRoutePaths) {
    let source = await fs.readFile(filePath, "utf8")
    source = source.replace(
      /export const maxDuration = \d+/,
      "export const maxDuration = 60",
    )
    await fs.writeFile(filePath, source)
  }
}

const source = await fs.readFile(extractionPath, "utf8")
const remoteAlreadyApplied = source.includes("const SERVER_BUFFER_MAX_MB")

if (!remoteAlreadyApplied) {
  await import("./apply-paper-hybrid-parser.mjs")

  // Compatibilidad temporal con el script histórico. Se elimina antes de Next build
  // para no consumir una función adicional en Vercel Hobby.
  await fs.mkdir(path.dirname(healthRoutePath), { recursive: true })
  await fs.writeFile(
    healthRoutePath,
    'export const runtime = "nodejs"\nexport async function GET() { return Response.json({ ok: true }) }\n',
  )

  await import("./apply-paper-large-remote.mjs")
}

await removeWarmupCode()
await removeTemporaryHealthRoute()
await consolidateUploadFlow()
await ensureNativeTextFallback()
await normalizePaperRouteDurations()
await import("./test-paper-pipeline.mjs")
console.log("[paper-pipeline] PDF listo en el bundle compartido de Vercel Hobby.")
