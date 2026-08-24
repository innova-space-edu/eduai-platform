import "server-only"

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { parseRepositoryPublicAccessToken } from "@/lib/repository/public-share"

const SHORT_PUBLIC_ACCESS_PATTERN = /^[A-Za-z0-9_-]{10,24}$/

export function isRepositoryPublicAccessSlug(value: string) {
  return SHORT_PUBLIC_ACCESS_PATTERN.test(value)
}

export function getRepositoryAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase administrativo no está configurado")
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function resolveOwnerId(token: string) {
  const decoded = decodeURIComponent(token).trim()
  const legacyOwnerId = parseRepositoryPublicAccessToken(decoded)
  if (legacyOwnerId) return legacyOwnerId
  if (!isRepositoryPublicAccessSlug(decoded)) return null

  const admin = getRepositoryAdminClient()
  const { data, error } = await admin
    .from("repository_public_links")
    .select("owner_id")
    .eq("slug", decoded)
    .eq("active", true)
    .maybeSingle()

  if (error || !data?.owner_id) return null
  return String(data.owner_id)
}

export async function validateRepositoryPublicAccess(token: string) {
  const ownerId = await resolveOwnerId(token)
  if (!ownerId) return null

  const admin = getRepositoryAdminClient()
  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(ownerId)
  const email = userResult.user?.email
  if (userError || !email) return null

  const { data: adminEmail, error: adminError } = await admin
    .from("admin_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle()

  if (adminError || !adminEmail) return null
  return { admin, ownerId }
}
