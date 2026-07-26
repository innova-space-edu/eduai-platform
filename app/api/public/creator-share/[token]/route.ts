import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEADERS = { "Cache-Control": "no-store, max-age=0" }

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "Enlace inválido." }, { status: 400, headers: HEADERS })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("creator_hub_shared_project", { p_token: token })
  if (error) {
    const message = error.code === "42883"
      ? "Falta aplicar la migración de colaboración en Supabase."
      : "No fue posible abrir el proyecto compartido."
    return NextResponse.json({ error: message }, { status: 500, headers: HEADERS })
  }

  const project = Array.isArray(data) ? data[0] : data
  if (!project) return NextResponse.json({ error: "El enlace no existe, está desactivado o expiró." }, { status: 404, headers: HEADERS })
  return NextResponse.json({ project }, { headers: HEADERS })
}
