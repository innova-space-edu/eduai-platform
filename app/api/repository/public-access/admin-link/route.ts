import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { getRepositoryAdminClient } from "@/lib/repository/public-access"
import {
  createRepositoryPublicAccessSlug,
  createRepositoryPublicAccessToken,
} from "@/lib/repository/public-share"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireRepositoryAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { user: null, admin: null, error: "No autenticado" }

  const admin = getRepositoryAdminClient()
  const { data, error } = await admin
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  if (error || !data) return { user: null, admin: null, error: "Acceso denegado" }
  return { user, admin, error: null }
}

async function findExistingSlug(admin: ReturnType<typeof getRepositoryAdminClient>, ownerId: string) {
  const { data, error } = await admin
    .from("repository_public_links")
    .select("slug")
    .eq("owner_id", ownerId)
    .eq("active", true)
    .maybeSingle()

  if (error) {
    // Compatibilidad temporal antes de aplicar la migración de alias cortos.
    if (error.code === "42P01") return null
    throw error
  }
  return data?.slug ? String(data.slug) : null
}

async function getOrCreateShortSlug(admin: ReturnType<typeof getRepositoryAdminClient>, ownerId: string) {
  const existing = await findExistingSlug(admin, ownerId)
  if (existing) return existing

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = createRepositoryPublicAccessSlug()
    const { data, error } = await admin
      .from("repository_public_links")
      .insert({ slug, owner_id: ownerId, active: true })
      .select("slug")
      .single()

    if (!error && data?.slug) return String(data.slug)
    if (error?.code === "42P01") return null
    if (error?.code === "23505") {
      const raced = await findExistingSlug(admin, ownerId)
      if (raced) return raced
      continue
    }
    throw error
  }

  throw new Error("No fue posible generar un enlace público corto.")
}

function buildPublicUrl(request: NextRequest, ownerId: string, slug: string | null) {
  if (slug) return new URL(`/nube-publica/${encodeURIComponent(slug)}`, request.nextUrl.origin).toString()
  const legacyToken = createRepositoryPublicAccessToken(ownerId)
  return new URL(`/nube-publica/${encodeURIComponent(legacyToken)}`, request.nextUrl.origin).toString()
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireRepositoryAdmin()
    if (!result.user || !result.admin) {
      return NextResponse.json({ isAdmin: false }, {
        status: result.error === "No autenticado" ? 401 : 403,
        headers: { "Cache-Control": "no-store, max-age=0" },
      })
    }

    const slug = await findExistingSlug(result.admin, result.user.id)
    return NextResponse.json({
      isAdmin: true,
      publicUrl: slug ? buildPublicUrl(request, result.user.id, slug) : null,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireRepositoryAdmin()
    if (!result.user || !result.admin) {
      return NextResponse.json({ error: result.error }, {
        status: result.error === "No autenticado" ? 401 : 403,
      })
    }

    const slug = await getOrCreateShortSlug(result.admin, result.user.id)
    const publicUrl = buildPublicUrl(request, result.user.id, slug)

    return NextResponse.json({ publicUrl, short: Boolean(slug) }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (caught) {
    return NextResponse.json({
      error: caught instanceof Error ? caught.message : "No fue posible crear el acceso público.",
    }, { status: 500 })
  }
}
