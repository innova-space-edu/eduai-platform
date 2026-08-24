import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { getRepositoryAdminClient } from "@/lib/repository/public-access"
import {
  createRepositoryCompactPublicAccessToken,
  createRepositoryPublicAccessSlug,
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

function isMissingShortLinkTable(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST205") return true
  const message = String(error.message || "").toLowerCase()
  return message.includes("repository_public_links") && (message.includes("does not exist") || message.includes("schema cache"))
}

async function findExistingSlug(admin: ReturnType<typeof getRepositoryAdminClient>, ownerId: string) {
  const { data, error } = await admin
    .from("repository_public_links")
    .select("slug")
    .eq("owner_id", ownerId)
    .eq("active", true)
    .maybeSingle()

  if (error) {
    // Si la migración aún no existe en producción, el acceso sigue funcionando
    // mediante el token compacto firmado y sin depender de la base de datos.
    if (isMissingShortLinkTable(error)) return null
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
    if (isMissingShortLinkTable(error)) return null
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
  const compactToken = createRepositoryCompactPublicAccessToken(ownerId)
  return new URL(`/nube-publica/${encodeURIComponent(compactToken)}`, request.nextUrl.origin).toString()
}

async function buildActivePublicUrl(request: NextRequest, admin: ReturnType<typeof getRepositoryAdminClient>, ownerId: string) {
  const slug = await getOrCreateShortSlug(admin, ownerId)
  return {
    publicUrl: buildPublicUrl(request, ownerId, slug),
    short: Boolean(slug),
    compactFallback: !slug,
  }
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

    const access = await buildActivePublicUrl(request, result.admin, result.user.id)
    return NextResponse.json({ isAdmin: true, ...access }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (caught) {
    return NextResponse.json({
      isAdmin: false,
      error: caught instanceof Error ? caught.message : "No fue posible preparar el acceso público.",
    }, { status: 500 })
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

    const access = await buildActivePublicUrl(request, result.admin, result.user.id)
    return NextResponse.json(access, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (caught) {
    return NextResponse.json({
      error: caught instanceof Error ? caught.message : "No fue posible crear el acceso público.",
    }, { status: 500 })
  }
}
