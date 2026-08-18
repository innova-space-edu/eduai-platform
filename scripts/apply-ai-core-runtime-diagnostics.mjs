import fs from "node:fs"
import path from "node:path"

const healthPath = path.join(process.cwd(), "app/api/admin/ai-core/health/route.ts")
const panelPath = path.join(process.cwd(), "components/admin/AICoreHealthPanel.tsx")
let health = fs.readFileSync(healthPath, "utf8")
let panel = fs.readFileSync(panelPath, "utf8")
let changed = false

function hasAll(source, markers) {
  return markers.every((marker) => source.includes(marker))
}

function ensureReplacement(target, doneMarkers, from, to, label) {
  let source = target === "health" ? health : panel
  if (hasAll(source, doneMarkers)) return
  if (!source.includes(from)) {
    throw new Error(`[ai-core-runtime-diagnostics] marker not found: ${label}`)
  }
  source = source.replace(from, to)
  if (target === "health") health = source
  else panel = source
  changed = true
}

ensureReplacement(
  "health",
  [
    'projectConfigured: configured("GOOGLE_CLOUD_PROJECT")',
    'location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1"',
  ],
  `    },\n    groq: { configured: configured("GROQ_API_KEY") },`,
  `    },\n    vertex: {\n      enabled: process.env.GOOGLE_GENAI_USE_VERTEX === "true",\n      configured: process.env.GOOGLE_GENAI_USE_VERTEX === "true" && configured("GOOGLE_CLOUD_PROJECT"),\n      projectConfigured: configured("GOOGLE_CLOUD_PROJECT"),\n      location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1",\n    },\n    groq: { configured: configured("GROQ_API_KEY") },`,
  "Vertex runtime status",
)

ensureReplacement(
  "health",
  [
    'huggingface: { configured: configured("HF_TOKEN") || configured("HF_TOKEN_1") }',
    'pollinations: { configured: configured("POLLINATIONS_API_KEY") }',
    'byok: { masterKeyConfigured: configured("EDUAI_CREDENTIALS_MASTER_KEY") }',
  ],
  `    cerebras: { configured: configured("CEREBRAS_API_KEY") },\n    redis: {`,
  `    cerebras: { configured: configured("CEREBRAS_API_KEY") },\n    huggingface: { configured: configured("HF_TOKEN") || configured("HF_TOKEN_1") },\n    pollinations: { configured: configured("POLLINATIONS_API_KEY") },\n    byok: { masterKeyConfigured: configured("EDUAI_CREDENTIALS_MASTER_KEY") },\n    redis: {`,
  "provider and BYOK runtime status",
)

ensureReplacement(
  "health",
  [
    "wan: wanConfigured()",
    "hfGradio: hfGradioConfigured()",
    "hfSpace: hfLegacyConfigured()",
  ],
  `    video: {\n      google: googleVideoConfigured(),\n      fallback: wanConfigured() || hfGradioConfigured() || hfLegacyConfigured(),`,
  `    video: {\n      google: googleVideoConfigured(),\n      wan: wanConfigured(),\n      hfGradio: hfGradioConfigured(),\n      hfSpace: hfLegacyConfigured(),\n      fallback: wanConfigured() || hfGradioConfigured() || hfLegacyConfigured(),`,
  "video provider details",
)

ensureReplacement(
  "panel",
  [
    "vertex: { enabled: boolean; configured: boolean; projectConfigured: boolean; location: string }",
    "huggingface: { configured: boolean }",
    "pollinations: { configured: boolean }",
    "byok: { masterKeyConfigured: boolean }",
  ],
  `    groq: { configured: boolean }\n    openrouter: { configured: boolean }\n    together: { configured: boolean }\n    cerebras: { configured: boolean }\n    redis: { configured: boolean }`,
  `    vertex: { enabled: boolean; configured: boolean; projectConfigured: boolean; location: string }\n    groq: { configured: boolean }\n    openrouter: { configured: boolean }\n    together: { configured: boolean }\n    cerebras: { configured: boolean }\n    huggingface: { configured: boolean }\n    pollinations: { configured: boolean }\n    byok: { masterKeyConfigured: boolean }\n    redis: { configured: boolean }`,
  "health response provider types",
)

ensureReplacement(
  "panel",
  [
    "wan: boolean",
    "hfGradio: boolean",
    "hfSpace: boolean",
  ],
  `    video: {\n      google: boolean\n      fallback: boolean`,
  `    video: {\n      google: boolean\n      wan: boolean\n      hfGradio: boolean\n      hfSpace: boolean\n      fallback: boolean`,
  "video provider response types",
)

ensureReplacement(
  "panel",
  ["Vertex AI opcional apagado"],
  `                <Status ok={data.configuration.google.video} label="Video" />\n              </div>`,
  `                <Status ok={data.configuration.google.video} label="Video" />\n                <Status\n                  ok={!data.configuration.vertex.enabled || data.configuration.vertex.configured}\n                  label={data.configuration.vertex.enabled ? \`Vertex AI texto (\${data.configuration.vertex.location})\` : "Vertex AI opcional apagado"}\n                />\n              </div>`,
  "Vertex health UI",
)

ensureReplacement(
  "panel",
  [
    'label="Together"',
    'label="Cerebras"',
    'label="Hugging Face"',
    'label="Pollinations"',
    'label="BYOK master key"',
  ],
  `                <Status ok={data.configuration.groq.configured} label="Groq" />\n                <Status ok={data.configuration.openrouter.configured} label="OpenRouter" />\n                <Status ok={data.configuration.redis.configured} label="Redis / Upstash" />\n                <Status ok={data.configuration.video.cronSecret} label="Cron de video" />`,
  `                <Status ok={data.configuration.groq.configured} label="Groq" />\n                <Status ok={data.configuration.openrouter.configured} label="OpenRouter" />\n                <Status ok={data.configuration.together.configured} label="Together" />\n                <Status ok={data.configuration.cerebras.configured} label="Cerebras" />\n                <Status ok={data.configuration.huggingface.configured} label="Hugging Face" />\n                <Status ok={data.configuration.pollinations.configured} label="Pollinations" />\n                <Status ok={data.configuration.byok.masterKeyConfigured} label="BYOK master key" />\n                <Status ok={data.configuration.redis.configured} label="Redis / Upstash" />\n                <Status ok={data.configuration.video.cronSecret} label="Cron de video" />`,
  "service provider runtime UI",
)

ensureReplacement(
  "panel",
  ["WAN: {data.configuration.video.wan ? \"sí\" : \"no\"}"],
  `                <p>Orden efectivo de video: {data.configuration.video.providerOrder || "sin proveedores configurados"}</p>\n                <p className="text-[11px] text-slate-500">Configurado: {data.configuration.video.configuredProviderOrder}</p>`,
  `                <p>Orden efectivo de video: {data.configuration.video.providerOrder || "sin proveedores configurados"}</p>\n                <p>WAN: {data.configuration.video.wan ? "sí" : "no"} · HF Gradio: {data.configuration.video.hfGradio ? "sí" : "no"} · HF Space: {data.configuration.video.hfSpace ? "sí" : "no"} · Google: {data.configuration.video.google ? "sí" : "no"}</p>\n                <p className="text-[11px] text-slate-500">Configurado: {data.configuration.video.configuredProviderOrder}</p>`,
  "video runtime detail UI",
)

if (changed) {
  fs.writeFileSync(healthPath, health)
  fs.writeFileSync(panelPath, panel)
  console.log("[ai-core-runtime-diagnostics] Model Lab muestra estado runtime sin exponer secretos")
} else {
  console.log("[ai-core-runtime-diagnostics] already applied")
}
