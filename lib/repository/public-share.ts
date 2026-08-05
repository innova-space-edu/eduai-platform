import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

const TOKEN_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32})$/i

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
