import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  MATERIAL_TYPES,
  MAX_REPOSITORY_FILE_SIZE,
  REPOSITORY_BUCKET,
  normalizeStorageName,
  parseYouTubeVideoId,
  type MaterialType,
  type RepositoryItem,
} from "@/lib/repository/catalog"
import { validateRepositoryPublicAccess } from "@/lib/repository/public-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const BLOCKED_FILE_EXTENSION = /\.(?:exe|msi|bat|cmd|com|scr|ps1|sh|bash|js|mjs|cjs|html?|svg|php|rb|jar|apk|app|dmg)$/i
const BLOCKED_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
  "application/x-msdownload",
  "application/x-sh",
])
const ALLOWED_MATERIAL_TYPES = new Set<string>(MATERIAL_TYPES.map((item) => item.value))
const PUBLIC_ITEM_SELECT = "id,title,subject,educational_level,school_year,material_type,question_count,source_type,original_file_name,mime_type,file_size,youtube_url,youtube_video_id,visibility,created_at,updated_at"

async function checkUploadRateLimit(request: NextRequest, ownerId: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const authToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !authToken) return true

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const hour = Math.floor(Date.now() / 3_600_000)
  const key = `rl:nube-publica:${ownerId}:${ip}:${hour}`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["INCR", key]),
    })
    if (!response.ok) return true
    const { result } = await response.json()
    if (result === 1) {
      void fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["EXPIRE", key, 3600]),
      }).catch(() => undefined)
    }
    return Number(result) <= 12
  } catch {
    return true
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function validateFileMetadata(fileName: string, fileSize: number, mimeType: string) {
  if (!fileName || fileSize <= 0 || fileSize > MAX_REPOSITORY_FILE_SIZE) {
    return "El archivo debe pesar entre 1 byte y 100 MB."
  }
  if (BLOCKED_FILE_EXTENSION.test(fileName) || BLOCKED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return "Este tipo de archivo no está permitido en el acceso público."
  }
  return ""
}

function validateCommonFields(body: Record<string, unknown> | null) {
  const title = cleanText(body?.title, 240)
  const subject = cleanText(body?.subject, 160)
  const educationalLevel = cleanText(body?.educationalLevel, 120)
  const schoolYear = Number.parseInt(String(body?.year || ""), 10)
  const materialType = cleanText(body?.materialType, 40) as MaterialType
  const questionCount = Number.parseInt(String(body?.questionCount || "0"), 10)

  if (!title || !subject || !educationalLevel) return { error: "Completa título, asignatura y nivel educativo." as const }
  if (!Number.isInteger(schoolYear) || schoolYear < 1900 || schoolYear > 2200) return { error: "Ingresa un año válido." as const }
  if (!ALLOWED_MATERIAL_TYPES.has(materialType)) return { error: "El tipo de material no es válido." as const }
  if (!Number.isInteger(questionCount) || questionCount < 0) return { error: "La cantidad de preguntas no es válida." as const }

  return { title, subject, educationalLevel, schoolYear, materialType, questionCount, error: null }
}

function isOwnedPublicPath(path: string, ownerId: string) {
  return path.startsWith(`${ownerId}/public/`) && !path.includes("..") && path.length <= 700
}

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const access = await validateRepositoryPublicAccess(token)
  if (!access) {
    return NextResponse.json({ error: "El enlace público no es válido o fue desactivado." }, { status: 404 })
  }

  // Catálogo global: todo material con visibility=public aparece tanto aquí como
  // dentro de Nube EduAI para cualquier usuario autenticado.
  const { data, error } = await access.admin
    .from("repository_items")
    .select(PUBLIC_ITEM_SELECT)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(2000)

  if (error) {
    return NextResponse.json({ error: "No fue posible cargar los materiales." }, { status: 500 })
  }

  return NextResponse.json({ items: data || [], sharedGlobally: true }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const access = await validateRepositoryPublicAccess(token)
  if (!access) {
    return NextResponse.json({ error: "El enlace público no es válido o fue desactivado." }, { status: 404 })
  }

  if (!(await checkUploadRateLimit(request, access.ownerId))) {
    return NextResponse.json({
      error: "Se alcanzó el máximo de 12 cargas por hora para este acceso público.",
    }, { status: 429, headers: { "Retry-After": "3600" } })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const sourceType = cleanText(body?.sourceType, 20) || "file"

  if (sourceType === "youtube") {
    const common = validateCommonFields(body)
    if (common.error) return NextResponse.json({ error: common.error }, { status: 400 })

    const youtubeUrl = cleanText(body?.youtubeUrl, 700)
    const youtubeId = parseYouTubeVideoId(youtubeUrl)
    if (!youtubeId) return NextResponse.json({ error: "Ingresa un enlace válido de YouTube." }, { status: 400 })

    const payload = {
      title: common.title,
      subject: common.subject,
      educational_level: common.educationalLevel,
      school_year: common.schoolYear,
      material_type: common.materialType,
      question_count: common.questionCount,
      source_type: "youtube" as const,
      storage_path: null,
      original_file_name: null,
      mime_type: null,
      file_size: null,
      youtube_url: youtubeUrl,
      youtube_video_id: youtubeId,
      visibility: "public" as const,
      metadata: {
        schema_version: 1,
        visibility: "public",
        upload_source: "public_access_link",
        shared_globally: true,
        source_type: "youtube",
        youtube: { url: youtubeUrl, video_id: youtubeId },
      },
      created_by: access.ownerId,
    }

    const { data, error } = await access.admin
      .from("repository_items")
      .insert(payload)
      .select(PUBLIC_ITEM_SELECT)
      .single()

    if (error) return NextResponse.json({ error: "No fue posible registrar el video en Nube EduAI." }, { status: 500 })
    return NextResponse.json({ item: data as Partial<RepositoryItem>, sharedGlobally: true }, { status: 201 })
  }

  const fileName = cleanText(body?.fileName, 255)
  const fileSize = Number(body?.fileSize || 0)
  const mimeType = cleanText(body?.mimeType, 160) || "application/octet-stream"
  const schoolYear = Number.parseInt(String(body?.year || ""), 10)

  const fileError = validateFileMetadata(fileName, fileSize, mimeType)
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 })
  if (!Number.isInteger(schoolYear) || schoolYear < 1900 || schoolYear > 2200) {
    return NextResponse.json({ error: "Ingresa un año válido." }, { status: 400 })
  }

  const safeName = normalizeStorageName(fileName)
  const storagePath = `${access.ownerId}/public/${schoolYear}/${randomUUID()}-${safeName}`
  const { data, error } = await access.admin.storage
    .from(REPOSITORY_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false })

  if (error || !data?.token) {
    return NextResponse.json({ error: "No fue posible preparar la carga del archivo." }, { status: 500 })
  }

  return NextResponse.json({
    storagePath,
    uploadToken: data.token,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const access = await validateRepositoryPublicAccess(token)
  if (!access) {
    return NextResponse.json({ error: "El enlace público no es válido o fue desactivado." }, { status: 404 })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const storagePath = cleanText(body?.storagePath, 700)
  const fileName = cleanText(body?.fileName, 255)
  const fileSize = Number(body?.fileSize || 0)
  const mimeType = cleanText(body?.mimeType, 160) || "application/octet-stream"
  const common = validateCommonFields(body)

  if (common.error) return NextResponse.json({ error: common.error }, { status: 400 })
  if (!isOwnedPublicPath(storagePath, access.ownerId)) {
    return NextResponse.json({ error: "La ruta del archivo no es válida." }, { status: 400 })
  }
  const fileError = validateFileMetadata(fileName, fileSize, mimeType)
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 })

  const slash = storagePath.lastIndexOf("/")
  const folder = storagePath.slice(0, slash)
  const storedName = storagePath.slice(slash + 1)
  const { data: storedFiles, error: listError } = await access.admin.storage
    .from(REPOSITORY_BUCKET)
    .list(folder, { search: storedName, limit: 10 })

  if (listError || !storedFiles?.some((item) => item.name === storedName)) {
    return NextResponse.json({ error: "El archivo aún no terminó de subir." }, { status: 400 })
  }

  const backup = {
    schema_version: 1,
    visibility: "public",
    upload_source: "public_access_link",
    shared_globally: true,
    title: common.title,
    subject: common.subject,
    educational_level: common.educationalLevel,
    school_year: common.schoolYear,
    material_type: common.materialType,
    question_count: common.questionCount,
    source_type: "file",
    file: {
      bucket: REPOSITORY_BUCKET,
      storage_path: storagePath,
      original_name: fileName,
      mime_type: mimeType,
      size: fileSize,
    },
  }

  const payload = {
    title: common.title,
    subject: common.subject,
    educational_level: common.educationalLevel,
    school_year: common.schoolYear,
    material_type: common.materialType,
    question_count: common.questionCount,
    source_type: "file" as const,
    storage_path: storagePath,
    original_file_name: fileName,
    mime_type: mimeType,
    file_size: fileSize,
    youtube_url: null,
    youtube_video_id: null,
    visibility: "public" as const,
    metadata: backup,
    created_by: access.ownerId,
  }

  const { data, error: insertError } = await access.admin
    .from("repository_items")
    .insert(payload)
    .select(PUBLIC_ITEM_SELECT)
    .single()

  if (insertError) {
    await access.admin.storage.from(REPOSITORY_BUCKET).remove([storagePath])
    return NextResponse.json({ error: "El archivo subió, pero no pudo registrarse en Nube EduAI." }, { status: 500 })
  }

  return NextResponse.json({ item: data as Partial<RepositoryItem>, sharedGlobally: true }, { status: 201 })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const access = await validateRepositoryPublicAccess(token)
  if (!access) return NextResponse.json({ error: "Acceso no válido." }, { status: 404 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const storagePath = cleanText(body?.storagePath, 700)
  if (!isOwnedPublicPath(storagePath, access.ownerId)) {
    return NextResponse.json({ error: "La ruta del archivo no es válida." }, { status: 400 })
  }

  await access.admin.storage.from(REPOSITORY_BUCKET).remove([storagePath])
  return NextResponse.json({ ok: true })
}
