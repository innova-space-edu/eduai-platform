import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
  STORAGE_BUCKET,
  MAX_PDF_SIZE_BYTES,
  MAX_PDF_SIZE_MB,
} from "@/lib/papers/extraction"

export const runtime = "nodejs"
export const maxDuration = 30

function safeFilename(name: string) {
  const clean = String(name || "documento.pdf")
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
  } catch {}

  try {
    await storageClient.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_PDF_SIZE_BYTES,
      allowedMimeTypes: ["application/pdf"],
    })
  } catch {}
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
    const body = await req.json().catch(() => ({}))
    const filename = safeFilename(String(body?.filename || "documento.pdf"))
    const mimeType = String(body?.mimeType || "application/pdf")
    const size = Number(body?.size || 0)

    if (mimeType !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Por ahora Chat Paper solo acepta archivos PDF." }, { status: 400 })
    }

    if (!Number.isFinite(size) || size <= 0) {
      return Response.json({ error: "El archivo PDF está vacío o tiene un tamaño inválido." }, { status: 400 })
    }

    if (size > MAX_PDF_SIZE_BYTES) {
      return Response.json(
        { error: `El PDF pesa ${(size / 1024 / 1024).toFixed(1)} MB. El límite actual es ${MAX_PDF_SIZE_MB} MB.` },
        { status: 413 },
      )
    }

    const adminClient = getAdminClient()
    if (adminClient) {
      await ensurePapersBucket(adminClient.storage)
    }

    const signingClient = adminClient || userClient
    const filePath = `${user.id}/${Date.now()}-${filename}`
    const { data, error } = await signingClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(filePath)

    if (error || !data?.token) {
      return Response.json(
        {
          error:
            error?.message ||
            "No se pudo crear la URL segura de subida. Revisa el bucket papers y sus políticas de Storage.",
        },
        { status: 500 },
      )
    }

    return Response.json({
      ok: true,
      directUpload: true,
      bucket: STORAGE_BUCKET,
      filePath,
      filename,
      token: data.token,
      signedUrl: data.signedUrl,
      maxSizeMB: MAX_PDF_SIZE_MB,
    })
  } catch (error: any) {
    console.error("[Paper][upload-url] error:", error)
    return Response.json(
      { error: error?.message || "No se pudo preparar la subida del PDF." },
      { status: 500 },
    )
  }
}
