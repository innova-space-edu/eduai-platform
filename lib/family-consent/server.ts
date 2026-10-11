import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createHash, randomBytes } from "node:crypto"

export function createFamilyAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("Family authorization storage is not configured")
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: sha256(token) }
}

export function validToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(value)
}

export function safeText(value: unknown, max = 160): string {
  if (typeof value !== "string") return ""
  return value.trim().replace(/\s+/g, " ").slice(0, max)
}

export function privateResponse(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export function safeEmail(value: unknown): string {
  const email = safeText(value, 254).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}
