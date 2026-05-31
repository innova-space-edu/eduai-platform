import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Params = { params: Promise<{ shortCode: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { shortCode } = await params
  const supabase = await createClient()

  const { data: resource, error } = await supabase
    .from("qr_resources")
    .select("id, short_code, title, description, resource_type, target_url, text_content, notebook_id, creator_project_id, asset_id, visibility, expires_at, scan_count, created_at")
    .eq("short_code", shortCode.toUpperCase())
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!resource) return NextResponse.json({ error: "Recurso no encontrado, privado o vencido" }, { status: 404 })

  await supabase.rpc("record_qr_scan", { p_short_code: resource.short_code })

  return NextResponse.json({ resource })
}
