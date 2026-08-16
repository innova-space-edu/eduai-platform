import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const agent = fs.readFileSync(path.join(root, "lib/video-agent.ts"), "utf8")
const client = fs.readFileSync(path.join(root, "components/video/VideoStudioClient.tsx"), "utf8")

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`[test-video-free-ui] Falta ${label}: ${value}`)
}

requireText(agent, "function compactVideoProviderError", "clasificador de error")
requireText(agent, 'Google Veo sin cuota/billing disponible', "mensaje de cuota Google")
requireText(agent, 'compactVideoProviderError(error, "google")', "Google sin JSON crudo")
requireText(client, "friendlyVideoError", "mensajes amigables")
requireText(client, "friendlyProvider", "nombre amigable del proveedor")
requireText(client, "EduAI reutiliza primero", "mensaje ahorro primero")
requireText(client, "Preferir audio", "audio no garantizado")
requireText(client, "[4, 6, 8].map((seconds) => (", "duraciones compatibles 4/6/8")
requireText(client, "if (value <= 5) return 4", "normalización a 4 segundos")
requireText(client, "if (value <= 7) return 6", "normalización a 6 segundos")

if (client.includes("[2, 4, 6, 8, 10].map((seconds) => (")) {
  throw new Error("[test-video-free-ui] Video Studio todavía expone duraciones 2/10 no compatibles")
}

console.log("[test-video-free-ui] Video Studio muestra routing automático, errores compactos y duraciones 4/6/8")
