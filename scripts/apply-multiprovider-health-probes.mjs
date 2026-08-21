import fs from "node:fs"
import path from "node:path"

const providerPath = path.join(process.cwd(), "lib/ai/providers/openai-compatible.ts")
const healthPath = path.join(process.cwd(), "app/api/admin/ai-core/health/route.ts")
const panelPath = path.join(process.cwd(), "components/admin/AICoreHealthPanel.tsx")

let providerSource = fs.readFileSync(providerPath, "utf8")
let healthSource = fs.readFileSync(healthPath, "utf8")
let panelSource = fs.readFileSync(panelPath, "utf8")
let changed = false

function replaceOnce(target, from, to, label) {
  let source = target === "provider" ? providerSource : target === "health" ? healthSource : panelSource
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`[multiprovider-health] marker not found: ${label}`)
  source = source.replace(from, to)
  if (target === "provider") providerSource = source
  else if (target === "health") healthSource = source
  else panelSource = source
  changed = true
}

replaceOnce(
  "provider",
  `    case "openrouter":\n      return process.env.OPENROUTER_API_KEY || null`,
  `    case "openrouter":\n      return process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_1 || process.env.OPENROUTER_API_KEY_2 || process.env.OPENROUTER_API_KEY_3 || null`,
  "OpenRouter key pool",
)

replaceOnce(
  "provider",
  `    case "together":\n      return process.env.TOGETHER_API_KEY || null`,
  `    case "together":\n      return process.env.TOGETHER_API_KEY || process.env.TOGETHER_API_KEY_1 || process.env.TOGETHER_API_KEY_2 || process.env.TOGETHER_API_KEY_3 || null`,
  "Together key pool",
)

if (!healthSource.includes('from "@/lib/ai/providers/openai-compatible"')) {
  const marker = 'import { resolveProviderModel } from "@/lib/ai/model-registry"\n'
  if (!healthSource.includes(marker)) throw new Error("[multiprovider-health] health import marker missing")
  healthSource = healthSource.replace(
    marker,
    `${marker}import { compatibleFallbackModel, generateCompatibleText, hasCompatibleProvider, type CompatibleProvider } from "@/lib/ai/providers/openai-compatible"\n`,
  )
  changed = true
}

if (!healthSource.includes("async function probeCompatibleProvider(")) {
  const marker = "export async function GET() {"
  const index = healthSource.indexOf(marker)
  if (index < 0) throw new Error("[multiprovider-health] GET marker missing")
  const helper = `async function probeCompatibleProvider(provider: CompatibleProvider) {\n  if (!hasCompatibleProvider(provider)) {\n    throw Object.assign(new Error(\`\${provider} no está configurado\`), { code: \`\${provider.toUpperCase()}_KEY_MISSING\` })\n  }\n\n  const admin = adminClient()\n  const fallbackModel = compatibleFallbackModel(provider, "text")\n  const selected = await resolveProviderModel({\n    supabase: admin,\n    provider,\n    capability: "text",\n    fallbackModel,\n  })\n\n  return generateCompatibleText({\n    provider,\n    model: selected.model,\n    messages: [{ role: "user", content: "Responde únicamente OK" }],\n    maxOutputTokens: 8,\n  })\n}\n\n`
  healthSource = healthSource.slice(0, index) + helper + healthSource.slice(index)
  changed = true
}

const postStart = healthSource.indexOf("export async function POST(req: NextRequest) {")
if (postStart < 0) throw new Error("[multiprovider-health] POST marker missing")
const newPost = `export async function POST(req: NextRequest) {\n  const user = await requireAdmin()\n  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })\n\n  const body = await req.json().catch(() => ({}))\n  const provider = String(body?.provider || "google").toLowerCase() as "google" | CompatibleProvider\n  const allowed = new Set(["google", "groq", "openrouter", "together", "cerebras"])\n  if (!allowed.has(provider)) {\n    return NextResponse.json({ error: "Proveedor no compatible con el health check manual" }, { status: 400 })\n  }\n\n  const startedAt = Date.now()\n  let status: "healthy" | "degraded" | "down" = "healthy"\n  let errorCode: string | null = null\n  let errorMessage: string | null = null\n  let model: string | null = null\n\n  try {\n    let text = ""\n    if (provider === "google") {\n      if (!hasGoogleAI("text")) {\n        throw Object.assign(new Error("GEMINI_API_KEY no configurada"), { code: "GOOGLE_KEY_MISSING" })\n      }\n      const baseConfig = configuration()\n      model = baseConfig.google.liteModel\n      text = await probeGoogleLite(model)\n    } else {\n      const result = await probeCompatibleProvider(provider)\n      model = result.model\n      text = result.text\n    }\n\n    if (!/ok/i.test(text)) status = "degraded"\n  } catch (error) {\n    status = "down"\n    errorCode = (error as { code?: string })?.code || \`\${provider.toUpperCase()}_HEALTH_FAILED\`\n    errorMessage = error instanceof Error ? error.message : String(error)\n  }\n\n  const latencyMs = Date.now() - startedAt\n  const admin = adminClient()\n  if (admin) {\n    const { error } = await admin.from("ai_provider_health").insert({\n      provider,\n      model,\n      capability: "text",\n      status,\n      latency_ms: latencyMs,\n      error_code: errorCode,\n      metadata: {\n        health_check: "manual",\n        ...(errorMessage ? { error: errorMessage.slice(0, 500) } : {}),\n      },\n      checked_at: new Date().toISOString(),\n    })\n    if (error && error.code !== "42P01") console.warn("[AI health]", error.message)\n  }\n\n  return NextResponse.json({\n    ok: status !== "down",\n    provider,\n    model,\n    status,\n    latencyMs,\n    error: errorMessage,\n  }, { status: status === "down" ? 503 : 200 })\n}\n`

