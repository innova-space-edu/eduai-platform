import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const extractionPath = path.join(root, "lib/papers/extraction.ts")
const healthRoutePath = path.join(root, "app/api/agents/paper/parser-health/route.ts")
const paperPages = [
  path.join(root, "app/paper/page.tsx"),
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
console.log("[paper-pipeline] Integración PDF comprobada sin endpoints adicionales.")
