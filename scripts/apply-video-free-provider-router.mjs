import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const agentPath = path.join(root, "lib/video-agent.ts")
const processPath = path.join(root, "app/api/agents/video/process/route.ts")
const statusPath = path.join(root, "app/api/agents/video/status/[jobId]/route.ts")
const createPath = path.join(root, "app/api/agents/video/route.ts")

for (const target of [agentPath, processPath, statusPath, createPath]) {
  if (!fs.existsSync(target)) throw new Error(`[video-free-router] No se encontró ${target}`)
}

let agent = fs.readFileSync(agentPath, "utf8")
let processRoute = fs.readFileSync(processPath, "utf8")
let statusRoute = fs.readFileSync(statusPath, "utf8")
let createRoute = fs.readFileSync(createPath, "utf8")
let changed = false

function replaceIn(source, from, to, label) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`[video-free-router] Falta ${label}`)
  changed = true
  return source.replace(from, to)
}

agent = replaceIn(
  agent,
  'import { createClient as createAdmin } from "@supabase/supabase-js"',
  'import { createClient as createAdmin } from "@supabase/supabase-js"\nimport { isWanVideoConfigured, pollWanVideo, startWanVideo } from "@/lib/video/providers/wan"',
  "import WAN",
)

if (!agent.includes("provider?: string | null")) {
  agent = replaceIn(
    agent,
    '  model?: string | null\n}',
    '  model?: string | null\n  provider?: string | null\n}',
    "provider en ProcessVideoJobInput",
  )
}

const durationStart = agent.indexOf("function normalizeDuration(value: number | null | undefined): number {")
const durationEnd = agent.indexOf("\n}\n\nfunction normalizeAspectRatio", durationStart)
if (durationStart < 0 || durationEnd < 0) throw new Error("[video-free-router] No se encontró normalizeDuration")
const durationFn = `function normalizeDuration(value: number | null | undefined): number {
  const safe = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 6
  return Math.min(10, Math.max(2, safe))
}`
if (agent.slice(durationStart, durationEnd + 2) !== durationFn) {
  agent = agent.slice(0, durationStart) + durationFn + agent.slice(durationEnd + 2)
  changed = true
}

const providerOrderStart = agent.indexOf("function videoProviderOrder(): string[] {")
const providerOrderEnd = agent.indexOf("\n\nexport async function processVideoJob", providerOrderStart)
if (providerOrderStart < 0 || providerOrderEnd < 0) throw new Error("[video-free-router] No se encontró videoProviderOrder")
const providerOrder = `function videoProviderOrder(): string[] {
  const configured = (process.env.VIDEO_PROVIDER_ORDER || "wan,hf-space,google")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value === "replicate" || value === "veo" ? "google" : value)
    .filter((value) => ["wan", "google", "hf-space", "ltx", "wan-worker"].includes(value))

  const order = Array.from(new Set(configured))

  // Si WAN quedó configurado después de un deploy con el orden legacy, se antepone
  // automáticamente. Google/Veo queda disponible como premium/fallback, no como requisito.
  if (isWanVideoConfigured() && !order.includes("wan")) order.unshift("wan")

  if (!order.length) {
    const fallback: string[] = []
    if (isWanVideoConfigured()) fallback.push("wan")
    if (process.env.HF_SPACE_VIDEO_API_URL) fallback.push("hf-space")
    if (googleVideoKey()) fallback.push("google")
    return fallback
  }
  return order
}`
if (agent.slice(providerOrderStart, providerOrderEnd) !== providerOrder) {
  agent = agent.slice(0, providerOrderStart) + providerOrder + agent.slice(providerOrderEnd)
  changed = true
}

const operationStart = agent.indexOf("  if (input.operationName) {")
const errorsMarker = agent.indexOf("\n\n  const errors: string[] = []", operationStart)
if (operationStart < 0 || errorsMarker < 0) throw new Error("[video-free-router] No se encontró rama de polling")
const operationBranch = `  if (input.operationName) {
    if (!input.userId) return { ok: false, status: "failed", provider: input.provider || null, error: "Falta userId para persistir el video terminado." }

    if (input.provider === "wan" || input.operationName.startsWith("wan:")) {
      return pollWanVideo({
        operationName: input.operationName,
        userId: input.userId,
        prompt,
        sourceJobId: input.sourceJobId,
        model: input.model,
      })
    }

    return pollGoogleVeo({
      operationName: input.operationName,
      userId: input.userId,
      prompt,
      sourceJobId: input.sourceJobId,
      model: input.model,
    })
  }`