if (!healthSource.includes('const allowed = new Set(["google", "groq", "openrouter", "together", "cerebras"])')) {
  healthSource = healthSource.slice(0, postStart) + newPost
  changed = true
}

if (!panelSource.includes("const [testingProvider, setTestingProvider]")) {
  replaceOnce(
    "panel",
    `  const [testingGoogle, setTestingGoogle] = useState(false)\n  const [googleResult, setGoogleResult] = useState<string | null>(null)`,
    `  const [testingProvider, setTestingProvider] = useState<string | null>(null)\n  const [providerResults, setProviderResults] = useState<Record<string, string>>({})`,
    "provider test state",
  )
}

const testFunctionStart = panelSource.indexOf("  const testGoogle = async () => {")
const returnStart = panelSource.indexOf("\n  return (", testFunctionStart)
if (testFunctionStart >= 0 && returnStart > testFunctionStart) {
  const genericTest = `  const testProvider = async (provider: "google" | "groq" | "openrouter" | "together" | "cerebras") => {\n    setTestingProvider(provider)\n    setProviderResults(current => ({ ...current, [provider]: "" }))\n    try {\n      const response = await fetch("/api/admin/ai-core/health", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ provider }),\n      })\n      const body = await response.json().catch(() => null)\n      if (!response.ok) throw new Error(body?.error || \`\${provider} no respondió\`)\n      setProviderResults(current => ({\n        ...current,\n        [provider]: \`\${provider} \${body.status} · \${body.model || "modelo"} · \${body.latencyMs ?? 0} ms\`,\n      }))\n    } catch (caught) {\n      setProviderResults(current => ({\n        ...current,\n        [provider]: caught instanceof Error ? caught.message : \`La prueba de \${provider} falló\`,\n      }))\n    } finally {\n      setTestingProvider(null)\n    }\n  }\n`
  panelSource = panelSource.slice(0, testFunctionStart) + genericTest + panelSource.slice(returnStart)
  changed = true
}

replaceOnce(
  "panel",
  `                onClick={() => void testGoogle()}\n                disabled={testingGoogle || !data.configuration.google.text}`,
  `                onClick={() => void testProvider("google")}\n                disabled={testingProvider !== null || !data.configuration.google.text}`,
  "Google health button handler",
)
replaceOnce(
  "panel",
  `{testingGoogle ? "Probando…" : "Probar Google"}`,
  `{testingProvider === "google" ? "Probando…" : "Probar Google"}`,
  "Google health button label",
)
replaceOnce(
  "panel",
  `{googleResult ? <p className="mt-2 text-xs text-slate-300">{googleResult}</p> : null}`,
  `{providerResults.google ? <p className="mt-2 text-xs text-slate-300">{providerResults.google}</p> : null}`,
  "Google health result",
)

const serviceMarker = `                <Status ok={data.configuration.video.cronSecret} label="Cron de video" />\n              </div>\n              <div className="mt-4 space-y-1 text-xs text-slate-400">`
if (!panelSource.includes("Probar Cerebras")) {
  if (!panelSource.includes(serviceMarker)) throw new Error("[multiprovider-health] service UI marker missing")
  const serviceProbes = `                <Status ok={data.configuration.video.cronSecret} label="Cron de video" />\n              </div>\n              <div className="mt-4 grid grid-cols-2 gap-2">\n                <button type="button" onClick={() => void testProvider("groq")} disabled={testingProvider !== null || !data.configuration.groq.configured} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] font-black text-slate-200 disabled:opacity-40">{testingProvider === "groq" ? "Probando…" : "Probar Groq"}</button>\n                <button type="button" onClick={() => void testProvider("openrouter")} disabled={testingProvider !== null || !data.configuration.openrouter.configured} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] font-black text-slate-200 disabled:opacity-40">{testingProvider === "openrouter" ? "Probando…" : "Probar OpenRouter"}</button>\n                <button type="button" onClick={() => void testProvider("together")} disabled={testingProvider !== null || !data.configuration.together.configured} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] font-black text-slate-200 disabled:opacity-40">{testingProvider === "together" ? "Probando…" : "Probar Together"}</button>\n                <button type="button" onClick={() => void testProvider("cerebras")} disabled={testingProvider !== null || !data.configuration.cerebras.configured} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] font-black text-slate-200 disabled:opacity-40">{testingProvider === "cerebras" ? "Probando…" : "Probar Cerebras"}</button>\n              </div>\n              {(["groq", "openrouter", "together", "cerebras"] as const).map(provider => providerResults[provider] ? (\n                <p key={provider} className="mt-2 text-[11px] text-slate-300">{providerResults[provider]}</p>\n              ) : null)}\n              <div className="mt-4 space-y-1 text-xs text-slate-400">`
  panelSource = panelSource.replace(serviceMarker, serviceProbes)
  changed = true
}

if (changed) {
  fs.writeFileSync(providerPath, providerSource)
  fs.writeFileSync(healthPath, healthSource)
  fs.writeFileSync(panelPath, panelSource)
  console.log("[multiprovider-health] key pools y health checks manuales multiproveedor aplicados")
} else {
  console.log("[multiprovider-health] already applied")
}
