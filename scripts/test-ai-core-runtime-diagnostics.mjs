import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const applyPath = path.join(root, "scripts/apply-ai-core-runtime-diagnostics.mjs")
const healthPath = path.join(root, "app/api/admin/ai-core/health/route.ts")
const panelPath = path.join(root, "components/admin/AICoreHealthPanel.tsx")

for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [applyPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) throw new Error(`[test-ai-core-runtime-diagnostics] apply run ${i + 1} failed: ${run.stderr || run.stdout}`)
}

const health = fs.readFileSync(healthPath, "utf8")
const panel = fs.readFileSync(panelPath, "utf8")
const count = (source, needle) => source.split(needle).length - 1

if (count(health, "projectConfigured: configured(\"GOOGLE_CLOUD_PROJECT\")") !== 1) {
  throw new Error("[test-ai-core-runtime-diagnostics] Vertex status missing or duplicated")
}
if (!health.includes('byok: { masterKeyConfigured: configured("EDUAI_CREDENTIALS_MASTER_KEY") }')) {
  throw new Error("[test-ai-core-runtime-diagnostics] BYOK master key status missing")
}
for (const marker of ["wan: wanConfigured()", "hfGradio: hfGradioConfigured()", "hfSpace: hfLegacyConfigured()"] ) {
  if (!health.includes(marker)) throw new Error(`[test-ai-core-runtime-diagnostics] missing video marker: ${marker}`)
}
if (!health.includes('huggingface: { configured: configured("HF_TOKEN") || configured("HF_TOKEN_1") }')) {
  throw new Error("[test-ai-core-runtime-diagnostics] Hugging Face runtime status missing")
}
if (!health.includes('pollinations: { configured: configured("POLLINATIONS_API_KEY") }')) {
  throw new Error("[test-ai-core-runtime-diagnostics] Pollinations runtime status missing")
}
if (!panel.includes("BYOK master key") || !panel.includes("Vertex AI opcional apagado") || !panel.includes("HF Gradio")) {
  throw new Error("[test-ai-core-runtime-diagnostics] Model Lab UI does not surface the new diagnostics")
}
if (/process\.env\.(?:GROQ|OPENROUTER|TOGETHER|CEREBRAS|HF_TOKEN|POLLINATIONS|EDUAI_CREDENTIALS_MASTER_KEY)[A-Z0-9_]*\s*[,}]/.test(health)) {
  throw new Error("[test-ai-core-runtime-diagnostics] a secret environment value appears to be returned directly")
}

console.log("[test-ai-core-runtime-diagnostics] runtime provider diagnostics are admin-only booleans and idempotent")
