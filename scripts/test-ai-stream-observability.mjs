import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const gateway = fs.readFileSync(path.join(root, "lib", "ai", "gateway.ts"), "utf8")
const start = gateway.indexOf("export async function streamAIText(")
const end = gateway.indexOf("export async function runGoogleImage(", start)
if (start < 0 || end <= start) throw new Error("No se encontró streamAIText")
const stream = gateway.slice(start, end)

for (const [label, value] of [
  ["marker", "[AI_STREAM_OBSERVABILITY_V1]"],
  ["fingerprint", "generationFingerprint({"],
  ["reuse lookup", "lookupReuse({"],
  ["request start", "recordGenerationStart({"],
  ["reuse status", 'status: "reused"'],
  ["completion", 'status: "completed"'],
  ["failure", 'status: "failed"'],
  ["persistent save", "saveReusableGeneration({"],
  ["no-cache chat guard", 'reusePolicy !== "never"'],
]) {
  if (!stream.includes(value)) throw new Error(`[test-ai-stream] Falta ${label}: ${value}`)
}

console.log("[test-ai-stream] streaming registra consumo y reutiliza cuando la política lo permite")
