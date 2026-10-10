import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createShortCode } from "@/lib/qr/short-code"
import { buildQrImageUrl } from "@/lib/qr/quickchart"
import { validateCollectionLinks } from "@/lib/qr/collection"

type ResourceType = "url" | "text" | "notebook" | "collection"
type Visibility = "public" | "authenticated"

const ALLOWED_TYPES = new Set<ResourceType>(["url", "text", "notebook", "collection"])
const ALLOWED_VISIBILITY = new Set<Visibility>(["public", "authenticated"])

function publicBaseUrl(request: NextRequest): string {
  return request.nextUrl.origin.replace(/\/$/, "")
}

async function uniqueShortCode(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shortCode = createShortCode()
    const { data } = await supabase.from("qr_resources").select("id").eq("short_code", shortCode).maybeSingle()
    if (!data) return shortCode
  }
  throw new Error("No se pudo crear un código único")
}

const QR_SELECT = "id, short_code, title, description, resource_type, target_url, text_content, notebook_id, visibility, expires_at, scan_count, created_at, link_items"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await supabase
    .from("qr_resources")
    .select(QR_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resources: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const resourceType = body.resource_type as ResourceType
  const visibility = (body.visibility ?? "public") as Visibility
  const title = String(body.title ?? "").trim()
  const description = String(body.description ?? "").trim() || null
  const targetUrl = String(body.target_url ?? "").trim() || null
  const textContent = String(body.text_content ?? "").trim() || null
  const notebookId = body.notebook_id ? String(body.notebook_id) : null
  const expiresAtRaw = body.expires_at ? String(body.expires_at).trim() : ""
  let expiresAt: string | null = null

  if (!title) return NextResponse.json({ error: "title requerido" }, { status: 400 })
  if (!ALLOWED_TYPES.has(resourceType)) return NextResponse.json({ error: "resource_type inválido" }, { status: 400 })
  if (!ALLOWED_VISIBILITY.has(visibility)) return NextResponse.json({ error: "visibility inválida" }, { status: 400 })

  if (expiresAtRaw) {
    const parsedExpiration = new Date(expiresAtRaw)
    if (Number.isNaN(parsedExpiration.getTime())) {
      return NextResponse.json({ error: "La fecha de vencimiento no es válida" }, { status: 400 })
    }
    if (parsedExpiration <= new Date()) {
      return NextResponse.json({ error: "La fecha de vencimiento debe ser posterior a la hora actual" }, { status: 400 })
    }
    expiresAt = parsedExpiration.toISOString()
  }

  if (resourceType === "url") {
    if (!targetUrl) return NextResponse.json({ error: "target_url requerido" }, { status: 400 })
    try {
      const parsed = new URL(targetUrl)
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("Protocolo inválido")
    } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 })
    }
  }
  const collection = resourceType === "collection" ? validateCollectionLinks(body.link_items) : { links: [], error: null }
  if (collection.error) return NextResponse.json({ error: collection.error }, { status: 400 })
  if (resourceType === "text" && !textContent) return NextResponse.json({ error: "text_content requerido" }, { status: 400 })
  if (resourceType === "notebook" && !notebookId) return NextResponse.json({ error: "notebook_id requerido" }, { status: 400 })

  if (notebookId) {
    const { data: notebook } = await supabase.from("notebooks").select("id").eq("id", notebookId).eq("user_id", user.id).maybeSingle()
    if (!notebook) return NextResponse.json({ error: "Cuaderno no encontrado" }, { status: 404 })
  }

  const shortCode = await uniqueShortCode(supabase)
  const { data, error } = await supabase
    .from("qr_resources")
    .insert({
      user_id: user.id,
      short_code: shortCode,
      title,
      description,
      resource_type: resourceType,
      target_url: targetUrl,
      text_content: textContent,
      notebook_id: notebookId,
      visibility,
      expires_at: expiresAt,
      link_items: collection.links,
    })
    .select(QR_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const shareUrl = `${publicBaseUrl(request)}/q/${shortCode}`
  return NextResponse.json({ resource: data, share_url: shareUrl, qr_image_url: buildQrImageUrl(shareUrl) }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === "string" ? body.id.trim() : ""
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""
  const visibility = body.visibility as Visibility
  const expiresAtRaw = typeof body.expires_at === "string" ? body.expires_at.trim() : ""
  const collection = validateCollectionLinks(body.link_items)

  if (!id || !title || title.length > 200 || description.length > 2000) {
    return NextResponse.json({ error: "Título o identificador no válido" }, { status: 400 })
  }
  if (!ALLOWED_VISIBILITY.has(visibility)) {
    return NextResponse.json({ error: "Visibilidad inválida" }, { status: 400 })
  }
  if (collection.error) return NextResponse.json({ error: collection.error }, { status: 400 })

  let expiresAt: string | null = null
  if (expiresAtRaw) {
    const expires = new Date(expiresAtRaw)
    if (Number.isNaN(expires.getTime()) || expires <= new Date()) {
      return NextResponse.json({ error: "La fecha de vencimiento debe ser válida y futura" }, { status: 400 })
    }
    expiresAt = expires.toISOString()
  }

  const { data, error } = await supabase.from("qr_resources")
    .update({ title, description: description || null, visibility, expires_at: expiresAt, link_items: collection.links })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("resource_type", "collection")
    .select(QR_SELECT)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Colección no encontrada o sin permisos" }, { status: 404 })

  const shareUrl = publicBaseUrl(request) + "/q/" + data.short_code
  return NextResponse.json({ resource: data, share_url: shareUrl, qr_image_url: buildQrImageUrl(shareUrl) })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id = String(body?.id || request.nextUrl.searchParams.get("id") || "").trim()
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const { data, error } = await supabase
    .from("qr_resources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "QR no encontrado o sin permisos" }, { status: 404 })

  return NextResponse.json({ success: true, id: data.id })
}
