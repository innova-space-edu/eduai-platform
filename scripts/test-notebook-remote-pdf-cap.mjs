import fs from "node:fs"
import path from "node:path"

const source = fs.readFileSync(path.join(process.cwd(), "lib/notebook/ingestion-v2.ts"), "utf8")

function requireText(value, label) {
  if (!source.includes(value)) {
    throw new Error(`[test-notebook-remote-pdf-cap] Falta ${label}: ${value}`)
  }
}

requireText('import { fetchSafeRemoteBytes } from "@/lib/safe-remote-url"', "helper remoto compartido")
requireText("maxBytes: MAX_REMOTE_FILE_BYTES", "cap streaming de 20 MB")
requireText("timeoutMs: 25_000", "timeout de PDF remoto")
requireText('mimeType !== "application/pdf" && mimeType !== "application/octet-stream"', "validación MIME PDF")
requireText("if (response.body) await response.body.cancel().catch(() => undefined)", "cancelación del primer body antes de refetch seguro")
requireText("const pdfText = await extractRemotePdf(response.url || url)", "PDF web redirigido al camino capped")

if (source.includes("const arrayBuffer = await response.arrayBuffer()")) {
  throw new Error("[test-notebook-remote-pdf-cap] Sigue existiendo lectura completa no limitada de PDF remoto")
}

console.log("[test-notebook-remote-pdf-cap] PDFs externos de Notebook usan streaming cap antes del parser")
