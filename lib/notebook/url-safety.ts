import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase().split("%")[0]
  if (value === "::" || value === "::1") return true
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) {
    return true
  }
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length)
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true
  }
  return false
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateIpv4(address)
  if (version === 6) return isPrivateIpv6(address)
  return true
}

export function isBlockedHostname(hostname: string): boolean {
  const value = hostname.toLowerCase().replace(/\.$/, "")
  return (
    value === "localhost" ||
    value.endsWith(".localhost") ||
    value.endsWith(".local") ||
    value.endsWith(".internal") ||
    value === "metadata.google.internal"
  )
}

export async function assertPublicHttpUrl(input: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error("URL inválida")
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Solo se permiten enlaces HTTP o HTTPS")
  }
  if (url.username || url.password) {
    throw new Error("El enlace no puede incluir credenciales")
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("El dominio indicado no es público")
  }

  if (isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) throw new Error("La dirección indicada no es pública")
    return url
  }

  let addresses: Array<{ address: string }> = []
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true })
  } catch {
    throw new Error("No fue posible resolver el dominio")
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("El dominio resuelve a una dirección no permitida")
  }

  return url
}
