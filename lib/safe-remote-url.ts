import "server-only"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_REDIRECTS = 4

function isPrivateIPv4(address: string) {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b, c] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

function isPrivateIPv6(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]
  if (normalized === "::" || normalized === "::1") return true
  if (normalized.startsWith("::ffff:")) return true
  if (/^f[cd]/.test(normalized)) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith("ff")) return true
  if (normalized.startsWith("2001:db8")) return true

  // Para literales IPv6 se acepta únicamente global-unicast 2000::/3.
  const firstGroup = normalized.split(":")[0]
  const first = Number.parseInt(firstGroup, 16)
  return !Number.isFinite(first) || first < 0x2000 || first > 0x3fff
}

function isPrivateAddress(address: string) {
  const normalized = address.replace(/^\[|\]$/g, "").split("%")[0]
  const version = isIP(normalized)
  if (version === 4) return isPrivateIPv4(normalized)
  if (version === 6) return isPrivateIPv6(normalized)
  return true
}

export async function assertSafeRemoteUrl(value: string | URL) {
  let url: URL
  try {
    url = value instanceof URL ? new URL(value.toString()) : new URL(value)
  } catch {
    throw new Error("URL inválida")
  }

  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Solo se permiten URLs HTTP o HTTPS")
  if (url.username || url.password) throw new Error("La URL no puede incluir credenciales")
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("El puerto de la URL no está permitido")

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "")
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("La dirección local no está permitida")
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("La dirección privada, local o reservada no está permitida")
    return url
  }

  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error("No se pudo resolver el host remoto")
  }

  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("La URL resuelve a una dirección privada, local, reservada o no segura")
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
    current = await assertSafeRemoteUrl(new URL(location, current))
  }

  throw new Error("Demasiadas redirecciones")
}

async function readCappedBody(response: Response, maxBytes: number) {
  if (!response.body) throw new Error("El recurso remoto no tiene contenido")

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue

      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel("EduAI remote resource size limit").catch(() => undefined)
        throw new Error("El recurso remoto supera el límite permitido")
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }

  if (!total) throw new Error("El recurso remoto está vacío")
  return Buffer.concat(chunks, total)
}

export async function fetchSafeRemoteBytes(input: {
  url: string | URL
  maxBytes: number
  timeoutMs: number
  maxRedirects?: number
  userAgent?: string
}) {
  if (!Number.isFinite(input.maxBytes) || input.maxBytes <= 0) throw new Error("Límite remoto inválido")
  const maxRedirects = Number.isFinite(input.maxRedirects)
    ? Math.max(0, Math.min(10, Math.floor(input.maxRedirects as number)))
    : MAX_REDIRECTS
  let current = await assertSafeRemoteUrl(input.url)

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(input.timeoutMs),
      headers: input.userAgent ? { "User-Agent": input.userAgent } : undefined,
      cache: "no-store",
    })

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location")
      if (!location) throw new Error("Redirección sin destino")
      if (redirects >= maxRedirects) throw new Error("Demasiadas redirecciones")
      current = await assertSafeRemoteUrl(new URL(location, current))
      continue
    }

    if (!response.ok) throw new Error(`El recurso respondió HTTP ${response.status}`)

    const declared = Number(response.headers.get("content-length") || 0)
    if (Number.isFinite(declared) && declared > input.maxBytes) {
      throw new Error("El recurso remoto supera el límite permitido")
    }

    const buffer = await readCappedBody(response, input.maxBytes)
    return {
      buffer,
      mimeType: response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream",
      finalUrl: current.toString(),
    }
  }

  throw new Error("No se pudo resolver el recurso remoto")
}
