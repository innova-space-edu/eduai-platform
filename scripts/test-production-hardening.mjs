import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const publicItems = fs.readFileSync(
  path.join(root, "app/api/repository/public-access/[token]/items/route.ts"),
  "utf8",
)
const publicItem = fs.readFileSync(
  path.join(root, "app/api/repository/public-access/[token]/items/[itemId]/route.ts"),
  "utf8",
)
const freeVideo = fs.readFileSync(path.join(root, "app/api/agents/video/route.ts"), "utf8")
const personalVideo = fs.readFileSync(path.join(root, "app/api/agents/video/personal/route.ts"), "utf8")
const vault = fs.readFileSync(path.join(root, "lib/ai/personal-credentials.ts"), "utf8")
const imageConfig = fs.readFileSync(path.join(root, "lib/image-config.ts"), "utf8")
const workflow = fs.readFileSync(path.join(root, ".github/workflows/ai-core-validation.yml"), "utf8")
const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8")

function requireText(source, value, label) {
  if (!source.includes(value)) {
    throw new Error(`[test-production-hardening] Falta ${label}: ${value}`)
  }
}

requireText(
  publicItems,
  'if (!url || !authToken) return process.env.NODE_ENV !== "production"',
  "rate-limit fail-closed sin Upstash en producción",
)
requireText(publicItems, "if (!response.ok) return false", "rate-limit fail-closed ante error HTTP")
requireText(
  publicItems,
  '.eq("created_by", access.ownerId)',
  "ownership en listado público",
)
requireText(publicItem, "return { admin, ownerId }", "ownerId conservado tras validar enlace público")
requireText(publicItem, '.eq("created_by", ownerId)', "ownership en detalle público")
requireText(freeVideo, "resolveTrustedImageInput", "imagen confiable en Video automático")
requireText(personalVideo, "resolveTrustedImageInput", "imagen confiable en Premium Personal")
requireText(vault, 'process.env.NODE_ENV !== "production"', "fallback de vault solo fuera de producción")
requireText(
  vault,
  "EDUAI_CREDENTIALS_MASTER_KEY es obligatoria en producción",
  "master key dedicada obligatoria",
)
requireText(imageConfig, "function geminiFirstProviderOrder(", "Gemini forzado como primer proveedor")
requireText(workflow, "set -o pipefail", "pipefail en CI")

for (const [name, label] of [
  ["NEXT_PUBLIC_SUPABASE_URL", "URL pública de Supabase"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable key de Supabase"],
  ["SUPABASE_SERVICE_ROLE_KEY", "service role solo servidor"],
  ["EDUAI_CREDENTIALS_MASTER_KEY", "master key BYOK solo servidor"],
  ["UPSTASH_REDIS_REST_URL", "URL de rate limit"],
  ["UPSTASH_REDIS_REST_TOKEN", "token de rate limit"],
]) {
  requireText(envExample, `${name}=`, `variable documentada: ${label}`)
}

const forbiddenPublicSecrets = [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_EDUAI_CREDENTIALS_MASTER_KEY",
  "NEXT_PUBLIC_GEMINI_API_KEY",
  "NEXT_PUBLIC_GROQ_API_KEY",
  "NEXT_PUBLIC_OPENROUTER_API_KEY",
  "NEXT_PUBLIC_TOGETHER_API_KEY",
  "NEXT_PUBLIC_CEREBRAS_API_KEY",
  "NEXT_PUBLIC_HF_TOKEN",
  "NEXT_PUBLIC_DASHSCOPE_API_KEY",
  "NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_TAVILY_API_KEY",
  "NEXT_PUBLIC_FIRECRAWL_API_KEY",
]

for (const name of forbiddenPublicSecrets) {
  if (envExample.includes(`${name}=`)) {
    throw new Error(`[test-production-hardening] Se documentó un secreto como público: ${name}`)
  }
}

function collectSourceFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectSourceFiles(full))
    else if (entry.isFile() && /\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) files.push(full)
  }
  return files
}

const publicSecretScanFiles = [
  ...collectSourceFiles(path.join(root, "app")),
  ...collectSourceFiles(path.join(root, "components")),
  ...collectSourceFiles(path.join(root, "lib")),
  path.join(root, "proxy.ts"),
].filter((file) => fs.existsSync(file))

for (const file of publicSecretScanFiles) {
  const source = fs.readFileSync(file, "utf8")
  for (const name of forbiddenPublicSecrets) {
    if (source.includes(name)) {
      throw new Error(
        `[test-production-hardening] Se encontró referencia pública a secreto en ${path.relative(root, file)}: ${name}`,
      )
    }
  }
}

const catchIndex = publicItems.indexOf("async function checkUploadRateLimit")
const cleanTextIndex = publicItems.indexOf("function cleanText", catchIndex)
const rateLimitBlock = publicItems.slice(catchIndex, cleanTextIndex)
if (!/catch\s*\{\s*return false\s*\}/m.test(rateLimitBlock)) {
  throw new Error("[test-production-hardening] El rate-limit público debe fallar cerrado también ante excepción")
}

if (/\.eq\("visibility", "public"\)\s*\.order/m.test(publicItems)) {
  throw new Error("[test-production-hardening] El listado público volvió a consultar visibility sin owner")
}
if (/\.eq\("visibility", "public"\)\s*\.maybeSingle/m.test(publicItem)) {
  throw new Error("[test-production-hardening] El detalle público volvió a consultar visibility sin owner")
}

console.log("[test-production-hardening] CI, Nube, Video, BYOK, Gemini-first y secretos públicos verificados")
