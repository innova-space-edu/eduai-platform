import { NextRequest, NextResponse } from "next/server"
import {
  REPOSITORY_BUCKET,
  formatBytes,
  getPreviewKind,
  materialTypeLabel,
  type RepositoryItem,
} from "@/lib/repository/catalog"
import { validateRepositoryPublicAccess } from "@/lib/repository/public-access"
import { createRepositoryShareToken } from "@/lib/repository/public-share"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) {
    return NextResponse.json({ error: "El material no es válido." }, { status: 400 })
  }

  const access = await validateRepositoryPublicAccess(token)
  if (!access) {
    return NextResponse.json({ error: "El enlace público no es válido o fue desactivado." }, { status: 404 })
  }

  const { data, error } = await access.admin
    .from("repository_items")
    .select("*")
    .eq("id", itemId)
    .eq("visibility", "public")
    .maybeSingle()

  if (error) return NextResponse.json({ error: "No fue posible abrir el material." }, { status: 500 })
  if (!data) return NextResponse.json({ error: "El material ya no está disponible." }, { status: 404 })

  const item = data as RepositoryItem
  let previewUrl = ""
  let downloadUrl = ""

  if (item.source_type === "file" && item.storage_path) {
    const [preview, download] = await Promise.all([
      access.admin.storage.from(REPOSITORY_BUCKET).createSignedUrl(item.storage_path, 60 * 60),
      access.admin.storage.from(REPOSITORY_BUCKET).createSignedUrl(item.storage_path, 60 * 60, {
        download: item.original_file_name || item.title,
      }),
    ])
    if (preview.error || download.error) {
      return NextResponse.json({ error: "No fue posible preparar el archivo." }, { status: 500 })
    }
    previewUrl = preview.data.signedUrl
    downloadUrl = download.data.signedUrl
  }

  const shareToken = createRepositoryShareToken(item.id)
  const shareUrl = new URL(`/nube/${encodeURIComponent(shareToken)}`, request.nextUrl.origin).toString()

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
      createdAt: item.created_at,
    },
    previewUrl,
    downloadUrl,
    shareUrl,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
