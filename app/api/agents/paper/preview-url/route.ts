import { createClient } from "@/lib/supabase/server"
import { STORAGE_BUCKET } from "@/lib/papers/extraction"

export const runtime = "nodejs"
export const maxDuration = 30

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Sesión no válida." }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const bucket = getString(body?.bucket)
    const filePath = getString(body?.filePath)

    if (!bucket || !filePath) {
      return Response.json({ error: "Faltan bucket o filePath." }, { status: 400 })
    }

    if (bucket !== STORAGE_BUCKET) {
      return Response.json({ error: "Bucket no permitido." }, { status: 400 })
    }

    if (!filePath.startsWith(`${user.id}/`)) {
      return Response.json({ error: "No tienes permisos para abrir este PDF." }, { status: 403 })
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60)

    if (error || !data?.signedUrl) {
      return Response.json(
        { error: error?.message || "No se pudo crear la vista previa segura." },
        { status: 500 },
      )
    }

    return Response.json({
      ok: true,
      url: data.signedUrl,
      expiresIn: 3600,
    })
  } catch (error: any) {
    console.error("[Paper][preview-url] error:", error)
    return Response.json(
      { error: error?.message || "No se pudo preparar la vista previa." },
      { status: 500 },
    )
  }
}
