import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import {
  MATERIAL_TYPES,
  MAX_REPOSITORY_FILE_SIZE,
  REPOSITORY_BUCKET,
  normalizeStorageName,
  type MaterialType,
  type RepositoryItem,
} from "@/lib/repository/catalog"
import { parseRepositoryPublicAccessToken } from "@/lib/repository/public-share"

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

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase administrativo no está configurado")
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function validatePublicAccess(token: string) {
  const ownerId = parseRepositoryPublicAccessToken(decodeURIComponent(token))
  if (!ownerId) return null

  const admin = getAdminClient()
  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(ownerId)
  const email = userResult.user?.email
  if (userError || !email) return null

  const { data: adminEmail, error: adminError } = await admin
    .from("admin_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle()

  if (adminError || !adminEmail) return null
  return { admin, ownerId }
}

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

function isOwnedPublicPath(path: string, ownerId: string) {
  return path.startsWith(`${ownerId}/public/`) && !path.includes("..") && path.length <= 700
}

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const access = await validatePublicAccess(token)
  if (!access) {
    return NextResponse.json({ error: "El enlace público no es válido o fue desactivado." }, { status: 404 })
  }

  const { data, error } = await access.admin
    .from("repository_items")
    .select("id,title,subject,educational_level,school_year,material_type,question_count,source_type,original_file_name,mime_type,file_size,youtube_url,youtube_video_id,visibility,created_at,updated_at")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(2000)

  if (error) {
    return NextResponse.json({ error: "No fue posible cargar los materiales." }, { status: 500 })
  }

  return NextResponse.json({ items: data || [] }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const access = await validatePublicAccess(token)
  if (!access) {
    return NextResponse.json({ error: "El enlace público no es válido o fue desactivado." }, { status: 404 })
  }

  if (!(await checkUploadRateLimit(request, access.ownerId))) {
    return NextResponse.json({
      error: "Se alcanzó el máximo de 12 cargas por hora para este acceso público.",
    }, { status: 429, headers: { "Retry-After": "3600" } })
  }

  const body = await request.json().catch(() => null)
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
  const access = await validatePublicAccess(token)
  if (!access) {
    return NextResponse.json({ error: "El enlace público no es válido o fue desactivado." }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const storagePath = cleanText(body?.storagePath, 700)
  const fileName = cleanText(body?.fileName, 255)
  const fileSize = Number(body?.fileSize || 0)
  const mimeType = cleanText(body?.mimeType, 160) || "application/octet-stream"
  const title = cleanText(body?.title, 240)
  const subject = cleanText(body?.subject, 160)
  const educationalLevel = cleanText(body?.educationalLevel, 120)
  const schoolYear = Number.parseInt(String(body?.year || ""), 10)
  const materialType = cleanText(body?.materialType, 40) as MaterialType
  const questionCount = Number.parseInt(String(body?.questionCount || "0"), 10)

  if (!isOwnedPublicPath(storagePath, access.ownerId)) {
    return NextResponse.json({ error: "La ruta del archivo no es válida." }, { status: 400 })
  }
  const fileError = validateFileMetadata(fileName, fileSize, mimeType)
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 })
  if (!title || !subject || !educationalLevel) {
    return NextResponse.json({ error: "Completa título, asignatura y nivel educativo." }, { status: 400 })
  }
  if (!Number.isInteger(schoolYear) || schoolYear < 1900 || schoolYear > 2200) {
    return NextResponse.json({ error: "Ingresa un año válido." }, { status: 400 })
  }
  if (!ALLOWED_MATERIAL_TYPES.has(materialType)) {
    return NextResponse.json({ error: "El tipo de material no es válido." }, { status: 400 })
  }
  if (!Number.isInteger(questionCount) || questionCount < 0) {
    return NextResponse.json({ error: "La cantidad de preguntas no es válida." }, { status: 400 })
  }

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
    title,
    subject,
    educational_level: educationalLevel,
    school_year: schoolYear,
    material_type: materialType,
    question_count: questionCount,
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
    title,
    subject,
    educational_level: educationalLevel,
    school_year: schoolYear,
    material_type: materialType,
    question_count: questionCount,
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
    .select("id,title,subject,educational_level,school_year,material_type,question_count,source_type,original_file_name,mime_type,file_size,youtube_url,youtube_video_id,visibility,created_at,updated_at")
    .single()

  if (insertError) {
    await access.admin.storage.from(REPOSITORY_BUCKET).remove([storagePath])
    return NextResponse.json({ error: "El archivo subió, pero no pudo registrarse en Nube EduAI." }, { status: 500 })
  }

  return NextResponse.json({ item: data as Partial<RepositoryItem> }, { status: 201 })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const access = await validatePublicAccess(token)
  if (!access) return NextResponse.json({ error: "Acceso no válido." }, { status: 404 })

  const body = await request.json().catch(() => null)
  const storagePath = cleanText(body?.storagePath, 700)
  if (!isOwnedPublicPath(storagePath, access.ownerId)) {
    return NextResponse.json({ error: "La ruta del archivo no es válida." }, { status: 400 })
  }

  await access.admin.storage.from(REPOSITORY_BUCKET).remove([storagePath])
  return NextResponse.json({ ok: true })
}
