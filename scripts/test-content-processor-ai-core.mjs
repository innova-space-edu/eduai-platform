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
const route = fs.readFileSync(path.join(root, "app", "api", "process-content", "route.ts"), "utf8")

for (const [label, value] of [
  ["Gateway import", 'import { runAIStructured } from "@/lib/ai/gateway"'],
  ["structured Gateway call", "runAIStructured<Record<string, unknown>>"],
  ["schema", "schema,"],
  ["provider result", "provider: result.provider"],
  ["model result", "model: result.model"],
  ["current processor comment", "EduAI AI Gateway multiproveedor"],
]) {
  if (!source.includes(value)) throw new Error(`[test-content-ai-core] Falta ${label}: ${value}`)
}

for (const [label, value] of [
  ["Gemini 2.5 active call", "callGemini25(systemPrompt"],
  ["Gemini 2.0 active fallback", "callGemini20Fallback(systemPrompt"],
  ["Groq private fallback", "callGroqFallback(systemPrompt, userPrompt)"],
  ["Google private structured", "generateGoogleStructured<Record<string, unknown>>"],
]) {
  if (active.includes(value)) throw new Error(`[test-content-ai-core] Sigue activo ${label}: ${value}`)
}

for (const [label, value] of [
  ["remote streaming helper", 'import { fetchSafeRemoteBytes } from "@/lib/safe-remote-url"'],
  ["remote cap", "maxBytes: 2_000_000"],
  ["legacy api compatibility", 'const geminiKey = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || ""'],
]) {
  if (!route.includes(value)) throw new Error(`[test-content-ai-core] Falta ${label}: ${value}`)
}

if (route.includes('if (!geminiKey) return NextResponse.json')) {
  throw new Error("[test-content-ai-core] process-content todavía exige Gemini antes del AI Gateway")
}
if (route.includes("const groqConfigured =")) {
  throw new Error("[test-content-ai-core] process-content mantiene un gate especial Google/Groq fuera del Gateway")
}

const extractStart = route.indexOf('async function extractSafeUrl(url: string) {')
const extractEnd = route.indexOf('\nasync function getCustomTemplate(', extractStart)
const extractBlock = route.slice(extractStart, extractEnd)
if (extractBlock.includes("response.text()")) {
  throw new Error("[test-content-ai-core] Creator no debe cargar HTML remoto completo antes del límite")
}

console.log("[test-content-ai-core] Creator usa AI Gateway estructurado y descarga web limitada")
