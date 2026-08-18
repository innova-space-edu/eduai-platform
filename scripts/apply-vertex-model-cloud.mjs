import fs from "node:fs"
import path from "node:path"

const capabilitiesPath = path.join(process.cwd(), "lib/ai/capabilities.ts")
const gatewayPath = path.join(process.cwd(), "lib/ai/gateway.ts")
const testPath = path.join(process.cwd(), "scripts/test-ai-multiprovider.ts")
const healthPath = path.join(process.cwd(), "app/api/admin/ai-core/health/route.ts")
const panelPath = path.join(process.cwd(), "components/admin/AICoreHealthPanel.tsx")

let capabilities = fs.readFileSync(capabilitiesPath, "utf8")
let gateway = fs.readFileSync(gatewayPath, "utf8")
let tests = fs.readFileSync(testPath, "utf8")
let health = fs.readFileSync(healthPath, "utf8")
let panel = fs.readFileSync(panelPath, "utf8")
let changed = false

function replaceOnce(target, from, to, label) {
  let source = target === "capabilities" ? capabilities : target === "gateway" ? gateway : target === "tests" ? tests : target === "health" ? health : panel
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`[vertex-model-cloud] marker not found: ${label}`)
  source = source.replace(from, to)
  if (target === "capabilities") capabilities = source
  else if (target === "gateway") gateway = source
  else if (target === "tests") tests = source
  else if (target === "health") health = source
  else panel = source
  changed = true
}

replaceOnce("capabilities", '  | "google"\n  | "groq"', '  | "google"\n  | "vertex-model-cloud"\n  | "groq"', "provider type")
for (const [before, after, label] of [
  ['text: ["google", "groq", "openrouter", "cerebras", "together"]', 'text: ["google", "vertex-model-cloud", "groq", "openrouter", "cerebras", "together"]', "text order"],
  ['structured: ["google", "groq", "openrouter", "cerebras", "together"]', 'structured: ["google", "vertex-model-cloud", "groq", "openrouter", "cerebras", "together"]', "structured order"],
  ['long_context: ["google", "openrouter", "groq", "cerebras", "together"]', 'long_context: ["google", "vertex-model-cloud", "openrouter", "groq", "cerebras", "together"]', "long context order"],
  ['code: ["google", "groq", "cerebras", "openrouter", "together"]', 'code: ["google", "vertex-model-cloud", "groq", "cerebras", "openrouter", "together"]', "code order"],
]) replaceOnce("capabilities", before, after, label)
replaceOnce("capabilities", '  "google",\n  "groq",', '  "google",\n  "vertex-model-cloud",\n  "groq",', "provider set")

if (!gateway.includes('from "./providers/vertex-model-cloud"')) {
  const marker = '} from "./providers/google"\n'
  if (!gateway.includes(marker)) throw new Error("[vertex-model-cloud] Google provider import marker missing")
  gateway = gateway.replace(marker, `${marker}import { generateVertexModelCloudText, hasVertexModelCloud, vertexModelCloudModel } from "./providers/vertex-model-cloud"\n`)
  changed = true
}
replaceOnce(
  "gateway",
  '} else if (isCompatibleProviderId(input.provider)) {\n    fallbackModel = compatibleFallbackModel(input.provider, input.capability)',
  '} else if (input.provider === "vertex-model-cloud") {\n    fallbackModel = vertexModelCloudModel()\n  } else if (isCompatibleProviderId(input.provider)) {\n    fallbackModel = compatibleFallbackModel(input.provider, input.capability)',
  "runtime model fallback",
)
replaceOnce(
  "gateway",
  '  if (hasCompatibleProvider(input.provider)) {\n    const selected = await providerRuntimeModel({',
  '  if (input.provider === "vertex-model-cloud" && hasVertexModelCloud()) {\n    const selected = await providerRuntimeModel({\n      supabase: input.supabase,\n      provider: "vertex-model-cloud",\n      capability: input.capability,\n    })\n    if (!selected) return null\n    return generateVertexModelCloudText({\n      messages: input.messages,\n      model: selected.model,\n      maxOutputTokens: input.maxOutputTokens,\n    })\n  }\n\n  if (hasCompatibleProvider(input.provider)) {\n    const selected = await providerRuntimeModel({',
  "text executor",
)
replaceOnce(
  "gateway",
  '      } else if (hasCompatibleProvider(provider)) {\n        const selected = await providerRuntimeModel({',
  '      } else if (provider === "vertex-model-cloud" && hasVertexModelCloud()) {\n        const selected = await providerRuntimeModel({\n          supabase: input.supabase,\n          provider: "vertex-model-cloud",\n          capability,\n        })\n        if (selected) {\n          const response = await generateVertexModelCloudText({\n            messages: input.messages,\n            model: selected.model,\n            maxOutputTokens: input.maxOutputTokens,\n            structuredSchema: input.schema,\n          })\n          result = {\n            text: response.text,\n            data: parseStructuredJson<T>(response.text),\n            provider: response.provider,\n            model: response.model,\n          }\n        }\n      } else if (hasCompatibleProvider(provider)) {\n        const selected = await providerRuntimeModel({',
  "structured executor",
)

