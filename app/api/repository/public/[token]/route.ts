import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { formatBytes, getPreviewKind, materialTypeLabel, REPOSITORY_BUCKET, type RepositoryItem } from "@/lib/repository/catalog"
import { parseRepositoryShareToken } from "@/lib/repository/public-share"

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

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params

  let itemId: string | null = null
  try {
    itemId = parseRepositoryShareToken(decodeURIComponent(token))
  } catch {
    itemId = null
  }

  if (!itemId) {
    return NextResponse.json({ error: "El enlace compartido no es válido." }, { status: 404 })
  }

  try {
    const admin = getAdminClient()
    const { data, error } = await admin
      .from("repository_items")
      .select("*")
      .eq("id", itemId)
      .eq("visibility", "public")
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: "Este material ya no está disponible." }, { status: 404 })
    }

    const item = data as RepositoryItem
    let previewUrl = ""
    let downloadUrl = ""

    const storagePath = item.source_type === "file" ? item.storage_path : null
    if (request.nextUrl.searchParams.get("download") === "1") {
      if (!storagePath) return NextResponse.json({ error: "Este material no tiene archivo descargable." }, { status: 404 })
      const { data, error } = await admin.storage.from(REPOSITORY_BUCKET).createSignedUrl(storagePath, 60 * 5, {
        download: item.original_file_name || item.title,
      })
      if (error) return NextResponse.json({ error: "No fue posible preparar la descarga." }, { status: 500 })
      return NextResponse.redirect(data.signedUrl, {
        status: 307,
        headers: { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer" },
      })
    }

    if (storagePath) {
      const { data, error } = await admin.storage.from(REPOSITORY_BUCKET).createSignedUrl(storagePath, 60 * 60)
      if (error) return NextResponse.json({ error: "No fue posible preparar la vista previa." }, { status: 500 })
      previewUrl = data.signedUrl
      downloadUrl = `${request.nextUrl.pathname}?download=1`
    }

    return NextResponse.json({
      item: {
        id: item.id,
        title: item.title,
        subject: item.subject,
        educationalLevel: item.educational_level,
        schoolYear: item.school_year,
        materialType: item.material_type,
        materialTypeLabel: materialTypeLabel(item.material_type),
        questionCount: item.question_count,
        sourceType: item.source_type,
        originalFileName: item.original_file_name,
        mimeType: item.mime_type,
        fileSize: item.file_size,
        fileSizeLabel: formatBytes(item.file_size),
        youtubeUrl: item.youtube_url,
        youtubeVideoId: item.youtube_video_id,
        previewKind: getPreviewKind(item),
      },
      previewUrl,
      downloadUrl,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (caught) {
    console.error("[nube-public-share]", caught)
    return NextResponse.json({ error: "No fue posible abrir el material compartido." }, { status: 500 })
  }
}
