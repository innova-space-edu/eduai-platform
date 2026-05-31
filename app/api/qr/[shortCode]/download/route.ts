import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildQrImageUrl } from "@/lib/qr/quickchart"

type Params = { params: Promise<{ shortCode: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { shortCode } = await params
  const normalizedCode = shortCode.toUpperCase()
  const supabase = await createClient()

  const { data: resource, error } = await supabase
    .from("qr_resources")
    .select("short_code, expires_at")
    .eq("short_code", normalizedCode)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!resource) return NextResponse.json({ error: "Recurso no encontrado, privado o vencido" }, { status: 404 })
  if (resource.expires_at && new Date(resource.expires_at) <= new Date()) {
    return NextResponse.json({ error: "El recurso QR ha vencido" }, { status: 410 })
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "")
  const shareUrl = `${baseUrl}/q/${normalizedCode}`
  const imageUrl = buildQrImageUrl(shareUrl, { size: 640 })

  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) {
    return NextResponse.json({ error: "No se pudo generar el QR" }, { status: 502 })
  }

  return new NextResponse(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="eduai-qr-${normalizedCode}.png"`,
      "Cache-Control": "public, max-age=3600",
    },
  })
}
