import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; sourceId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id, sourceId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: notebook } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (!notebook) return NextResponse.json({ error: "Cuaderno no encontrado" }, { status: 404 })

    const { data: source, error } = await supabase
      .from("notebook_sources")
      .select("id, notebook_id, type, title, url, raw_text, extracted_text, metadata, is_active, status, error_message, created_at")
      .eq("id", sourceId)
      .eq("notebook_id", id)
      .single()

    if (error || !source) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 })
    return NextResponse.json({ source })
  } catch (error) {
    console.error("[Source detail]", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
