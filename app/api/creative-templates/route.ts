import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BUCKET = "creative-templates"
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 60 * 60

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
}

function normalizeSource(value: unknown): TemplateSource {
  return value === "generated" ||
    value === "uploaded" ||
    value === "pattern" ||
    value === "other"
    ? value
    : "other"
}

function parseImageDataUrl(value: unknown) {
  if (typeof value !== "string") return null
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/)
  if (!match) return null

  const mimeType = match[1]
  const buffer = Buffer.from(match[2], "base64")
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null

  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]
  return { buffer, mimeType, extension }
}

async function withSignedUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  template: CreativeTemplateRow,
) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(template.storage_path, SIGNED_URL_TTL_SECONDS)

  return {
    id: template.id,
    name: template.name,
    source: template.source,
    prompt: template.prompt,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
    imageUrl: error ? null : data.signedUrl,
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("creative_templates")
    .select("id, user_id, name, source, prompt, storage_path, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const templates = await Promise.all(
    ((data ?? []) as CreativeTemplateRow[]).map((template) =>
      withSignedUrl(supabase, template),
    ),
  )

  return NextResponse.json({ templates })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsedImage = parseImageDataUrl(body?.imageData)
  if (!parsedImage) {
    return NextResponse.json(
      { error: "La imagen debe ser PNG, JPG o WEBP y pesar menos de 8 MB." },
      { status: 400 },
    )
  }

  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 120)
      : "Plantilla sin nombre"
  const prompt =
    typeof body?.prompt === "string" && body.prompt.trim()
      ? body.prompt.trim().slice(0, 2000)
      : null
  const source = normalizeSource(body?.source)
  const storagePath = `${user.id}/${crypto.randomUUID()}.${parsedImage.extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, parsedImage.buffer, {
      contentType: parsedImage.mimeType,
      cacheControl: "31536000",
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from("creative_templates")
    .insert({
      user_id: user.id,
      name,
      source,
      prompt,
      storage_path: storagePath,
    })
    .select("id, user_id, name, source, prompt, storage_path, created_at, updated_at")
    .single()

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { template: await withSignedUrl(supabase, data as CreativeTemplateRow) },
    { status: 201 },
  )
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Falta el identificador de la plantilla." }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("creative_templates")
    .select("id, storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 })
  }

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([data.storage_path])
  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  const { error: deleteError } = await supabase
    .from("creative_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