replaceOnce("tests", 'assert.deepEqual(providerOrderFor("text"), ["google", "groq", "openrouter", "cerebras", "together"])', 'assert.deepEqual(providerOrderFor("text"), ["google", "vertex-model-cloud", "groq", "openrouter", "cerebras", "together"])', "text test order")
replaceOnce("tests", 'assert.deepEqual(providerOrderFor("structured"), ["google", "groq", "openrouter", "cerebras", "together"])', 'assert.deepEqual(providerOrderFor("structured"), ["google", "vertex-model-cloud", "groq", "openrouter", "cerebras", "together"])', "structured test order")
replaceOnce("tests", 'assert.deepEqual(providerOrderFor("code"), ["google", "groq", "cerebras", "openrouter", "together"])', 'assert.deepEqual(providerOrderFor("code"), ["google", "vertex-model-cloud", "groq", "cerebras", "openrouter", "together"])', "code test order")
replaceOnce(
  "tests",
  '  assert.ok(source.includes("resolveProviderModel({"), "Gateway debe conservar el registro dinámico")',
  '  assert.ok(source.includes("resolveProviderModel({"), "Gateway debe conservar el registro dinámico")\n  assert.ok(source.includes("generateVertexModelCloudText"), "Gateway debe aceptar Vertex Model Cloud como fallback opcional")\n  assert.ok(source.includes("hasVertexModelCloud"), "Gateway debe saltar Model Cloud si OIDC/config no están listos")',
  "gateway test wiring",
)

