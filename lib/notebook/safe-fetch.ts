// lib/notebook/safe-fetch.ts
// Helper para parsear respuestas JSON de forma segura.
// Si el servidor devuelve HTML (error 500, página de Next.js), lanza un error
// claro en vez de "Unexpected token '<'".

export async function safeJson<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? ""

  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `HTTP ${res.status}: respuesta no JSON. ${text.slice(0, 200)}`
    )
  }

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error ?? `HTTP ${res.status}`)
  }

  return data as T
}

// Versión que nunca lanza — devuelve null en caso de error
export async function safeJsonOrNull<T = unknown>(res: Response): Promise<T | null> {
  try {
    return await safeJson<T>(res)
  } catch (err) {
    console.error("[safeJson]", err)
    return null
  }
}
