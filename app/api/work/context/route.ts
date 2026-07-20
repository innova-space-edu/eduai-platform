import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const notebookId = request.nextUrl.searchParams.get("notebookId")
  if (!notebookId) return NextResponse.json({ error: "notebookId requerido" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id")
    .eq("id", notebookId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!notebook) return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 })

  const [sourcesResult, outputsResult] = await Promise.all([
    supabase
      .from("notebook_sources")
      .select("id, notebook_id, type, title, url, file_path, metadata, is_active, status, error_message, created_at")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false }),
    supabase
      .from("notebook_outputs")
      .select("id, notebook_id, format, title, output_json, version, created_at, updated_at")
      .eq("notebook_id", notebookId)
      .order("updated_at", { ascending: false })
      .limit(30),
  ])

  if (sourcesResult.error) return NextResponse.json({ error: sourcesResult.error.message }, { status: 500 })
  if (outputsResult.error) return NextResponse.json({ error: outputsResult.error.message }, { status: 500 })

  return NextResponse.json({
    sources: sourcesResult.data ?? [],
    outputs: outputsResult.data ?? [],
  })
}
