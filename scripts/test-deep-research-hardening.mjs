import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const applyPath = path.join(root, "scripts/apply-deep-research-hardening.mjs")
const routePath = path.join(root, "app/api/work/deep-research/route.ts")

for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [applyPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) throw new Error(`[test-deep-research-hardening] apply run ${i + 1} failed: ${run.stderr || run.stdout}`)
}

const source = fs.readFileSync(routePath, "utf8")
const count = (needle) => source.split(needle).length - 1

if (count("let requestSupabase: Awaited<ReturnType<typeof createClient>> | null = null") !== 1) {
  throw new Error("[test-deep-research-hardening] POST recovery client missing or duplicated")
}
if (!source.includes("startFailed: true") || !source.includes("finalizationFailed: true")) {
  throw new Error("[test-deep-research-hardening] generation request failure closure missing")
}
if (!source.includes("const completedText = interaction.text.trim()") || !source.includes("emptyResult: true")) {
  throw new Error("[test-deep-research-hardening] empty result must fail before finalizing")
}
if (source.indexOf("const completedText = interaction.text.trim()") > source.indexOf('status: "finalizing"')) {
  throw new Error("[test-deep-research-hardening] completed text validation must happen before finalizing claim")
}
if (!source.includes('.in("status", ["queued", "running", "finalizing"])')) {
  throw new Error("[test-deep-research-hardening] finalizing recovery transition missing")
}

console.log("[test-deep-research-hardening] start/finalization failures cannot leave running/finalizing jobs; patch idempotent")
