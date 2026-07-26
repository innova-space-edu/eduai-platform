import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_REDIRECTS = 4

function isPrivateIPv4(address: string) {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

function isPrivateIPv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0]
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  )
}

function isPrivateAddress(address: string) {
  const version = isIP(address)
  if (version === 4) return isPrivateIPv4(address)
  if (version === 6) return isPrivateIPv6(address)
  return true
}

export async function assertSafeRemoteUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error("URL inválida")
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Solo se permiten URLs HTTP o HTTPS")
  if (url.username || url.password) throw new Error("La URL no puede incluir credenciales")
  if (url.port && !['80', '443'].includes(url.port)) throw new Error("El puerto de la URL no está permitido")

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "")
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("La dirección local no está permitida")
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("La dirección privada no está permitida")
    return url
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("La URL resuelve a una dirección privada o no segura")
  }

  return url
}

export async function safeRemoteFetch(value: string, init: RequestInit = {}) {
  let current = await assertSafeRemoteUrl(value)

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)",
        Accept: "text/html,application/xhtml+xml",
        ...(init.headers || {}),
      },
    })

    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get("location")
    if (!location) throw new Error("Redirección sin destino")
    current = await assertSafeRemoteUrl(new URL(location, current).toString())
  }

  throw new Error("Demasiadas redirecciones")
}
