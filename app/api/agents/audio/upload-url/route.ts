import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 15

const BUCKET = "audio-lab"
const MAX_MB = 50
const MAX_BYTES = MAX_MB * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set(["mp3", "wav", "m4a", "mp4", "webm", "ogg"])
const ALLOWED_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/mp4",
  "audio/webm",
  "audio/m4a",
  "audio/ogg",
  "video/mp4",
  "video/webm",
])

function safeFilename(value: string) {
  const name = String(value || "audio.mp3")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120)

  return name || "audio.mp3"
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sesión no válida. Vuelve a iniciar sesión." }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const filename = safeFilename(String(body?.filename || "audio.mp3"))
    const mimeType = String(body?.mimeType || "audio/mpeg")
    const size = Number(body?.size || 0)
    const extension = filename.split(".").pop()?.toLowerCase() || ""

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: "Formato no soportado. Usa MP3, WAV, M4A, MP4, WEBM u OGG." }, { status: 400 })
    }

    if (!ALLOWED_MIMES.has(mimeType) && mimeType !== "application/octet-stream") {
      return NextResponse.json({ error: `MIME no soportado: ${mimeType}` }, { status: 400 })
    }

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "El archivo está vacío o tiene un tamaño inválido." }, { status: 400 })
    }

    if (size > MAX_BYTES) {
      return NextResponse.json({ error: `El audio supera el límite inicial de ${MAX_MB} MB.` }, { status: 413 })
    }

    const filePath = `${user.id}/${Date.now()}-${filename}`

    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      filePath,
      filename,
      mimeType,
      maxSizeMB: MAX_MB,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo preparar la subida." }, { status: 500 })
  }
}
