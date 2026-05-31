import { NextRequest, NextResponse } from "next/server"
import { buildQrImageUrl } from "@/lib/qr/quickchart"

type Params = { params: Promise<{ shortCode: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { shortCode } = await params
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "")
  const shareUrl = `${baseUrl}/q/${shortCode.toUpperCase()}`
  const imageUrl = buildQrImageUrl(shareUrl, { size: 640 })

  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) {
    return NextResponse.json({ error: "No se pudo generar el QR" }, { status: 502 })
  }

  return new NextResponse(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="eduai-qr-${shortCode.toUpperCase()}.png"`,
      "Cache-Control": "public, max-age=3600",
    },
  })
}
