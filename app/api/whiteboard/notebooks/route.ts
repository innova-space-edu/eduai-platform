import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { WhiteboardNotebook, WhiteboardPage } from "@/lib/whiteboard/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function text(value: unknown, max: number, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback
}

function cleanPage(value: any, index: number): WhiteboardPage | null {
  if (!value || !UUID.test(value.id)) return null
  const now = new Date().toISOString()
  return {
    id: value.id,
    title: text(value.title, 160, `Página ${index + 1}`),
    strokes: Array.isArray(value.strokes) ? value.strokes.slice(0, 900) : [],
    blocks: Array.isArray(value.blocks) ? value.blocks.slice(0, 80) : [],
    activeBlockId: typeof value.activeBlockId === "string" ? value.activeBlockId.slice(0, 120) : null,
    canvasHeight: Number.isFinite(value.canvasHeight) ? Math.max(400, Math.min(20000, Math.round(value.canvasHeight))) : 1200,
    createdAt: text(value.createdAt, 80, now),
    updatedAt: text(value.updatedAt, 80, now),
  }
}

function cleanNotebook(value: any): WhiteboardNotebook | null {
  if (!value || !UUID.test(value.id)) return null
  const pages = Array.isArray(value.pages)
    ? value.pages.map(cleanPage).filter((page: WhiteboardPage | null): page is WhiteboardPage => Boolean(page)).slice(0, 80)
    : []
  if (!pages.length) return null
  const now = new Date().toISOString()
  return {
    id: value.id,
    title: text(value.title, 240, "Cuaderno sin título"),
    pages,
    activePageId: UUID.test(value.activePageId) && pages.some((page) => page.id === value.activePageId) ? value.activePageId : pages[0].id,
    createdAt: text(value.createdAt, 80, now),
    updatedAt: now,
  }
}

async function upsertNotebook(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, notebook: WhiteboardNotebook) {
  const { error: notebookError } = await supabase.from("whiteboard_notebooks").upsert({
    id: notebook.id,
    user_id: userId,
    title: notebook.title,
    active_page_id: notebook.activePageId,
    settings: {},
    created_at: notebook.createdAt,
    updated_at: notebook.updatedAt,
  }, { onConflict: "id" })
  if (notebookError) throw notebookError

  const pageRows = notebook.pages.map((page, index) => ({
    id: page.id,
    notebook_id: notebook.id,
    user_id: userId,
    title: page.title,
    page_order: index,
    strokes: page.strokes,
    blocks: page.blocks,
    active_block_id: page.activeBlockId,
    canvas_height: page.canvasHeight,
    created_at: page.createdAt,
    updated_at: page.updatedAt,
  }))
  const { error: pagesError } = await supabase.from("whiteboard_pages").upsert(pageRows, { onConflict: "id" })
  if (pagesError) throw pagesError

  const keepIds = notebook.pages.map((page) => page.id)
  const { data: existing } = await supabase.from("whiteboard_pages").select("id").eq("notebook_id", notebook.id)
  const removeIds = (existing || []).map((row) => row.id).filter((id) => !keepIds.includes(id))
  if (removeIds.length) {
    const { error: deleteError } = await supabase.from("whiteboard_pages").delete().in("id", removeIds)
    if (deleteError) throw deleteError
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: NO_CACHE })

    const { data, error } = await supabase
      .from("whiteboard_notebooks")
      .select("id,title,active_page_id,created_at,updated_at,whiteboard_pages(id)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(60)
    if (error) throw error

    return NextResponse.json({
      notebooks: (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        activePageId: item.active_page_id,
        pageCount: Array.isArray(item.whiteboard_pages) ? item.whiteboard_pages.length : 0,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[whiteboard/notebooks/get]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible cargar los cuadernos." }, { status: 500, headers: NO_CACHE })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: NO_CACHE })
    const body = await request.json()
    const notebook = cleanNotebook(body?.notebook)
    if (!notebook) return NextResponse.json({ error: "El cuaderno no tiene un formato válido." }, { status: 400, headers: NO_CACHE })
    await upsertNotebook(supabase, user.id, notebook)
    return NextResponse.json({ notebook: { ...notebook, cloudSyncedAt: new Date().toISOString() } }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[whiteboard/notebooks/post]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible guardar el cuaderno." }, { status: 500, headers: NO_CACHE })
  }
}
