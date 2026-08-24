import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const agentPath = path.join(root, "lib/video-agent.ts")
const clientPath = path.join(root, "components/video/VideoStudioClient.tsx")

for (const target of [agentPath, clientPath]) {
  if (!fs.existsSync(target)) throw new Error(`[video-free-ui] No se encontró ${target}`)
}

let agent = fs.readFileSync(agentPath, "utf8")
let client = fs.readFileSync(clientPath, "utf8")
let changed = false

const processMarker = "export async function processVideoJob("
if (!agent.includes("function compactVideoProviderError(")) {
  const index = agent.indexOf(processMarker)
  if (index < 0) throw new Error("[video-free-ui] No se encontró processVideoJob")
  const helper = `function compactVideoProviderError(error: unknown, provider: string) {
  const message = error instanceof Error ? error.message : String(error || "")
  if (/429|RESOURCE_EXHAUSTED|quota|billing/i.test(message)) {
    return provider === "google"
      ? "Google Veo sin cuota/billing disponible"
      : "cuota del proveedor agotada"
  }
  if (/401|403|unauthorized|forbidden|api.?key/i.test(message)) return "credenciales no válidas o sin permiso"
  if (/timeout|timed out|abort/i.test(message)) return "tiempo de espera agotado"
  return message.replace(/\s+/g, " ").slice(0, 320)
}

`
  agent = agent.slice(0, index) + helper + agent.slice(index)
  changed = true
}

const oldGoogleError = 'errors.push(`google: ${error instanceof Error ? error.message : String(error)}`)'
const newGoogleError = 'errors.push(`google: ${compactVideoProviderError(error, "google")}`)'
if (agent.includes(oldGoogleError)) {
  agent = agent.replace(oldGoogleError, newGoogleError)
  changed = true
}

const oldFinalError = 'error: `No se pudo iniciar la generación de video. ${errors.join(" | ")}`,'
const newFinalError = 'error: `No se pudo generar el video con los proveedores disponibles. ${errors.join(" | ")}`,'
if (agent.includes(oldFinalError)) {
  agent = agent.replace(oldFinalError, newFinalError)
  changed = true
}

if (!client.includes("function friendlyVideoError(")) {
  const marker = "function normalizeDuration(value: number) {"
  const index = client.indexOf(marker)
  if (index < 0) throw new Error("[video-free-ui] No se encontró normalizeDuration del cliente")
  const helper = `function friendlyProvider(value: string | null) {
  if (value === "wan") return "WAN"
  if (value === "hf-gradio") return "Hugging Face"
  if (value === "hf-space") return "HF Space"
  if (value === "google") return "Google Veo"
  return value || "Automático"
}

function friendlyVideoError(value: string) {
  if (/429|RESOURCE_EXHAUSTED|quota|billing/i.test(value)) {
    return "El proveedor premium no tiene cuota disponible. EduAI usará otro proveedor cuando esté configurado."
  }
  if (/credenciales no válidas|401|403|unauthorized|forbidden/i.test(value)) {
    return "El proveedor seleccionado no tiene credenciales válidas. Revisa Model Lab o configura otro proveedor."
  }
  return value.length > 700 ? value.slice(0, 700) + "…" : value
}

`
  client = client.slice(0, index) + helper + client.slice(index)
  changed = true
}

const oldNormalizeDuration = `function normalizeDuration(value: number) {
  if (value < 2) return 2
  if (value > 10) return 10
  return Math.round(value)
}`
const compatibleNormalizeDuration = `function normalizeDuration(value: number) {
  if (value <= 5) return 4
  if (value <= 7) return 6
  return 8
}`
if (client.includes(oldNormalizeDuration)) {
  client = client.replace(oldNormalizeDuration, compatibleNormalizeDuration)
  changed = true
}

if (client.includes("[2, 4, 6, 8, 10].map((seconds) => (")) {
  client = client.replace("[2, 4, 6, 8, 10].map((seconds) => (", "[4, 6, 8].map((seconds) => (")
  changed = true
}

const oldDescription = "Genera videos con cola de trabajos. Modo actual: texto a video e imagen a video."
const newDescription = "Genera videos con cola de trabajos. EduAI reutiliza primero y selecciona proveedor automáticamente priorizando ahorro."
if (client.includes(oldDescription)) {
  client = client.replace(oldDescription, newDescription)
  changed = true
}

if (client.includes("                  Incluir audio")) {
  client = client.replace("                  Incluir audio", "                  Preferir audio")
  changed = true
}

if (client.includes('{provider ?? "—"}')) {
  client = client.replace('{provider ?? "—"}', '{friendlyProvider(provider)}')
  changed = true
}

client = client.replace(
  'setErrorMessage(data.errorMessage ?? null)',
  'setErrorMessage(data.errorMessage ? friendlyVideoError(data.errorMessage) : null)',
)
client = client.replaceAll('setErrorMessage(message)', 'setErrorMessage(friendlyVideoError(message))')

if (changed) {
  fs.writeFileSync(agentPath, agent)
  fs.writeFileSync(clientPath, client)
  console.log("[video-free-ui] errores compactos + interfaz ahorro primero aplicados")
} else {
  console.log("[video-free-ui] ya aplicado")
}