if (agent.slice(operationStart, errorsMarker) !== operationBranch) {
  agent = agent.slice(0, operationStart) + operationBranch + agent.slice(errorsMarker)
  changed = true
}

const googleBranch = '    if (provider === "google") {'
if (!agent.includes('provider === "wan"')) {
  const index = agent.indexOf(googleBranch, agent.indexOf("const errors: string[]"))
  if (index < 0) throw new Error("[video-free-router] No se encontró rama Google")
  const wanBranch = `    if (provider === "wan") {
      if (!isWanVideoConfigured()) {
        errors.push("wan: proveedor no configurado")
        continue
      }
      const result = await startWanVideo({ prompt, style, duration, mode, imageUrl, aspectRatio, resolution })
      if (result.ok) return result
      errors.push(\`wan: \${result.error || "falló"}\`)
      continue
    }

`
  agent = agent.slice(0, index) + wanBranch + agent.slice(index)
  changed = true
}

if (!processRoute.includes("provider: job.provider || null")) {
  processRoute = replaceIn(
    processRoute,
    '    sourceJobId: job.id,\n    model: job.model || null,',
    '    sourceJobId: job.id,\n    provider: job.provider || null,\n    model: job.model || null,',
    "provider del job al motor",
  )
}

statusRoute = statusRoute.replace(
  'if (current.status !== "processing" || current.provider !== "google" || !current.operation_name) return current',
  'if (current.status !== "processing" || !["google", "wan"].includes(current.provider || "") || !current.operation_name) return current',
)
if (statusRoute.includes('!["google", "wan"].includes(current.provider || "")')) changed = true

if (!statusRoute.includes("provider: current.provider,\n      model: current.model,")) {
  statusRoute = replaceIn(
    statusRoute,
    '      sourceJobId: current.id,\n    })',
    '      sourceJobId: current.id,\n      provider: current.provider,\n      model: current.model,\n    })',
    "provider/model durante polling",
  )
}

// No preasignar Google antes de saber qué proveedor resolvió el router.
if (createRoute.includes('provider: process.env.GEMINI_API_KEY_VIDEO || process.env.GEMINI_API_KEY ? "google" : "hf-space",')) {
  createRoute = createRoute.replace(
    'provider: process.env.GEMINI_API_KEY_VIDEO || process.env.GEMINI_API_KEY ? "google" : "hf-space",',
    'provider: null,',
  )
  changed = true
}

// Los intentos fallidos no consumen el límite diario. El uso se calcula con videos completados.
const usageStart = createRoute.indexOf("async function getDailyUsage(params: {")
const usageEnd = createRoute.indexOf("\n}\n\nasync function incrementDailyUsage", usageStart)
if (usageStart < 0 || usageEnd < 0) throw new Error("[video-free-router] No se encontró getDailyUsage")
const usageFn = `async function getDailyUsage(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  plan: VideoPlan
}): Promise<DailyLimitResult> {
  const today = getTodayIsoDate()
  const limit = DAILY_LIMITS[params.plan] ?? DAILY_LIMITS.free
  const start = today + "T00:00:00.000Z"
  const { count, error } = await params.supabase
    .from("video_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("status", "completed")
    .gte("completed_at", start)

  if (error) throw new Error(\`No se pudo consultar el uso diario: \${error.message}\`)
  const used = count ?? 0
  return { allowed: used < limit, plan: params.plan, limit, used, remaining: Math.max(0, limit - used) }
}`
if (createRoute.slice(usageStart, usageEnd + 2) !== usageFn) {
  createRoute = createRoute.slice(0, usageStart) + usageFn + createRoute.slice(usageEnd + 2)
  changed = true
}

if (createRoute.includes("    await incrementDailyUsage({ supabase, userId: user.id, plan })\n")) {
  createRoute = createRoute.replace("    await incrementDailyUsage({ supabase, userId: user.id, plan })\n\n", "")
  changed = true
}
createRoute = createRoute.replace(
  "remainingToday: Math.max(0, usage.remaining - 1),",
  "remainingToday: usage.remaining,",
)

if (changed) {
  fs.writeFileSync(agentPath, agent)
  fs.writeFileSync(processPath, processRoute)
  fs.writeFileSync(statusPath, statusRoute)
  fs.writeFileSync(createPath, createRoute)
  console.log("[video-free-router] WAN/HF antes de Veo; fallos no consumen cupo diario")
} else {
  console.log("[video-free-router] ya aplicado")
}
