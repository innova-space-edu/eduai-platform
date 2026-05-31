import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createShortCode } from "@/lib/qr/short-code"
import { buildQrImageUrl } from "@/lib/qr/quickchart"

type ResourceType = "url" | "text" | "notebook"
type Visibility = "public" | "authenticated"

const ALLOWED_TYPES = new Set<ResourceType>(["url", "text", "notebook"])
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

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await supabase
    .from("qr_resources")
    .select("id, short_code, title, description, resource_type, target_url, text_content, notebook_id, visibility, expires_at, scan_count, created_at")
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
  const expiresAt = body.expires_at ? String(body.expires_at) : null

  if (!title) return NextResponse.json({ error: "title requerido" }, { status: 400 })
  if (!ALLOWED_TYPES.has(resourceType)) return NextResponse.json({ error: "resource_type inválido" }, { status: 400 })
  if (!ALLOWED_VISIBILITY.has(visibility)) return NextResponse.json({ error: "visibility inválida" }, { status: 400 })

  if (resourceType === "url") {
    if (!targetUrl) return NextResponse.json({ error: "target_url requerido" }, { status: 400 })
    try {
      const parsed = new URL(targetUrl)
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("Protocolo inválido")
    } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 })
    }
  }
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
    })
    .select("id, short_code, title, description, resource_type, target_url, text_content, notebook_id, visibility, expires_at, scan_count, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const shareUrl = `${publicBaseUrl(request)}/q/${shortCode}`
  return NextResponse.json({ resource: data, share_url: shareUrl, qr_image_url: buildQrImageUrl(shareUrl) }, { status: 201 })
}
