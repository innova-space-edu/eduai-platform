import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const agent = fs.readFileSync(path.join(root, "lib/video-agent.ts"), "utf8")
const processRoute = fs.readFileSync(path.join(root, "app/api/agents/video/process/route.ts"), "utf8")
const statusRoute = fs.readFileSync(path.join(root, "app/api/agents/video/status/[jobId]/route.ts"), "utf8")
const createRoute = fs.readFileSync(path.join(root, "app/api/agents/video/route.ts"), "utf8")

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`[test-video-free-router] Falta ${label}: ${value}`)
}

requireText(agent, 'from "@/lib/video/providers/wan"', "adapter WAN")
requireText(agent, 'from "@/lib/video/providers/hf-gradio"', "adapter HF Gradio")
requireText(agent, 'process.env.VIDEO_PROVIDER_ORDER || "wan,hf-gradio,hf-space,google"', "orden gratuito primero")
requireText(agent, 'if (isWanVideoConfigured() && !order.includes("wan")) order.unshift("wan")', "WAN antepuesto al orden legacy")
requireText(agent, 'isHFGradioVideoConfigured() && !order.includes("hf-gradio")', "HF Gradio antepuesto al premium")
requireText(agent, 'if (provider === "wan")', "rama WAN")
requireText(agent, 'if (provider === "hf-gradio")', "rama HF Gradio")
requireText(agent, 'input.operationName.startsWith("wan:")', "polling WAN")
requireText(agent, 'input.operationName.startsWith("hf:")', "polling HF Gradio")
requireText(processRoute, 'provider: job.provider || null', "provider durante cron/polling")
requireText(statusRoute, '["google", "wan", "hf-gradio"].includes(current.provider || "")', "polling async multi-provider")
requireText(statusRoute, 'provider: current.provider', "provider durante status polling")
requireText(createRoute, 'provider: null', "job sin proveedor preasignado")
requireText(createRoute, '.eq("status", "completed")', "cupo basado en videos completados")

const inputStart = agent.indexOf("export type ProcessVideoJobInput = {")
const inputEnd = agent.indexOf("\n}\n\nexport type ProcessVideoJobResult", inputStart)
if (inputStart < 0 || inputEnd < 0) throw new Error("[test-video-free-router] No se encontró ProcessVideoJobInput")
const inputType = agent.slice(inputStart, inputEnd)
requireText(inputType, "provider?: string | null", "provider tipado en ProcessVideoJobInput")
requireText(inputType, "model?: string | null", "model tipado en ProcessVideoJobInput")

if (createRoute.includes("await incrementDailyUsage({ supabase, userId: user.id, plan })")) {
  throw new Error("[test-video-free-router] Un intento de video todavía consume cupo antes de completarse")
}

console.log("[test-video-free-router] WAN/HF Gradio/HF legacy/Google, polling multi-provider y cupo por completados verificados")

await import("./apply-video-free-ui.mjs")
await import("./test-video-free-ui.mjs")
await import("./apply-video-personal-marketplace.mjs")
await import("./test-video-personal-marketplace.mjs")
