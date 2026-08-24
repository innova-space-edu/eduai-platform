import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim()
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Asset inválido" }, { status: 400 })
  }

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Storage no configurado" }, { status: 503 })
  }

  const { data: asset, error } = await admin
    .from("eduai_assets")
    .select("id,mime_type,storage_bucket,storage_path,visibility,deleted_at,source_module")
    .eq("id", id)
    .maybeSingle()

  if (error || !asset || asset.deleted_at) {
    return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 })
  }

  // Las imágenes importadas para exámenes se almacenan en bucket privado. Este
  // endpoint solo expone assets marcados explícitamente como compartidos/públicos.
  // El UUID actúa como identificador opaco y nunca se acepta una ruta arbitraria.
  if (!["shared", "public"].includes(String(asset.visibility || ""))) {
    return NextResponse.json({ error: "Imagen no disponible" }, { status: 404 })
  }

  if (!asset.storage_bucket || !asset.storage_path) {
    return NextResponse.json({ error: "Asset sin archivo" }, { status: 404 })
  }

  const { data: blob, error: downloadError } = await admin.storage
    .from(asset.storage_bucket)
    .download(asset.storage_path)

  if (downloadError || !blob) {
    return NextResponse.json({ error: "No se pudo cargar la imagen" }, { status: 404 })
  }

  return new NextResponse(await blob.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": asset.mime_type || blob.type || "application/octet-stream",
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'none'; sandbox",
    },
  })
}
