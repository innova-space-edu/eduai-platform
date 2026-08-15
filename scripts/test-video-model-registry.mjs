import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const agent = fs.readFileSync(path.join(root, "lib", "video-agent.ts"), "utf8")
const processRoute = fs.readFileSync(path.join(root, "app", "api", "agents", "video", "process", "route.ts"), "utf8")

for (const [label, value] of [
  ["registry import", 'resolveProviderModel } from "@/lib/ai/model-registry"'],
  ["video capability", 'capability: "video"'],
  ["registry fallback", "fallbackModel: googleVideoModel()"],
  ["stable model", "const model = input.model || selectedModel.model"],
  ["poll model", "model: input.model"],
]) {
  if (!agent.includes(value)) throw new Error(`[test-video-model-registry] Falta ${label}: ${value}`)
}

if (!processRoute.includes("model: job.model || null")) {
  throw new Error("[test-video-model-registry] process route no conserva el modelo del job")
}

console.log("[test-video-model-registry] Video Studio usa registro dinámico y conserva modelo durante polling")
