import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
  STORAGE_BUCKET,
  MAX_PDF_SIZE_BYTES,
  MAX_PDF_SIZE_MB,
} from "@/lib/papers/extraction"

export const runtime = "nodejs"
export const maxDuration = 60

function safeFilename(name: string) {
  const fallback = "documento.pdf"
  const clean = String(name || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120)

  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean || "documento"}.pdf`
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) return null

  return createSupabaseAdminClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function ensurePapersBucket(storageClient: any) {
  try {
    const { data } = await storageClient.getBucket(STORAGE_BUCKET)
    if (data) return
  } catch {
    // Si el bucket no existe y tenemos service role, intentamos crearlo abajo.
  }

  try {
    await storageClient.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_PDF_SIZE_BYTES,
      allowedMimeTypes: ["application/pdf"],
    })
  } catch {
    // Puede fallar sin service role o si el bucket ya existe. La subida mostrará el error real si persiste.
  }
}

export async function POST(req: Request) {
  const userClient = await createClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()

  if (!user) {
    return Response.json({ error: "Sesión no válida. Vuelve a iniciar sesión." }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return Response.json({ error: "No llegó ningún archivo PDF." }, { status: 400 })
    }

    const filename = safeFilename(file.name)
    const mime = file.type || "application/pdf"

    if (mime !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Por ahora Chat Paper solo acepta archivos PDF." }, { status: 400 })
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return Response.json(
        { error: `El PDF pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El límite actual es ${MAX_PDF_SIZE_MB} MB.` },
        { status: 413 },
      )
    }

    const adminClient = getAdminClient()
    const uploadClient = adminClient || userClient
    const storage = uploadClient.storage

    if (adminClient) {
      await ensurePapersBucket(storage)
    }

    const path = `${user.id}/${Date.now()}-${filename}`
    const { error: uploadError } = await storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      })

    if (uploadError) {
      return Response.json(
        {
          error:
            uploadError.message ||
            "No se pudo subir el PDF. Revisa que el bucket papers exista y tenga políticas de Storage para usuarios autenticados.",
        },
        { status: 500 },
      )
    }

    return Response.json({
      ok: true,
      bucket: STORAGE_BUCKET,
      filePath: path,
      filename,
      size: file.size,
      mimeType: "application/pdf",
    })
  } catch (error: any) {
    console.error("[Paper][upload] error:", error)
    return Response.json(
      { error: error?.message || "No se pudo subir el PDF." },
      { status: 500 },
    )
  }
}
