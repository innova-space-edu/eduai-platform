import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createRepositoryShareToken } from "@/lib/repository/public-share"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para compartir materiales." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const itemId = typeof body?.itemId === "string" ? body.itemId.trim() : ""
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) {
    return NextResponse.json({ error: "El material seleccionado no es válido." }, { status: 400 })
  }

  const { data: item, error } = await supabase
    .from("repository_items")
    .select("id,title")
    .eq("id", itemId)
    .eq("visibility", "public")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "No fue posible verificar el material." }, { status: 500 })
  }
  if (!item) {
    return NextResponse.json({ error: "El material ya no está disponible." }, { status: 404 })
  }

  try {
    const token = createRepositoryShareToken(item.id)
    const shareUrl = new URL(`/nube/${encodeURIComponent(token)}`, request.nextUrl.origin).toString()
    return NextResponse.json({ shareUrl, title: item.title }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (caught) {
    return NextResponse.json({
      error: caught instanceof Error ? caught.message : "No fue posible crear el enlace compartido.",
    }, { status: 500 })
  }
}
