import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const agentPath = path.join(root, "lib", "video-agent.ts")
const processPath = path.join(root, "app", "api", "agents", "video", "process", "route.ts")

for (const target of [agentPath, processPath]) {
  if (!fs.existsSync(target)) throw new Error(`[video-model-registry] No se encontró ${target}`)
}

let agent = fs.readFileSync(agentPath, "utf8")
let processRoute = fs.readFileSync(processPath, "utf8")
let changed = false

function replaceAgent(oldText, newText, label) {
  if (agent.includes(newText)) return
  if (!agent.includes(oldText)) throw new Error(`[video-model-registry] Falta ${label}`)
  agent = agent.replace(oldText, newText)
  changed = true
}

function replaceProcess(oldText, newText, label) {
  if (processRoute.includes(newText)) return
  if (!processRoute.includes(oldText)) throw new Error(`[video-model-registry] Falta ${label}`)
  processRoute = processRoute.replace(oldText, newText)
  changed = true
}

replaceAgent(
  'import { createClient as createAdmin } from "@supabase/supabase-js"',
  'import { createClient as createAdmin } from "@supabase/supabase-js"\nimport { resolveProviderModel } from "@/lib/ai/model-registry"',
  "import del registro dinámico",
)

replaceAgent(
  '  sourceJobId?: string | null\n}',
  '  sourceJobId?: string | null\n  model?: string | null\n}',
  "modelo opcional en ProcessVideoJobInput",
)

replaceAgent(
  '  resolution: "720p" | "1080p" | "4k"\n}): Promise<ProcessVideoJobResult> {\n  const ai = googleClient()\n  const model = googleVideoModel()',
  '  resolution: "720p" | "1080p" | "4k"\n  model?: string | null\n}): Promise<ProcessVideoJobResult> {\n  const ai = googleClient()\n  const selectedModel = await resolveProviderModel({\n    supabase: getAdminSupabase(),\n    provider: "google",\n    capability: "video",\n    fallbackModel: googleVideoModel(),\n  })\n  const model = input.model || selectedModel.model',
  "selección dinámica al iniciar Veo",
)

replaceAgent(
  '  prompt: string\n  sourceJobId?: string | null\n}): Promise<ProcessVideoJobResult> {\n  const ai = googleClient()\n  const model = googleVideoModel()',
  '  prompt: string\n  sourceJobId?: string | null\n  model?: string | null\n}): Promise<ProcessVideoJobResult> {\n  const ai = googleClient()\n  const selectedModel = await resolveProviderModel({\n    supabase: getAdminSupabase(),\n    provider: "google",\n    capability: "video",\n    fallbackModel: googleVideoModel(),\n  })\n  const model = input.model || selectedModel.model',
  "selección dinámica durante polling de Veo",
)

replaceAgent(
  '      prompt,\n      sourceJobId: input.sourceJobId,\n    })',
  '      prompt,\n      sourceJobId: input.sourceJobId,\n      model: input.model,\n    })',
  "modelo estable durante polling",
)

replaceAgent(
  '        return await startGoogleVeo({ prompt, style, duration, mode, imageUrl, aspectRatio, resolution })',
  '        return await startGoogleVeo({ prompt, style, duration, mode, imageUrl, aspectRatio, resolution, model: input.model })',
  "modelo en inicio de Veo",
)

replaceProcess(
  '    sourceJobId: job.id,\n  }',
  '    sourceJobId: job.id,\n    model: job.model || null,\n  }',
  "modelo del job hacia el motor",
)

if (changed) {
  fs.writeFileSync(agentPath, agent)
  fs.writeFileSync(processPath, processRoute)
  console.log("[video-model-registry] Veo usa ai_provider_models y conserva el modelo durante polling")
} else {
  console.log("[video-model-registry] Veo ya usa ai_provider_models")
}
