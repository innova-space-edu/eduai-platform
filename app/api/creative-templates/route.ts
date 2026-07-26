import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BUCKET = "creative-templates"
const MAX_FILE_BYTES = 25 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 60 * 60

const ALLOWED_MIME: Record<string, { extension: string; kind: "image" | "pdf" | "presentation" | "document" }> = {
  "image/png": { extension: "png", kind: "image" },
  "image/jpeg": { extension: "jpg", kind: "image" },
  "image/webp": { extension: "webp", kind: "image" },
  "application/pdf": { extension: "pdf", kind: "pdf" },
  "application/vnd.ms-powerpoint": { extension: "ppt", kind: "presentation" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { extension: "pptx", kind: "presentation" },
  "application/msword": { extension: "doc", kind: "document" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: "docx", kind: "document" },
}

type TemplateSource = "generated" | "uploaded" | "pattern" | "other"

type CreativeTemplateRow = {
  id: string
  user_id: string
  name: string
  source: TemplateSource
  prompt: string | null
  storage_path: string
  created_at: string
  updated_at: string
  file_name?: string | null
  mime_type?: string | null
  file_kind?: string | null
  formats?: string[] | null
  accent_color?: string | null
  secondary_color?: string | null
  instructions?: string | null
  preview_path?: string | null
  is_creator_template?: boolean | null
}

function normalizeSource(value: unknown): TemplateSource {
  return value === "generated" || value === "uploaded" || value === "pattern" || value === "other" ? value : "other"
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function parseFormats(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 30)
  if (typeof value !== "string") return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 30)
  } catch {}
  return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30)
}

function parseImageDataUrl(value: unknown) {
  if (typeof value !== "string") return null
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/)
  if (!match) return null
  const mimeType = match[1]
  const buffer = Buffer.from(match[2], "base64")
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) return null
  return { buffer, mimeType, extension: ALLOWED_MIME[mimeType].extension, kind: "image" as const }
}

function legacyMetadata(row: CreativeTemplateRow) {
  if (!row.prompt?.startsWith("__CREATOR_TEMPLATE__")) return null
  try {
    return JSON.parse(row.prompt.slice("__CREATOR_TEMPLATE__".length))
  } catch {
    return null
  }
}

async function signedUrl(supabase: Awaited<ReturnType<typeof createClient>>, path?: string | null) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return error ? null : data.signedUrl
}

async function withSignedUrl(supabase: Awaited<ReturnType<typeof createClient>>, template: CreativeTemplateRow) {
  const legacy = legacyMetadata(template)
  const fileKind = template.file_kind || legacy?.fileKind || "image"
  const fileUrl = await signedUrl(supabase, template.storage_path)
  const imagePath = template.preview_path || (fileKind === "image" ? template.storage_path : null)
  const imageUrl = await signedUrl(supabase, imagePath)
  return {
    id: template.id,
    name: template.name,
    source: template.source,
    prompt: legacy ? null : template.prompt,
    instructions: template.instructions || legacy?.instructions || (legacy ? "" : template.prompt),
    createdAt: template.created_at,
    updatedAt: template.updated_at,
    fileName: template.file_name || legacy?.fileName || null,
    mimeType: template.mime_type || legacy?.mimeType || null,
    fileKind,
    formats: template.formats || legacy?.formats || [],
    accentColor: template.accent_color || legacy?.accentColor || "#7c3aed",
    secondaryColor: template.secondary_color || legacy?.secondaryColor || "#06b6d4",
    isCreatorTemplate: template.is_creator_template ?? Boolean(legacy),
    imageUrl,
    fileUrl,
  }
}

