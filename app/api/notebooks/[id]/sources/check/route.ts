import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertPublicHttpUrl, fetchPublicUrl } from "@/lib/notebook/url-safety"

export const runtime = "nodejs"
export const maxDuration = 20

type Params = { params: Promise<{ id: string }> }

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function inferKind(url: URL, contentType: string): "paper" | "pdf" | "web" {
  const host = url.hostname.toLowerCase()
  const path = url.pathname.toLowerCase()
  if (host.includes("doi.org") || host.includes("arxiv.org") || host.includes("pubmed.ncbi.nlm.nih.gov")) return "paper"
  if (contentType.includes("application/pdf") || path.endsWith(".pdf")) return "pdf"
  return "web"
}

function titleFromUrl(url: URL): string {
  const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "")
  return last.replace(/[-_]+/g, " ").replace(/\.pdf$/i, "").trim() || url.hostname
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: notebook } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (!notebook) return NextResponse.json({ error: "Cuaderno no encontrado" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const requestedUrl = String(body?.url || "").trim()
    if (!requestedUrl) return NextResponse.json({ error: "URL requerida" }, { status: 400 })

    const safeUrl = await assertPublicHttpUrl(requestedUrl)
    const startedAt = Date.now()
    const response = await fetchPublicUrl(safeUrl, {
      method: "GET",
      headers: {
        "User-Agent": "EduAI-Notebook/1.0 (+https://innova-space-edu.cl)",
        Accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.5",
        Range: "bytes=0-65535",
      },
      signal: AbortSignal.timeout(10_000),
    })

    const finalUrl = await assertPublicHttpUrl(response.url || safeUrl.toString())
    const contentType = (response.headers.get("content-type") || "").toLowerCase()
    const contentLength = Number(response.headers.get("content-length") || 0) || null
    let title = titleFromUrl(finalUrl)
    let description = ""

    if (response.ok && (contentType.includes("text/html") || contentType.includes("application/xhtml+xml"))) {
      const html = await response.text()
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      const descriptionMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i)
      if (titleMatch?.[1]) title = decodeEntities(titleMatch[1]).slice(0, 200)
      if (descriptionMatch?.[1]) description = decodeEntities(descriptionMatch[1]).slice(0, 400)
    }

    const accessible = response.ok || response.status === 206
    const kind = inferKind(finalUrl, contentType)
    const warning = !accessible
      ? `El servidor respondió HTTP ${response.status}.`
      : contentType.includes("text/html") || contentType.includes("application/pdf") || contentType.includes("text/plain")
        ? null
        : `Tipo de contenido poco habitual: ${contentType || "desconocido"}.`

    return NextResponse.json({
      ok: accessible,
      status: response.status,
      statusText: response.statusText,
      requestedUrl: safeUrl.toString(),
      finalUrl: finalUrl.toString(),
      title,
      description,
      contentType: contentType || null,
      contentLength,
      kind,
      elapsedMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      warning,
    }, { status: accessible ? 200 : 422 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible revisar el enlace"
    return NextResponse.json({ error: message, ok: false }, { status: 400 })
  }
}
