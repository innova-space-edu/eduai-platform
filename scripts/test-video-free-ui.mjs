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

console.log("[test-video-free-ui] Video Studio muestra routing automático y errores compactos")
