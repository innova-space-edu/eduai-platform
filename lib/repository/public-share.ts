import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const TOKEN_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32})$/i
const PUBLIC_ACCESS_PATTERN = /^public\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{40})$/i

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

// 12 caracteres base64url ~= 72 bits de entropía. El alias se guarda server-side,
// por lo que no expone el UUID del administrador ni la firma HMAC del enlace legado.
export function createRepositoryPublicAccessSlug() {
  return randomBytes(9).toString("base64url")
}
