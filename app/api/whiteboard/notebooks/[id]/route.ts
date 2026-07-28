import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RouteContext = { params: Promise<{ id: string }> }

async function authenticated() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!UUID.test(id)) return NextResponse.json({ error: "Identificador inválido." }, { status: 400, headers: NO_CACHE })
    const { supabase, user } = await authenticated()
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: NO_CACHE })

    const { data: notebook, error } = await supabase
      .from("whiteboard_notebooks")
      .select("id,title,active_page_id,settings,created_at,updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (error) throw error
    if (!notebook) return NextResponse.json({ error: "Cuaderno no encontrado." }, { status: 404, headers: NO_CACHE })

    const { data: pages, error: pagesError } = await supabase
      .from("whiteboard_pages")
      .select("id,title,page_order,strokes,blocks,active_block_id,canvas_height,created_at,updated_at")
      .eq("notebook_id", id)
      .eq("user_id", user.id)
      .order("page_order", { ascending: true })
    if (pagesError) throw pagesError

    return NextResponse.json({
      notebook: {
        id: notebook.id,
        title: notebook.title,
        folder: typeof notebook.settings?.folder === "string" && notebook.settings.folder.trim() ? notebook.settings.folder.trim() : "Mis cuadernos",
        activePageId: notebook.active_page_id,
        pages: (pages || []).map((page) => ({
          id: page.id,
          title: page.title,
          strokes: page.strokes || [],
          blocks: page.blocks || [],
          activeBlockId: page.active_block_id,
          canvasHeight: page.canvas_height,
          createdAt: page.created_at,
          updatedAt: page.updated_at,
        })),
        createdAt: notebook.created_at,
        updatedAt: notebook.updated_at,
        cloudSyncedAt: new Date().toISOString(),
      },
    }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[whiteboard/notebooks/id/get]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible abrir el cuaderno." }, { status: 500, headers: NO_CACHE })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!UUID.test(id)) return NextResponse.json({ error: "Identificador inválido." }, { status: 400, headers: NO_CACHE })
    const { supabase, user } = await authenticated()
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: NO_CACHE })
    const { error } = await supabase.from("whiteboard_notebooks").delete().eq("id", id).eq("user_id", user.id)
    if (error) throw error
    return NextResponse.json({ deleted: true }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[whiteboard/notebooks/id/delete]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible eliminar el cuaderno." }, { status: 500, headers: NO_CACHE })
  }
}
