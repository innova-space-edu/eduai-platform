import fs from "node:fs"
import path from "node:path"

await import("./apply-current-image-models.mjs")
await import("./apply-personal-provider-hardening.mjs")
await import("./apply-video-personal-recovery.mjs")
await import("./apply-video-stable-image-identity.mjs")

const root = process.cwd()
const studio = fs.readFileSync(path.join(root, "components/video/VideoStudioClient.tsx"), "utf8")
const marketplace = fs.readFileSync(path.join(root, "components/video/PersonalAIMarketplace.tsx"), "utf8")
const vault = fs.readFileSync(path.join(root, "lib/ai/personal-credentials.ts"), "utf8")
const credentialRoute = fs.readFileSync(path.join(root, "app/api/account/ai-credentials/route.ts"), "utf8")
const freeVideoRoute = fs.readFileSync(path.join(root, "app/api/agents/video/route.ts"), "utf8")
const personalRoute = fs.readFileSync(path.join(root, "app/api/agents/video/personal/route.ts"), "utf8")
const personalStatus = fs.readFileSync(path.join(root, "app/api/agents/video/personal/status/[jobId]/route.ts"), "utf8")
const personalRecent = fs.readFileSync(path.join(root, "app/api/agents/video/personal/recent/route.ts"), "utf8")
const personalRouter = fs.readFileSync(path.join(root, "lib/video/personal-video-router.ts"), "utf8")
const imageIdentity = fs.readFileSync(path.join(root, "lib/video/image-asset-identity.ts"), "utf8")
const imageConfig = fs.readFileSync(path.join(root, "lib/image-config.ts"), "utf8")

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`[test-video-personal-marketplace] Falta ${label}: ${text}`)
}

requireText(studio, "<PersonalAIMarketplace", "marketplace en Video Studio")
requireText(studio, "Automático · ahorro primero", "modo ahorro primero")
requireText(studio, "imageAssetId: selectedImageAssetId", "assetId estable en video automático")
requireText(studio, "imageAssetId={selectedImageAssetId}", "assetId estable hacia Premium Personal")
requireText(marketplace, "Premium personal · paga con tu cuenta", "botón premium personal")
requireText(marketplace, "Crear cuenta", "acceso guiado a cuenta")
requireText(marketplace, "Obtener API key", "acceso guiado a API key")
requireText(marketplace, "Mis límites", "controles de presupuesto")
requireText(marketplace, "PERSONAL_VIDEO_JOB_RECOVERY_V1", "recuperación de job personal")
requireText(marketplace, "/api/agents/video/personal/recent", "consulta de jobs recientes")
requireText(marketplace, "imageAssetId: string | null", "prop estable de imagen reutilizable")
requireText(marketplace, "imageAssetId: props.imageAssetId", "assetId en request Premium Personal")
requireText(vault, 'createCipheriv("aes-256-gcm"', "cifrado AES-256-GCM")
requireText(vault, "EDUAI_CREDENTIALS_MASTER_KEY", "master key dedicada")
requireText(credentialRoute, "listPersonalCredentials", "metadata de conexiones")
requireText(freeVideoRoute, "resolveOwnedImageAssetId", "validación de asset en video automático")
requireText(freeVideoRoute, "imageIdentity", "fingerprint estable en video automático")
requireText(freeVideoRoute, "IMAGE_ASSET_INVALID", "rechazo de asset ajeno en video automático")
requireText(personalRoute, 'plan: "personal"', "job personal separado")
requireText(personalRoute, "assertPersonalBudget", "límite antes de gasto")
requireText(personalRoute, "generationAvoided: true", "reutilización antes del cobro")
requireText(personalRoute, "resolveOwnedImageAssetId", "validación de asset Premium Personal")
requireText(personalRoute, "imageIdentity", "fingerprint estable Premium Personal")
requireText(personalRoute, "IMAGE_ASSET_INVALID", "rechazo de asset ajeno Premium Personal")
requireText(personalStatus, "pollPersonalVideo", "polling premium asíncrono")
requireText(personalRecent, '.eq("plan", "personal")', "recuperación limitada a jobs personales")
requireText(personalRecent, '.eq("user_id", user.id)', "recuperación limitada al dueño")
requireText(personalRouter, 'version: `${owner}/${name}:${model.latest_version.id}`', "versión completa Replicate")
requireText(imageIdentity, '.eq("owner_id", input.userId)', "asset de imagen limitado al dueño")
requireText(imageIdentity, '.eq("asset_type", "image")', "asset validado como imagen")
requireText(imageIdentity, 'return `asset:${assetId}`', "identidad estable por assetId")
requireText(imageConfig, 'fast: ["gemini", "pollinations", "openrouter", "together", "huggingface"]', "Gemini primero en imagen rápida")
requireText(imageConfig, 'const CURRENT_GEMINI_IMAGE_MODELS = [', "bloque de modelos actuales")
requireText(imageConfig, '"gemini-3.1-flash-image",', "Gemini 3.1 Image primero")
requireText(imageConfig, '"gemini-3.1-flash-lite-image",', "Gemini 3.1 Lite Image")
requireText(imageConfig, '!/^gemini-2\\.5-flash-image', "filtro Gemini 2.5 legacy")
requireText(imageConfig, 'function geminiFirstProviderOrder(', "protección de proveedor Gemini primero")
requireText(imageConfig, 'return ["gemini", ...order.filter((provider) => provider !== "gemini")]', "Gemini forzado delante de orden legacy")
requireText(imageConfig, 'return geminiFirstProviderOrder(parseProviderOrder(', "orden auto protegido contra variables legacy")

if (credentialRoute.includes("encrypted_secret") || credentialRoute.includes("encryption_iv") || credentialRoute.includes("encryption_tag")) {
  throw new Error("[test-video-personal-marketplace] La API de cuenta referencia campos cifrados directamente; debe delegarlos al vault")
}
if (/NEXT_PUBLIC_(FAL|REPLICATE|HF|HUGGINGFACE).*KEY/i.test(marketplace + personalRoute + vault)) {
  throw new Error("[test-video-personal-marketplace] Se detectó una API key personal con NEXT_PUBLIC")
}
if (/localStorage.*(key|token|secret)/i.test(marketplace)) {
  throw new Error("[test-video-personal-marketplace] No guardar claves personales en localStorage")
}

console.log("[test-video-personal-marketplace] BYOK cifrado, presupuestos, reuse estable por assetId, Replicate y Gemini 3.1/provider-first verificados")
