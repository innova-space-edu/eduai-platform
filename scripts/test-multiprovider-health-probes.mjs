import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const applyPath = path.join(root, "scripts/apply-multiprovider-health-probes.mjs")
const providerPath = path.join(root, "lib/ai/providers/openai-compatible.ts")
const healthPath = path.join(root, "app/api/admin/ai-core/health/route.ts")
const panelPath = path.join(root, "components/admin/AICoreHealthPanel.tsx")

for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [applyPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) throw new Error(`[test-multiprovider-health] apply run ${i + 1} failed: ${run.stderr || run.stdout}`)
}

const provider = fs.readFileSync(providerPath, "utf8")
const health = fs.readFileSync(healthPath, "utf8")
const panel = fs.readFileSync(panelPath, "utf8")

for (const key of ["OPENROUTER_API_KEY_1", "OPENROUTER_API_KEY_2", "OPENROUTER_API_KEY_3", "TOGETHER_API_KEY_1", "TOGETHER_API_KEY_2", "TOGETHER_API_KEY_3"]) {
  if (!provider.includes(key)) throw new Error(`[test-multiprovider-health] key pool missing: ${key}`)
}
if (!health.includes("generateCompatibleText") || !health.includes("probeCompatibleProvider")) {
  throw new Error("[test-multiprovider-health] compatible provider probe missing")
}
if (!health.includes('const allowed = new Set(["google", "groq", "openrouter", "together", "cerebras"])')) {
  throw new Error("[test-multiprovider-health] manual provider allowlist missing")
}
if (!health.includes('health_check: "manual"')) {
  throw new Error("[test-multiprovider-health] manual health telemetry marker missing")
}
for (const label of ["Probar Groq", "Probar OpenRouter", "Probar Together", "Probar Cerebras"]) {
  if (!panel.includes(label)) throw new Error(`[test-multiprovider-health] Model Lab button missing: ${label}`)
}
if ((panel.split("const testProvider = async").length - 1) !== 1) {
  throw new Error("[test-multiprovider-health] provider tester must exist exactly once")
}

console.log("[test-multiprovider-health] OpenRouter/Together pools and manual provider probes are idempotent")