if (!health.includes('from "@/lib/ai/providers/vertex-model-cloud"')) {
  const marker = 'import { compatibleFallbackModel, generateCompatibleText, hasCompatibleProvider, type CompatibleProvider } from "@/lib/ai/providers/openai-compatible"\n'
  if (!health.includes(marker)) throw new Error("[vertex-model-cloud] health compatible import marker missing")
  health = health.replace(marker, `${marker}import { generateVertexModelCloudText, hasVertexModelCloud, vertexModelCloudConfig } from "@/lib/ai/providers/vertex-model-cloud"\n`)
  changed = true
}
replaceOnce(
  "health",
  '    groq: { configured: configured("GROQ_API_KEY") },',
  '    modelCloud: {\n      enabled: process.env.VERTEX_MODEL_CLOUD_ENABLED === "true",\n      configured: hasVertexModelCloud(),\n      location: vertexModelCloudConfig().location,\n      protocol: vertexModelCloudConfig().protocol,\n      endpointConfigured: configured("VERTEX_MODEL_CLOUD_ENDPOINT_ID"),\n      oidcConfigured: configured("GCP_PROJECT_NUMBER") && configured("GCP_SERVICE_ACCOUNT_EMAIL") && configured("GCP_WORKLOAD_IDENTITY_POOL_ID") && configured("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID"),\n    },\n    groq: { configured: configured("GROQ_API_KEY") },',
  "health configuration",
)
replaceOnce(
  "health",
  'const provider = String(body?.provider || "google").toLowerCase() as "google" | CompatibleProvider',
  'const provider = String(body?.provider || "google").toLowerCase() as "google" | "vertex-model-cloud" | CompatibleProvider',
  "manual health provider type",
)
replaceOnce(
  "health",
  'const allowed = new Set(["google", "groq", "openrouter", "together", "cerebras"])',
  'const allowed = new Set(["google", "vertex-model-cloud", "groq", "openrouter", "together", "cerebras"])',
  "manual health allowlist",
)
replaceOnce(
  "health",
  '    if (provider === "google") {\n      if (!hasGoogleAI("text")) {',
  '    if (provider === "vertex-model-cloud") {\n      if (!hasVertexModelCloud()) {\n        throw Object.assign(new Error("Vertex Model Cloud no está configurado"), { code: "VERTEX_MODEL_CLOUD_NOT_CONFIGURED" })\n      }\n      const result = await generateVertexModelCloudText({\n        messages: [{ role: "user", content: "Responde únicamente OK" }],\n        maxOutputTokens: 8,\n      })\n      model = result.model\n      text = result.text\n    } else if (provider === "google") {\n      if (!hasGoogleAI("text")) {',
  "manual Model Cloud probe",
)

replaceOnce(
  "panel",
  '    groq: { configured: boolean }\n    openrouter: { configured: boolean }',
  '    modelCloud: { enabled: boolean; configured: boolean; location: string; protocol: string; endpointConfigured: boolean; oidcConfigured: boolean }\n    groq: { configured: boolean }\n    openrouter: { configured: boolean }',
  "panel config type",
)
replaceOnce(
  "panel",
  '  const testProvider = async (provider: "google" | "groq" | "openrouter" | "together" | "cerebras") => {',
  '  const testProvider = async (provider: "google" | "vertex-model-cloud" | "groq" | "openrouter" | "together" | "cerebras") => {',
  "panel test provider type",
)
replaceOnce(
  "panel",
  '{providerResults.google ? <p className="mt-2 text-xs text-slate-300">{providerResults.google}</p> : null}',
  '{providerResults.google ? <p className="mt-2 text-xs text-slate-300">{providerResults.google}</p> : null}\n              <div className="mt-3 rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-3 text-xs text-slate-300">\n                <p className="font-black text-cyan-100">EduAI Model Cloud · Vertex</p>\n                <p className="mt-1">{data.configuration.modelCloud.enabled ? (data.configuration.modelCloud.configured ? `Configurado · ${data.configuration.modelCloud.location} · ${data.configuration.modelCloud.protocol}` : "Activado pero incompleto") : "Opcional · apagado"}</p>\n                <button type="button" onClick={() => void testProvider("vertex-model-cloud")} disabled={testingProvider !== null || !data.configuration.modelCloud.configured} className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black text-cyan-100 disabled:opacity-40">{testingProvider === "vertex-model-cloud" ? "Probando…" : "Probar Model Cloud"}</button>\n                {providerResults["vertex-model-cloud"] ? <p className="mt-2 text-[11px] text-slate-300">{providerResults["vertex-model-cloud"]}</p> : null}\n              </div>',
  "Model Cloud panel",
)

if (changed) {
  fs.writeFileSync(capabilitiesPath, capabilities)
  fs.writeFileSync(gatewayPath, gateway)
  fs.writeFileSync(testPath, tests)
  fs.writeFileSync(healthPath, health)
  fs.writeFileSync(panelPath, panel)
  console.log("[vertex-model-cloud] Vertex custom endpoints + Vercel OIDC conectados como fallback opcional")
} else {
  console.log("[vertex-model-cloud] already applied")
}
