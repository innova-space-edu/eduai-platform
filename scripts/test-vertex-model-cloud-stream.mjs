import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const applyPath = path.join(root, "scripts/apply-vertex-model-cloud-stream.mjs")
const gatewayPath = path.join(root, "lib/ai/gateway.ts")

for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [applyPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) {
    throw new Error(`[test-vertex-model-cloud-stream] apply run ${i + 1} failed: ${run.stderr || run.stdout}`)
  }
}

const source = fs.readFileSync(gatewayPath, "utf8")
if ((source.split("const modelCloudResponse = await generateVertexModelCloudText({").length - 1) !== 1) {
  throw new Error("[test-vertex-model-cloud-stream] Model Cloud streaming fallback debe existir exactamente una vez")
}
if (!source.includes('provider === "vertex-model-cloud" && hasVertexModelCloud()')) {
  throw new Error("[test-vertex-model-cloud-stream] streamAIText no reconoce Model Cloud")
}
if (!source.includes("controller.enqueue(encoder.encode(modelCloudResponse.text))")) {
  throw new Error("[test-vertex-model-cloud-stream] la respuesta de Model Cloud no se adapta a ReadableStream")
}
if (!source.includes('provider: "vertex-model-cloud",\n          capability: "text"')) {
  throw new Error("[test-vertex-model-cloud-stream] streaming no usa el Model Registry")
}

console.log("[test-vertex-model-cloud-stream] Model Cloud participa en streaming sin cambiar consumidores y el parche es idempotente")
