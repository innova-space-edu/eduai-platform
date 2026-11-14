import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { createClient as createSessionClient } from "@/lib/supabase/server"
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

export async function POST(request: NextRequest) {
  const session = await createSessionClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: "Storage no configurado" }, { status: 503 })
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Imagen requerida, máximo 4 MB" }, { status: 400 })
  const bytes = Buffer.from(await file.arrayBuffer())
  const mime = file.type
  const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const gif = ["GIF87a","GIF89a"].includes(bytes.subarray(0,6).toString("ascii"))
  const webp = bytes.subarray(0,4).toString("ascii") === "RIFF" && bytes.subarray(8,12).toString("ascii") === "WEBP"
  const ext = mime === "image/png" && png ? "png" : mime === "image/jpeg" && jpeg ? "jpg" : mime === "image/gif" && gif ? "gif" : mime === "image/webp" && webp ? "webp" : ""
  if (!ext) return NextResponse.json({ error: "Formato de imagen no permitido" }, { status: 415 })
  const storagePath = `${user.id}/exam-manual/${randomUUID()}.${ext}`
  const upload = await admin.storage.from("eduai-assets").upload(storagePath, bytes, { contentType: mime, cacheControl: "3600", upsert: false })
  if (upload.error) return NextResponse.json({ error: "No se pudo guardar la imagen" }, { status: 500 })
  const { data, error } = await admin.from("eduai_assets").insert({
    owner_id: user.id, asset_type: "image", title: file.name.slice(0,160), mime_type: mime,
    storage_bucket: "eduai-assets", storage_path: storagePath, source_module: "exam_import",
    visibility: "shared", metadata: { importKind: "exam_manual" },
    data_classification: "standard", processing_purpose: "exam_document_import", contains_personal_data: false,
  }).select("id").single()
  if (error || !data?.id) {
    await admin.storage.from("eduai-assets").remove([storagePath])
    return NextResponse.json({ error: "No se pudo registrar la imagen" }, { status: 500 })
  }
  return NextResponse.json({ url: "/api/assets/exam-image?id=" + data.id })
}
