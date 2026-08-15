import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const routePath = path.join(root, "app", "api", "agents", "educador", "route.ts")

if (!fs.existsSync(routePath)) throw new Error(`No se encontró ${routePath}`)

let source = fs.readFileSync(routePath, "utf8")
let changed = false

function replaceRequired(oldText, newText, label) {
  if (source.includes(newText)) return
  if (!source.includes(oldText)) throw new Error(`[educador-ai-gateway] No se encontró ${label}`)
  source = source.replace(oldText, newText)
  changed = true
}

replaceRequired(
  'import { callAI, getEducadorModelStrategy } from "@/lib/ai-router-v4"',
  'import { getEducadorModelStrategy } from "@/lib/ai-router-v4"\nimport { runAIText } from "@/lib/ai/gateway"\nimport { assertAICapabilityAllowed } from "@/lib/ai/access-policy"',
  "import del router antiguo",
)

replaceRequired(
  '  const gKey = process.env.GEMINI_API_KEY\n  if (!gKey) return ""',
  '  const gKey = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY\n  if (!gKey) return ""',
  "API key de búsqueda docente",
)

replaceRequired(
  '`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gKey}`',
  '`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GOOGLE_TEXT_MODEL_PRIMARY || process.env.GEMINI_TEXT_MODEL_PRIMARY || "gemini-3.6-flash"}:generateContent?key=${gKey}`',
  "modelo de búsqueda web docente",
)

const authMarker = '  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })\n\n  const body = await req.json().catch(() => null)'
const authReplacement = `  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await assertAICapabilityAllowed(supabase, user.id, "text")
  } catch (error) {
    const typed = error instanceof Error ? error : new Error("Acceso restringido")
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) || 403 : 403
    const code = typeof error === "object" && error && "code" in error ? String(error.code || "EDUAI_ACCESS_RESTRICTED") : "EDUAI_ACCESS_RESTRICTED"
    return NextResponse.json({ error: typed.message, code }, { status })
  }

  const body = await req.json().catch(() => null)`
replaceRequired(authMarker, authReplacement, "guard de acceso docente")

const suggestionOld = `      const result = await callAI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          maxTokens: strategy.maxTokens,
          preferProvider: strategy.preferProvider,
          openrouterModel: strategy.openrouterModel,
        }
      )`
const suggestionNew = `      const suggestionAI = await runAIText({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        capability: "text",
        maxOutputTokens: strategy.maxTokens,
        context: {
          userId: user.id,
          module: "educador-parvularia-suggestion",
          reusePolicy: "exact_private",
          visibility: "private",
        },
        supabase,
      })
      const result = {
        text: suggestionAI.data,
        provider: suggestionAI.provider,
        model: suggestionAI.model,
        reused: suggestionAI.reused,
      }`
replaceRequired(suggestionOld, suggestionNew, "generación de sugerencias de parvularia")

const mainOld = `    let result = await callAI(aiMessages, {
      maxTokens: strategy.maxTokens,
      preferProvider: strategy.preferProvider,
      openrouterModel: strategy.openrouterModel,
    })`
const mainNew = `    const initialAI = await runAIText({
      messages: aiMessages,
      capability: !useCompactResourcePrompt && (sesiones > 1 || selectedOAIds.length > 1) ? "long_context" : "text",
      maxOutputTokens: strategy.maxTokens,
      context: {
        userId: user.id,
        module: \`educador-\${outputIntent}\`,
        reusePolicy: "exact_private",
        visibility: "private",
      },
      supabase,
    })
    let result = {
      text: initialAI.data,
      provider: initialAI.provider,
      model: initialAI.model,
      reused: initialAI.reused,
    }`
replaceRequired(mainOld, mainNew, "generación principal de Educador")

const repairOld = `      const repaired = await callAI([
        ...aiMessages,
        { role: "assistant" as const, content: truncateForPrompt(result.text, 2400) },
        { role: "user" as const, content: buildRepairInstruction(planningProfile, qualityAudit) },
      ], {
        maxTokens: strategy.maxTokens,
        preferProvider: strategy.preferProvider,
        openrouterModel: strategy.openrouterModel,
      })`
const repairNew = `      const repairedAI = await runAIText({
        messages: [
          ...aiMessages,
          { role: "assistant" as const, content: truncateForPrompt(result.text, 2400) },
          { role: "user" as const, content: buildRepairInstruction(planningProfile, qualityAudit) },
        ],
        capability: "long_context",
        maxOutputTokens: strategy.maxTokens,
        context: {
          userId: user.id,
          module: "educador-quality-repair",
          reusePolicy: "exact_private",
          visibility: "private",
        },
        supabase,
      })
      const repaired = {
        text: repairedAI.data,
        provider: repairedAI.provider,
        model: repairedAI.model,
        reused: repairedAI.reused,
      }`
replaceRequired(repairOld, repairNew, "reparación de calidad de Educador")

if (!source.includes("generationAvoided: Boolean(result.reused)")) {
  const responseMarker = `      compactPrompt: useCompactResourcePrompt,
      _design: designSummary,`
  if (!source.includes(responseMarker)) throw new Error("[educador-ai-gateway] No se encontró metadata de respuesta")
  source = source.replace(
    responseMarker,
    `      compactPrompt: useCompactResourcePrompt,
      reused: Boolean(result.reused),
      generationAvoided: Boolean(result.reused),
      _design: designSummary,`,
  )
  changed = true
}

if (changed) {
  fs.writeFileSync(routePath, source)
  console.log("[educador-ai-gateway] Educador conectado al AI Gateway")
} else {
  console.log("[educador-ai-gateway] Educador ya estaba conectado al AI Gateway")
}
