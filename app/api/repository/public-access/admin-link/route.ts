import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createRepositoryPublicAccessToken } from "@/lib/repository/public-share"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase administrativo no está configurado")
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireRepositoryAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { user: null, error: "No autenticado" }

  const admin = getAdminClient()
  const { data, error } = await admin
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  if (error || !data) return { user: null, error: "Acceso denegado" }
  return { user, error: null }
}

export async function GET() {
  try {
    const result = await requireRepositoryAdmin()
    if (!result.user) {
      return NextResponse.json({ isAdmin: false }, {
        status: result.error === "No autenticado" ? 401 : 403,
        headers: { "Cache-Control": "no-store, max-age=0" },
      })
    }

    return NextResponse.json({ isAdmin: true }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireRepositoryAdmin()
    if (!result.user) {
      return NextResponse.json({ error: result.error }, {
        status: result.error === "No autenticado" ? 401 : 403,
      })
    }

    const token = createRepositoryPublicAccessToken(result.user.id)
    const publicUrl = new URL(`/nube-publica/${encodeURIComponent(token)}`, request.nextUrl.origin).toString()

    return NextResponse.json({ publicUrl }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (caught) {
    return NextResponse.json({
      error: caught instanceof Error ? caught.message : "No fue posible crear el acceso público.",
    }, { status: 500 })
  }
}
