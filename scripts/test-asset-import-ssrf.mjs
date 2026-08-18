import fs from "node:fs"
import path from "node:path"

const guard = fs.readFileSync(path.join(process.cwd(), "lib/security/public-http-url.ts"), "utf8")
const route = fs.readFileSync(path.join(process.cwd(), "app/api/assets/import/route.ts"), "utf8")

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`[test-asset-import-ssrf] Falta ${label}: ${value}`)
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
requireText(route, 'redirect: "manual"', "redirect manual")
requireText(route, "await assertPublicRemoteUrl(currentUrl)", "validación en cada salto")
requireText(route, "response.body.getReader()", "lectura streaming")
requireText(route, "if (total > MAX_BYTES)", "corte temprano por tamaño")

if (route.includes('redirect: "follow"')) {
  throw new Error("[test-asset-import-ssrf] No se debe seguir redirects sin revalidar el destino")
}
if (route.includes("response.arrayBuffer()")) {
  throw new Error("[test-asset-import-ssrf] No se debe cargar el cuerpo completo antes de aplicar el límite")
}

console.log("[test-asset-import-ssrf] importación remota con guard SSRF y límite streaming verificada")
