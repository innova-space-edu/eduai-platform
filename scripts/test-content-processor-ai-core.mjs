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

for (const [label, value] of [
  ["remote streaming helper", 'import { fetchSafeRemoteBytes } from "@/lib/safe-remote-url"'],
  ["remote cap", "maxBytes: 2_000_000"],
  ["Groq configured gate", "const groqConfigured = Boolean(process.env.GROQ_API_KEY?.trim())"],
  ["Google or Groq gate", "if (!geminiKey && !groqConfigured)"],
]) {
  if (!route.includes(value)) throw new Error(`[test-content-ai-core] Falta ${label}: ${value}`)
}

if (route.includes('if (!geminiKey) return NextResponse.json')) {
  throw new Error("[test-content-ai-core] process-content todavía exige Gemini antes del fallback Groq")
}

const extractStart = route.indexOf('async function extractSafeUrl(url: string) {')
const extractEnd = route.indexOf('\nasync function getCustomTemplate(', extractStart)
const extractBlock = route.slice(extractStart, extractEnd)
if (extractBlock.includes("response.text()")) {
  throw new Error("[test-content-ai-core] Creator no debe cargar HTML remoto completo antes del límite")
}

console.log("[test-content-ai-core] Creator usa Google/Groq y descarga web limitada sin Gemini obligatorio")