async function selectTemplates(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const modern = await supabase
    .from("creative_templates")
    .select("id, user_id, name, source, prompt, storage_path, created_at, updated_at, file_name, mime_type, file_kind, formats, accent_color, secondary_color, instructions, preview_path, is_creator_template")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(150)
  if (!modern.error) return modern
  if (modern.error.code !== "42703") return modern
  return supabase
    .from("creative_templates")
    .select("id, user_id, name, source, prompt, storage_path, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(150)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await selectTemplates(supabase, user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const templates = await Promise.all(((data ?? []) as CreativeTemplateRow[]).map((template) => withSignedUrl(supabase, template)))
  return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const contentType = request.headers.get("content-type") || ""
  let buffer: Buffer
  let mimeType: string
  let extension: string
  let fileKind: "image" | "pdf" | "presentation" | "document"
  let fileName = "plantilla"
  let name = "Plantilla sin nombre"
  let instructions = ""
  let formats: string[] = []
  let accentColor = "#7c3aed"
  let secondaryColor = "#06b6d4"
  let source: TemplateSource = "uploaded"
  let prompt: string | null = null
  let isCreatorTemplate = false

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return NextResponse.json({ error: "Debes seleccionar un archivo de plantilla." }, { status: 400 })
    const allowed = ALLOWED_MIME[file.type]
    if (!allowed) return NextResponse.json({ error: "Formato no compatible. Usa PDF, PPT, PPTX, DOC, DOCX, PNG, JPG, JPEG o WEBP." }, { status: 400 })
    if (!file.size || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "La plantilla debe pesar menos de 25 MB." }, { status: 400 })
    buffer = Buffer.from(await file.arrayBuffer())
    mimeType = file.type
    extension = allowed.extension
    fileKind = allowed.kind
    fileName = file.name.slice(0, 240)
    name = cleanText(form.get("name"), 120) || file.name.replace(/\.[^.]+$/, "").slice(0, 120)
    instructions = cleanText(form.get("instructions"), 4000)
    formats = parseFormats(form.get("formats"))
    accentColor = cleanText(form.get("accentColor"), 32) || accentColor
    secondaryColor = cleanText(form.get("secondaryColor"), 32) || secondaryColor
    isCreatorTemplate = true
  } else {
    const body = await request.json().catch(() => null)
    const parsedImage = parseImageDataUrl(body?.imageData)
    if (!parsedImage) return NextResponse.json({ error: "La imagen debe ser PNG, JPG o WEBP y pesar menos de 8 MB." }, { status: 400 })
    buffer = parsedImage.buffer
    mimeType = parsedImage.mimeType
    extension = parsedImage.extension
    fileKind = parsedImage.kind
    name = cleanText(body?.name, 120) || name
    prompt = cleanText(body?.prompt, 2000) || null
    source = normalizeSource(body?.source)
  }

  const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    cacheControl: "31536000",
    upsert: false,
  })
  if (uploadError) {
    const migrationHint = /mime|bucket|not allowed/i.test(uploadError.message) && fileKind !== "image"
      ? " Aplica la migración 202607260001_creator_hub_foundation.sql para habilitar documentos y presentaciones."
      : ""
    return NextResponse.json({ error: `${uploadError.message}${migrationHint}` }, { status: 500 })
  }

  const modernPayload = {
    user_id: user.id,
    name,
    source,
    prompt,
    storage_path: storagePath,
    file_name: fileName,
    mime_type: mimeType,
    file_kind: fileKind,
    formats,
    accent_color: accentColor,
    secondary_color: secondaryColor,
    instructions: instructions || null,
    preview_path: fileKind === "image" ? storagePath : null,
    is_creator_template: isCreatorTemplate,
  }

  let insert = await supabase
    .from("creative_templates")
    .insert(modernPayload)
    .select("id, user_id, name, source, prompt, storage_path, created_at, updated_at, file_name, mime_type, file_kind, formats, accent_color, secondary_color, instructions, preview_path, is_creator_template")
    .single()

  if (insert.error?.code === "42703" && fileKind === "image") {
    const legacyPrompt = isCreatorTemplate
      ? `__CREATOR_TEMPLATE__${JSON.stringify({ fileName, mimeType, fileKind, formats, accentColor, secondaryColor, instructions })}`
      : prompt
    insert = await supabase
      .from("creative_templates")
      .insert({ user_id: user.id, name, source, prompt: legacyPrompt, storage_path: storagePath })
      .select("id, user_id, name, source, prompt, storage_path, created_at, updated_at")
      .single()
  }

  if (insert.error) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    const message = insert.error.code === "42703"
      ? "Falta aplicar la migración 202607260001_creator_hub_foundation.sql en Supabase."
      : insert.error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ template: await withSignedUrl(supabase, insert.data as CreativeTemplateRow) }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Falta el identificador de la plantilla." }, { status: 400 })

  const { data, error } = await supabase.from("creative_templates").select("id, storage_path, preview_path").eq("id", id).eq("user_id", user.id).maybeSingle()
  if (error?.code === "42703") {
    const legacy = await supabase.from("creative_templates").select("id, storage_path").eq("id", id).eq("user_id", user.id).maybeSingle()
    if (legacy.error) return NextResponse.json({ error: legacy.error.message }, { status: 500 })
    if (!legacy.data) return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 })
    await supabase.storage.from(BUCKET).remove([legacy.data.storage_path])
  } else {
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 })
    const paths = [data.storage_path, data.preview_path].filter(Boolean)
    await supabase.storage.from(BUCKET).remove([...new Set(paths)])
  }

  const { error: deleteError } = await supabase.from("creative_templates").delete().eq("id", id).eq("user_id", user.id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
