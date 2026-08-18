import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

// El flujo real ejecuta este parche varias veces (gate AI Core + npm build).
// Ejecutarlo nuevamente aquí convierte la idempotencia en una regresión testeada.
execFileSync(process.execPath, ["scripts/apply-notebook-ingestion-fix.mjs"], {
  cwd: process.cwd(),
  stdio: "pipe",
})

const source = fs.readFileSync(path.join(process.cwd(), "lib/notebook/ingestion-v2.ts"), "utf8")

function requireText(value, label) {
  if (!source.includes(value)) {
    throw new Error(`[test-notebook-remote-pdf-cap] Falta ${label}: ${value}`)
  }
}

const importText = 'import { fetchSafeRemoteBytes } from "@/lib/safe-remote-url"'
const importCount = source.split(importText).length - 1
if (importCount !== 1) {
  throw new Error(`[test-notebook-remote-pdf-cap] El parche debe ser idempotente; imports encontrados: ${importCount}`)
}

requireText(importText, "helper remoto compartido")
requireText("maxBytes: MAX_REMOTE_FILE_BYTES", "cap streaming de 20 MB")
requireText("timeoutMs: 25_000", "timeout de PDF remoto")
requireText('mimeType !== "application/pdf" && mimeType !== "application/octet-stream"', "validación MIME PDF")
requireText("if (response.body) await response.body.cancel().catch(() => undefined)", "cancelación del primer body antes de refetch seguro")
requireText("const pdfText = await extractRemotePdf(response.url || url)", "PDF web redirigido al camino capped")

if (source.includes("const arrayBuffer = await response.arrayBuffer()")) {
  throw new Error("[test-notebook-remote-pdf-cap] Sigue existiendo lectura completa no limitada de PDF remoto")
}

console.log("[test-notebook-remote-pdf-cap] PDF remoto con cap streaming e idempotencia verificados")
