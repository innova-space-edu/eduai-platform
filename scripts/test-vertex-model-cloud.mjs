import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const applyPath = path.join(root, "scripts/apply-vertex-model-cloud.mjs")
const providerPath = path.join(root, "lib/ai/providers/vertex-model-cloud.ts")
const capabilitiesPath = path.join(root, "lib/ai/capabilities.ts")
const gatewayPath = path.join(root, "lib/ai/gateway.ts")
const healthPath = path.join(root, "app/api/admin/ai-core/health/route.ts")

for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [applyPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) throw new Error(`[test-vertex-model-cloud] apply run ${i + 1} failed: ${run.stderr || run.stdout}`)
}

const provider = fs.readFileSync(providerPath, "utf8")
const capabilities = fs.readFileSync(capabilitiesPath, "utf8")
const gateway = fs.readFileSync(gatewayPath, "utf8")
const health = fs.readFileSync(healthPath, "utf8")

for (const marker of [
  "x-vercel-oidc-token",
  "https://sts.googleapis.com/v1/token",
  "iamcredentials.googleapis.com",
  ":rawPredict",
  "VERTEX_MODEL_CLOUD_ENDPOINT_ID",
  "GCP_WORKLOAD_IDENTITY_POOL_ID",
]) {
  if (!provider.includes(marker)) throw new Error(`[test-vertex-model-cloud] missing provider security/runtime marker: ${marker}`)
}
for (const forbidden of ["GOOGLE_SERVICE_ACCOUNT_JSON", "PRIVATE_KEY", "client_email"]) {
  if (provider.includes(forbidden)) throw new Error(`[test-vertex-model-cloud] long-lived service-account credential marker forbidden: ${forbidden}`)
}
if (!capabilities.includes('| "vertex-model-cloud"')) throw new Error("[test-vertex-model-cloud] provider id missing")
if (!capabilities.includes('text: ["google", "vertex-model-cloud"')) throw new Error("[test-vertex-model-cloud] Model Cloud must follow Google in text routing")
if (!gateway.includes("generateVertexModelCloudText") || !gateway.includes("hasVertexModelCloud")) {
  throw new Error("[test-vertex-model-cloud] Gateway wiring missing")
}
if (!health.includes('"vertex-model-cloud"') || !health.includes("modelCloud:")) {
  throw new Error("[test-vertex-model-cloud] Model Lab health wiring missing")
}

console.log("[test-vertex-model-cloud] Vertex custom endpoint uses Vercel OIDC/WIF and remains optional/idempotent")
