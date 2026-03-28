export const runtime = "nodejs"

export async function GET() {
  const baseUrl = process.env.DOCLING_PARSER_URL?.trim()

  if (!baseUrl) {
    return Response.json({
      ok: false,
      configured: false,
      message: "DOCLING_PARSER_URL no está configurada.",
    })
  }

  try {
    const endpoint = `${baseUrl.replace(/\/$/, "")}/health`

    const res = await fetch(endpoint, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    })

    const text = await res.text()

    return Response.json({
      ok: res.ok,
      configured: true,
      status: res.status,
      endpoint,
      response: text,
    })
  } catch (error: any) {
    return Response.json({
      ok: false,
      configured: true,
      message: error?.message || "No se pudo conectar al parser externo.",
    })
  }
}
