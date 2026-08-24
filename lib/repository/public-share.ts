import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const TOKEN_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32})$/i
const PUBLIC_ACCESS_PATTERN = /^public\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{40})$/i
const COMPACT_PUBLIC_ACCESS_PATTERN = /^p_([A-Za-z0-9_-]{32})$/

function getShareSecret() {
  const secret = process.env.REPOSITORY_SHARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Los enlaces compartidos de Nube EduAI no están configurados")
  return secret
}

function signatureFor(itemId: string) {
  return createHmac("sha256", getShareSecret())
    .update(`nube-eduai:${itemId}`)
    .digest("base64url")
    .slice(0, 32)
}

function publicAccessSignatureFor(ownerId: string) {
  return createHmac("sha256", getShareSecret())
    .update(`nube-eduai:public-access:${ownerId}`)
    .digest("base64url")
    .slice(0, 40)
}

function compactMask() {
  return createHmac("sha256", getShareSecret())
    .update("nube-eduai:public-access-compact-mask:v1")
    .digest()
    .subarray(0, 16)
}

function compactTag(payload: Buffer) {
  return createHmac("sha256", getShareSecret())
    .update("nube-eduai:public-access-compact:v1:")
    .update(payload)
    .digest()
    .subarray(0, 8)
}

function uuidToBytes(uuid: string) {
  const hex = uuid.replace(/-/g, "")
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error("Identificador de acceso público no válido")
  return Buffer.from(hex, "hex")
}

function bytesToUuid(bytes: Buffer) {
  if (bytes.length !== 16) return null
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createRepositoryShareToken(itemId: string) {
  return `${itemId}.${signatureFor(itemId)}`
}

export function parseRepositoryShareToken(token: string) {
  const match = TOKEN_PATTERN.exec(token)
  if (!match) return null

  const itemId = match[1].toLowerCase()
  const supplied = Buffer.from(match[2])
  const expected = Buffer.from(signatureFor(itemId))
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null

  return itemId
}

// Compatibilidad con enlaces públicos largos ya entregados.
export function createRepositoryPublicAccessToken(ownerId: string) {
  return `public.${ownerId}.${publicAccessSignatureFor(ownerId)}`
}

export function parseRepositoryPublicAccessToken(token: string) {
  const match = PUBLIC_ACCESS_PATTERN.exec(token)
  if (!match) return null

  const ownerId = match[1].toLowerCase()
  const supplied = Buffer.from(match[2])
  const expected = Buffer.from(publicAccessSignatureFor(ownerId))
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null

  return ownerId
}

// Enlace compacto sin dependencia de una tabla adicional. El UUID se ofusca con una
// máscara derivada del secreto y se autentica con HMAC truncado antes de recuperarlo.
export function createRepositoryCompactPublicAccessToken(ownerId: string) {
  const ownerBytes = uuidToBytes(ownerId)
  const mask = compactMask()
  const payload = Buffer.alloc(16)
  for (let index = 0; index < 16; index += 1) payload[index] = ownerBytes[index] ^ mask[index]
  const packed = Buffer.concat([payload, compactTag(payload)])
  return `p_${packed.toString("base64url")}`
}

export function parseRepositoryCompactPublicAccessToken(token: string) {
  const match = COMPACT_PUBLIC_ACCESS_PATTERN.exec(token)
  if (!match) return null

  let packed: Buffer
  try {
    packed = Buffer.from(match[1], "base64url")
  } catch {
    return null
  }
  if (packed.length !== 24) return null

  const payload = packed.subarray(0, 16)
  const suppliedTag = packed.subarray(16)
  const expectedTag = compactTag(payload)
  if (suppliedTag.length !== expectedTag.length || !timingSafeEqual(suppliedTag, expectedTag)) return null

  const mask = compactMask()
  const ownerBytes = Buffer.alloc(16)
  for (let index = 0; index < 16; index += 1) ownerBytes[index] = payload[index] ^ mask[index]
  return bytesToUuid(ownerBytes)
}

// 12 caracteres base64url ~= 72 bits de entropía. El alias se guarda server-side,
// por lo que no expone el UUID del administrador ni la firma HMAC del enlace legado.
export function createRepositoryPublicAccessSlug() {
  return randomBytes(9).toString("base64url")
}
