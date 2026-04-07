import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"

const BUCKET_NAME = "video-inputs"
const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
]

function getFileExtension(fileName: string, mimeType: string) {
  const fromName = fileName.split(".").pop()?.toLowerCase()

  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpg" ? "jpeg" : fromName
  }

  if (mimeType === "image/jpeg") return "jpeg"
  if (mimeType === "image/png") return "png"
  if (mimeType === "image/webp") return "webp"

  return "bin"
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autenticado.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se recibió ningún archivo.",
          code: "FILE_MISSING",
        },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Formato no permitido. Usa JPG, PNG o WEBP.",
          code: "INVALID_FILE_TYPE",
        },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `La imagen supera el máximo de ${MAX_FILE_SIZE_MB} MB.`,
          code: "FILE_TOO_LARGE",
        },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ext = getFileExtension(file.name, file.type)
    const hash = crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex")
      .slice(0, 20)

    const safeDate = new Date().toISOString().slice(0, 10)
    const filePath = `${user.id}/${safeDate}/${hash}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se pudo subir la imagen: ${uploadError.message}`,
          code: "UPLOAD_FAILED",
        },
        { status: 500 }
      )
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60 * 24)

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: `La imagen se subió, pero no se pudo generar la URL: ${
            signedError?.message || "Error desconocido"
          }`,
          code: "SIGNED_URL_FAILED",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      path: filePath,
      url: signedData.signedUrl,
      contentType: file.type,
      size: file.size,
      bucket: BUCKET_NAME,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error inesperado al subir la imagen."

    return NextResponse.json(
      {
        ok: false,
        error: message,
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    )
  }
}
