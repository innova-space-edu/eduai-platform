import "server-only"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map((value) => Number(value))
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true
  }

  const [a, b, c] = parts
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true
  if (a === 192 && b === 88 && c === 99) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 198 && b === 51 && c === 100) return true
  if (a === 203 && b === 0 && c === 113) return true
  return false
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0]
  if (normalized === "::" || normalized === "::1") return true
  if (normalized.startsWith("::ffff:")) return true
  if (/^f[cd]/.test(normalized)) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith("ff")) return true
  if (normalized.startsWith("2001:db8")) return true

  // Conservador: para URLs literales IPv6 solo aceptamos global unicast 2000::/3.
  const firstGroup = normalized.split(":")[0]
  const first = Number.parseInt(firstGroup, 16)
  return !Number.isFinite(first) || first < 0x2000 || first > 0x3fff
}

export function isBlockedRemoteAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, "").toLowerCase().split("%")[0]
  const family = isIP(normalized)
  if (family === 4) return isBlockedIpv4(normalized)
  if (family === 6) return isBlockedIpv6(normalized)
  return true
}

export async function assertPublicRemoteUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Solo se permiten URLs HTTP/HTTPS")
  }
  if (url.username || url.password) {
    throw new Error("La URL no puede contener credenciales")
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("No se permiten destinos locales")
  }

  if (isIP(hostname)) {
    if (isBlockedRemoteAddress(hostname)) {
      throw new Error("No se permiten direcciones IP privadas, locales o reservadas")
    }
    return
  }

  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error("No se pudo resolver el host remoto")
  }

  if (!addresses.length) throw new Error("El host remoto no tiene direcciones resolubles")
  if (addresses.some(({ address }) => isBlockedRemoteAddress(address))) {
    throw new Error("El host remoto resuelve a una red privada, local o reservada")
  }
}
