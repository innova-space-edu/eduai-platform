import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(path, "utf8")
const flags = read("lib/video/maintenance.ts")
assert.match(flags, /VIDEO_STUDIO_MAINTENANCE = true/)
const page = read("app/video-studio/page.tsx")
assert.match(page, /En mantenimiento/)
assert.doesNotMatch(page, /<VideoStudioClient|<PaymentReturnReconciler/)
const card = read("app/agentes/page.tsx").split('id: "video-studio"')[1].split('id: "galeria"')[0]
assert.match(card, /status: "maintenance"/)
for (const path of [
  "app/api/agents/video/route.ts",
  "app/api/agents/video/personal/route.ts",
  "app/api/agents/video/process/route.ts",
  "app/api/video/models/route.ts",
  "app/api/video/quote/route.ts",
  "app/api/credits/orders/route.ts",
  "app/api/credits/mercadopago/payment/route.ts",
]) assert.match(read(path), /if \(VIDEO_STUDIO_MAINTENANCE\)/, path)
for (const path of [
  "app/api/agents/video/status/[jobId]/route.ts",
  "app/api/agents/video/personal/status/[jobId]/route.ts",
]) assert.match(read(path), /!VIDEO_STUDIO_MAINTENANCE|VIDEO_STUDIO_MAINTENANCE \? loadedJob/, path)
const billing = read("lib/credits/server.ts")
assert.match(billing, /paymentsEnabled: data\?\.payments_enabled === true && !VIDEO_STUDIO_MAINTENANCE/)
assert.match(billing, /premiumVideoEnabled: data\?\.premium_video_enabled === true && !VIDEO_STUDIO_MAINTENANCE/)
const guard = read("scripts/apply-agent-library-repository-cards.mjs")
assert.match(guard, /Video Studio debe permanecer en mantenimiento/)
console.log("[video-maintenance] Interfaz, agentes, APIs, pagos y estados protegidos")
