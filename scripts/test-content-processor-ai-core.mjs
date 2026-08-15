import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.join(root, "lib", "content-processor.ts")
const source = fs.readFileSync(target, "utf8")
const start = source.indexOf('export async function structureWithAI(')
const end = source.indexOf('// ============================================================\n// 6. PIPELINE PRINCIPAL', start)
if (start < 0 || end < 0) throw new Error("No se encontró structureWithAI")
const active = source.slice(start, end)

for (const [label, value] of [
  ["Google structured import", 'import { generateGoogleStructured } from "@/lib/ai/providers/google"'],
  ["structured call", "generateGoogleStructured<Record<string, unknown>>"],
  ["schema", "schema,"],
  ["Groq fallback", "callGroqFallback(systemPrompt, userPrompt)"],
  ["current processor comment", "Google structured API actual"],
]) {
  if (!source.includes(value)) throw new Error(`[test-content-ai-core] Falta ${label}: ${value}`)
}

for (const [label, value] of [
  ["Gemini 2.5 active call", "callGemini25(systemPrompt"],
  ["Gemini 2.0 active fallback", "callGemini20Fallback(systemPrompt"],
]) {
  if (active.includes(value)) throw new Error(`[test-content-ai-core] Sigue activo ${label}: ${value}`)
}

console.log("[test-content-ai-core] Creator Hub usa Google structured actual y Groq fallback")
