import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const fixPath = path.join(root, "scripts/fix-multiprovider-health-types.mjs")
const healthPath = path.join(root, "app/api/admin/ai-core/health/route.ts")

for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [fixPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) throw new Error(`[test-multiprovider-health-types] fix run ${i + 1} failed: ${run.stderr || run.stdout}`)
}

const source = fs.readFileSync(healthPath, "utf8")
if (source.includes('${provider.toUpperCase()}_KEY_MISSING')) {
  throw new Error("[test-multiprovider-health-types] unsafe never narrowing remains")
}
if (!source.includes('${String(provider).toUpperCase()}_KEY_MISSING')) {
  throw new Error("[test-multiprovider-health-types] safe provider error code missing")
}
for (const key of ["OPENROUTER_API_KEY_2", "OPENROUTER_API_KEY_3", "TOGETHER_API_KEY_2", "TOGETHER_API_KEY_3"]) {
  if (!source.includes(key)) throw new Error(`[test-multiprovider-health-types] runtime diagnostic key missing: ${key}`)
}

console.log("[test-multiprovider-health-types] health probe typing and pool diagnostics are idempotent")
