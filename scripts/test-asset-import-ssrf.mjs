import fs from "node:fs"
import path from "node:path"

const guardPath = path.join(process.cwd(), "lib/safe-remote-url.ts")
const duplicateGuardPath = path.join(process.cwd(), "lib/security/public-http-url.ts")
const guard = fs.readFileSync(guardPath, "utf8")
const route = fs.readFileSync(path.join(process.cwd(), "app/api/assets/import/route.ts"), "utf8")
const video = fs.readFileSync(path.join(process.cwd(), "lib/video/persist-remote-video.ts"), "utf8")

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`[test-asset-import-ssrf] Falta ${label}: ${value}`)
}

if (fs.existsSync(duplicateGuardPath)) {
  throw new Error("[test-asset-import-ssrf] No debe existir un segundo helper SSRF duplicado")
}

requireText(guard, 'from "node:dns/promises"', "resolución DNS server-side")
requireText(guard, 'from "node:net"', "clasificación de IP")
requireText(guard, 'hostname === "localhost"', "bloqueo localhost")
requireText(guard, "a === 10", "bloqueo RFC1918 10/8")
requireText(guard, "a === 169 && b === 254", "bloqueo link-local/metadata IPv4")
requireText(guard, "a === 172 && b >= 16 && b <= 31", "bloqueo RFC1918 172.16/12")
requireText(guard, "a === 192 && b === 168", "bloqueo RFC1918 192.168/16")
requireText(guard, 'normalized === "::1"', "bloqueo loopback IPv6")
requireText(guard, 'normalized.startsWith("::ffff:")', "bloqueo IPv4-mapped IPv6")
requireText(guard, "addresses.some", "bloqueo de dominios que resuelven a IP privada")
requireText(guard, 'redirect: "manual"', "redirect manual centralizado")
requireText(guard, "await assertSafeRemoteUrl(new URL(location, current))", "validación en cada salto")
requireText(guard, "response.body.getReader()", "lectura streaming")
requireText(guard, "if (total > maxBytes)", "corte temprano por tamaño")
requireText(route, "fetchSafeRemoteBytes({", "Asset Import usa descarga pública endurecida")
requireText(video, "fetchSafeRemoteBytes({", "Video Studio usa descarga pública endurecida")
requireText(video, 'mimeType !== "application/octet-stream" && mimeType !== "video/mp4"', "MP4 validado")

for (const [source, label] of [[route, "Asset Import"], [video, "Video Studio"]]) {
  if (source.includes('redirect: "follow"')) {
    throw new Error(`[test-asset-import-ssrf] ${label} no debe seguir redirects sin revalidar`)
  }
  if (source.includes("response.arrayBuffer()")) {
    throw new Error(`[test-asset-import-ssrf] ${label} no debe cargar el cuerpo completo antes del límite`)
  }
}

console.log("[test-asset-import-ssrf] Creator URL, Asset Import y Video Studio comparten un único guard SSRF")
