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

const inputStart = agent.indexOf("export type ProcessVideoJobInput = {")
const inputEnd = agent.indexOf("\n}\n\nexport type ProcessVideoJobResult", inputStart)
const inputType = inputStart >= 0 && inputEnd > inputStart ? agent.slice(inputStart, inputEnd) : ""
if (!inputType.includes("model?: string | null") || !inputType.includes("provider?: string | null")) {
  throw new Error("[test-video-model-registry] ProcessVideoJobInput debe conservar model + provider")
}

const pollStart = agent.indexOf("async function pollGoogleVeo(input: {")
const pollEnd = agent.indexOf("}): Promise<ProcessVideoJobResult>", pollStart)
const pollSignature = pollStart >= 0 && pollEnd > pollStart ? agent.slice(pollStart, pollEnd) : ""
if (!pollSignature.includes("model?: string | null")) {
  throw new Error("[test-video-model-registry] pollGoogleVeo no acepta el modelo persistido del job")
}

if (!processRoute.includes("model: job.model || null")) {
  throw new Error("[test-video-model-registry] process route no conserva el modelo del job")
}

console.log("[test-video-model-registry] Video Studio conserva provider/model y Veo acepta el modelo durante polling")
