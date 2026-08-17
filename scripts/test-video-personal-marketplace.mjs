import fs from "node:fs"
import path from "node:path"

await import("./apply-current-image-models.mjs")
await import("./apply-personal-provider-hardening.mjs")
await import("./apply-video-personal-recovery.mjs")

const root = process.cwd()
const freeRoutePath = path.join(root, "app/api/agents/video/route.ts")
const beforeStable = fs.readFileSync(freeRoutePath, "utf8")
if (!beforeStable.includes("resolveTrustedImageInput") && !beforeStable.includes("resolveOwnedImageAssetId")) {
  await import("./apply-video-stable-image-identity.mjs")
}

const studio = fs.readFileSync(path.join(root, "components/video/VideoStudioClient.tsx"), "utf8")
const marketplace = fs.readFileSync(path.join(root, "components/video/PersonalAIMarketplace.tsx"), "utf8")
const vault = fs.readFileSync(path.join(root, "lib/ai/personal-credentials.ts"), "utf8")
const credentialRoute = fs.readFileSync(path.join(root, "app/api/account/ai-credentials/route.ts"), "utf8")
const freeVideoRoute = fs.readFileSync(freeRoutePath, "utf8")
const personalRoute = fs.readFileSync(path.join(root, "app/api/agents/video/personal/route.ts"), "utf8")
const personalStatus = fs.readFileSync(path.join(root, "app/api/agents/video/personal/status/[jobId]/route.ts"), "utf8")
const personalRecent = fs.readFileSync(path.join(root, "app/api/agents/video/personal/recent/route.ts"), "utf8")
const personalRouter = fs.readFileSync(path.join(root, "lib/video/personal-video-router.ts"), "utf8")
const trustedInput = fs.readFileSync(path.join(root, "lib/video/trusted-image-input.ts"), "utf8")
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
requireText(vault, 'process.env.NODE_ENV !== "production"', "fallback BYOK limitado fuera de producción")
requireText(credentialRoute, "listPersonalCredentials", "metadata de conexiones")
requireText(freeVideoRoute, "resolveTrustedImageInput", "resolución segura de imagen en video automático")
requireText(freeVideoRoute, "trustedImage", "imagen server-side validada en video automático")
requireText(freeVideoRoute, "imageIdentity", "fingerprint estable en video automático")
requireText(personalRoute, 'plan: "personal"', "job personal separado")
requireText(personalRoute, "assertPersonalBudget", "límite antes de gasto")
requireText(personalRoute, "generationAvoided: true", "reutilización antes del cobro")
requireText(personalRoute, "resolveTrustedImageInput", "resolución segura de imagen Premium Personal")
requireText(personalRoute, "trustedImage", "imagen server-side validada Premium Personal")
requireText(personalRoute, "imageIdentity", "fingerprint estable Premium Personal")
requireText(personalStatus, "pollPersonalVideo", "polling premium asíncrono")
requireText(personalRecent, '.eq("plan", "personal")', "recuperación limitada a jobs personales")
requireText(personalRecent, '.eq("user_id", user.id)', "recuperación limitada al dueño")
requireText(personalRouter, 'version: `${owner}/${name}:${model.latest_version.id}`', "versión completa Replicate")
requireText(trustedInput, '.eq("owner_id", input.userId)', "asset de imagen limitado al dueño")
requireText(trustedInput, '.eq("asset_type", "image")', "asset validado como imagen")
requireText(trustedInput, 'const VIDEO_INPUT_BUCKET = "video-inputs"', "bucket privado de uploads de Video Studio")
requireText(trustedInput, 'storagePath.startsWith(`${userId}/`)', "upload de imagen limitado al dueño")
requireText(trustedInput, 'code: "IMAGE_URL_UNTRUSTED"', "rechazo explícito de URL externa")
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
if (/stableImageFingerprintIdentity\(\{\s*imageAssetId,\s*imageUrl\s*\}\)/m.test(freeVideoRoute + personalRoute)) {
  throw new Error("[test-video-personal-marketplace] imageUrl del cliente volvió a participar sin validación server-side")
}

console.log("[test-video-personal-marketplace] BYOK dedicado en producción, URL de imagen confiable, reuse estable, Replicate y Gemini-first verificados")
