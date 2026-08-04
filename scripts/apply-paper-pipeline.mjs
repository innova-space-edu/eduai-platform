import fs from "node:fs/promises"
import path from "node:path"

const extractionPath = path.join(process.cwd(), "lib/papers/extraction.ts")
const source = await fs.readFile(extractionPath, "utf8")

// El pipeline remoto reemplaza por completo ensurePaperProcessed.
// Cuando ya está presente no debemos intentar reaplicar el parche híbrido anterior.
if (!source.includes("const SERVER_BUFFER_MAX_MB")) {
  await import("./apply-paper-hybrid-parser.mjs")
}

await import("./apply-paper-large-remote.mjs")
console.log("[paper-pipeline] Integración PDF comprobada y lista.")
