import crypto from "crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Faltan variables de entorno de Supabase." },
        { status: 500 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No se recibió ninguna imagen." },
        { status: 400 }
      )
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Formato no permitido. Usa PNG, JPG o WEBP." },
        { status: 400 }
      )
    }

    const maxSizeMb = 8
    if (file.size > maxSizeMb * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: `La imagen supera los ${maxSizeMb} MB.` },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : "jpg"

    const fileName = `video-base/${Date.now()}-${crypto
      .randomBytes(8)
      .toString("hex")}.${ext}`

    const bucketName = "chat-files"

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    return NextResponse.json({
      ok: true,
      path: fileName,
      url: publicUrlData.publicUrl,
    })
  } catch (error) {
    console.error("video-image upload error:", error)
    return NextResponse.json(
      { ok: false, error: "No se pudo subir la imagen." },
      { status: 500 }
    )
  }
}
