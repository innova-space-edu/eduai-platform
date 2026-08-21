import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const routePath = path.join(root, "app", "api", "agents", "educador", "route.ts")
const source = fs.readFileSync(routePath, "utf8")

function requireText(value, label) {
  if (!source.includes(value)) throw new Error(`Falta ${label}: ${value}`)
}

function forbidText(value, label) {
  if (source.includes(value)) throw new Error(`Sigue presente ${label}: ${value}`)
}

requireText('import { runAIText } from "@/lib/ai/gateway"', "AI Gateway")
requireText('import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"', "policy guard")
requireText('await assertAICapabilityAllowed({', "invocación tipada del policy guard")
requireText('userId: user.id,', "usuario del policy guard")
requireText('capability: "text",', "capacidad del policy guard")
requireText('module: "educador-parvularia-suggestion"', "reuse sugerencias parvularia")
requireText('module: `educador-${outputIntent}`', "reuse generación principal")
requireText('module: "educador-quality-repair"', "reuse reparación")
requireText('generationAvoided: Boolean(result.reused)', "metadata de ahorro")
requireText('process.env.GOOGLE_TEXT_MODEL_PRIMARY', "modelo Google configurable")
forbidText('assertAICapabilityAllowed(supabase, user.id, "text")', "firma legacy incorrecta del policy guard")
forbidText('import { callAI, getEducadorModelStrategy } from "@/lib/ai-router-v4"', "import legacy callAI")
forbidText('let result = await callAI(aiMessages', "generación principal legacy")
forbidText('const repaired = await callAI([', "reparación legacy")

console.log("[test-educador-ai-gateway] Educador usa AI Gateway, policy tipada, permisos y reutilización")
