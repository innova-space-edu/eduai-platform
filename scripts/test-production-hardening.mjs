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

console.log("[test-production-hardening] CI real, Nube ownership/fail-closed, Video SSRF, BYOK y Gemini-first verificados")
