import fs from "node:fs"
import path from "node:path"

await import("./apply-current-image-models.mjs")
await import("./apply-personal-provider-hardening.mjs")
await import("./apply-video-personal-recovery.mjs")

const root = process.cwd()
const studio = fs.readFileSync(path.join(root, "components/video/VideoStudioClient.tsx"), "utf8")
const marketplace = fs.readFileSync(path.join(root, "components/video/PersonalAIMarketplace.tsx"), "utf8")
const vault = fs.readFileSync(path.join(root, "lib/ai/personal-credentials.ts"), "utf8")
const credentialRoute = fs.readFileSync(path.join(root, "app/api/account/ai-credentials/route.ts"), "utf8")
const personalRoute = fs.readFileSync(path.join(root, "app/api/agents/video/personal/route.ts"), "utf8")
const personalStatus = fs.readFileSync(path.join(root, "app/api/agents/video/personal/status/[jobId]/route.ts"), "utf8")
const personalRecent = fs.readFileSync(path.join(root, "app/api/agents/video/personal/recent/route.ts"), "utf8")
const personalRouter = fs.readFileSync(path.join(root, "lib/video/personal-video-router.ts"), "utf8")
const imageConfig = fs.readFileSync(path.join(root, "lib/image-config.ts"), "utf8")

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`[test-video-personal-marketplace] Falta ${label}: ${text}`)
}

requireText(studio, "<PersonalAIMarketplace", "marketplace en Video Studio")
requireText(studio, "Automático · ahorro primero", "modo ahorro primero")
requireText(marketplace, "Premium personal · paga con tu cuenta", "botón premium personal")
requireText(marketplace, "Crear cuenta", "acceso guiado a cuenta")
requireText(marketplace, "Obtener API key", "acceso guiado a API key")
requireText(marketplace, "Mis límites", "controles de presupuesto")
requireText(marketplace, "PERSONAL_VIDEO_JOB_RECOVERY_V1", "recuperación de job personal")
requireText(marketplace, "/api/agents/video/personal/recent", "consulta de jobs recientes")
requireText(vault, 'createCipheriv("aes-256-gcm"', "cifrado AES-256-GCM")
requireText(vault, "EDUAI_CREDENTIALS_MASTER_KEY", "master key dedicada")
requireText(credentialRoute, "listPersonalCredentials", "metadata de conexiones")
requireText(personalRoute, 'plan: "personal"', "job personal separado")
requireText(personalRoute, "assertPersonalBudget", "límite antes de gasto")
requireText(personalRoute, "generationAvoided: true", "reutilización antes del cobro")
requireText(personalStatus, "pollPersonalVideo", "polling premium asíncrono")
requireText(personalRecent, '.eq("plan", "personal")', "recuperación limitada a jobs personales")
requireText(personalRecent, '.eq("user_id", user.id)', "recuperación limitada al dueño")
requireText(personalRouter, 'version: `${owner}/${name}:${model.latest_version.id}`', "versión completa Replicate")
requireText(imageConfig, 'fast: ["gemini", "pollinations", "openrouter", "together", "huggingface"]', "Gemini primero en imagen rápida")
requireText(imageConfig, 'const CURRENT_GEMINI_IMAGE_MODELS = [', "bloque de modelos actuales")
requireText(imageConfig, '"gemini-3.1-flash-image",', "Gemini 3.1 Image primero")
requireText(imageConfig, '"gemini-3.1-flash-lite-image",', "Gemini 3.1 Lite Image")
requireText(imageConfig, '!/^gemini-2\\.5-flash-image', "filtro Gemini 2.5 legacy")

if (credentialRoute.includes("encrypted_secret") || credentialRoute.includes("encryption_iv") || credentialRoute.includes("encryption_tag")) {
  throw new Error("[test-video-personal-marketplace] La API de cuenta referencia campos cifrados directamente; debe delegarlos al vault")
}
if (/NEXT_PUBLIC_(FAL|REPLICATE|HF|HUGGINGFACE).*KEY/i.test(marketplace + personalRoute + vault)) {
  throw new Error("[test-video-personal-marketplace] Se detectó una API key personal con NEXT_PUBLIC")
}
if (/localStorage.*(key|token|secret)/i.test(marketplace)) {
  throw new Error("[test-video-personal-marketplace] No guardar claves personales en localStorage")
}

console.log("[test-video-personal-marketplace] BYOK cifrado, recuperación, presupuestos, reuse, Replicate versionado y Gemini 3.1-first verificados")
