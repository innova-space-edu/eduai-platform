import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
  STORAGE_BUCKET,
  MAX_PDF_SIZE_BYTES,
  MAX_PDF_SIZE_MB,
  MAX_RETURN_TEXT_CHARS,
  truncateText,
  ensurePaperProcessed,
} from "@/lib/papers/extraction"
import { updateChunkEmbeddings } from "@/lib/papers/embeddings"

export const runtime = "nodejs"
export const maxDuration = 60

function getString(value: unknown) {
  return typeof value === "string" ? value : ""
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "")
}

function safeFilename(name: string) {
  const clean = String(name || "documento.pdf")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120)

  return clean.toLowerCase().endsWith(".pdf")
    ? clean
    : `${clean || "documento"}.pdf`
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

const papersBucketOptions = {
  public: false,
  fileSizeLimit: MAX_PDF_SIZE_BYTES,
  allowedMimeTypes: ["application/pdf"],
}

async function ensurePapersBucket(storageClient: any) {
  try {
    const { data, error } = await storageClient.getBucket(STORAGE_BUCKET)

    if (data && !error) {
      const { error: updateError } = await storageClient.updateBucket(
        STORAGE_BUCKET,
        papersBucketOptions,
      )

      if (updateError) {
        return {
          ready: false,
          warning:
            `El bucket papers existe, pero no se pudo actualizar su límite a ${MAX_PDF_SIZE_MB} MB: ` +
            updateError.message,
        }
      }

      return { ready: true, warning: "" }
    }
  } catch (error: unknown) {
    console.warn("[Paper] no se pudo consultar el bucket papers:", error)
  }

  try {
    const { error } = await storageClient.createBucket(
      STORAGE_BUCKET,
      papersBucketOptions,
    )

    if (error) {
      return {
        ready: false,
        warning: `No se pudo crear el bucket papers: ${error.message}`,
      }
    }

    return { ready: true, warning: "" }
  } catch (error: unknown) {
    return {
      ready: false,
      warning: `No se pudo preparar el bucket papers: ${getErrorMessage(error)}`,
    }
  }
}

async function prepareUpload(params: {
  body: any
  user: { id: string }
  userClient: any
}) {
  const { body, user, userClient } = params
  const filename = safeFilename(getString(body?.filename) || "documento.pdf")
  const mimeType = getString(body?.mimeType) || "application/pdf"
  const size = Number(body?.size || 0)

  if (mimeType !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) {
    return Response.json(
      { error: "Por ahora Chat Paper solo acepta archivos PDF." },
      { status: 400 },
    )
  }

  if (!Number.isFinite(size) || size <= 0) {
    return Response.json(
      { error: "El archivo PDF está vacío o tiene un tamaño inválido." },
      { status: 400 },
    )
  }

  if (size > MAX_PDF_SIZE_BYTES) {
    return Response.json(
      {
        error: `El PDF pesa ${(size / 1024 / 1024).toFixed(1)} MB. El límite actual es ${MAX_PDF_SIZE_MB} MB.`,
      },
      { status: 413 },
    )
  }

  const adminClient = getAdminClient()
  let storageWarning = ""

  if (adminClient) {
    const bucketStatus = await ensurePapersBucket(adminClient.storage)
    storageWarning = bucketStatus.warning

    if (!bucketStatus.ready) {
      console.warn("[Paper][storage]", storageWarning)
    }
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
          "No se pudo crear la subida segura. Revisa el bucket papers y sus políticas de Storage.",
        storageWarning: storageWarning || undefined,
      },
      { status: 500 },
    )
  }

  return Response.json({
    ok: true,
    action: "prepare-upload",
    directUpload: true,
    bucket: STORAGE_BUCKET,
    filePath,
    filename,
    token: data.token,
    signedUrl: data.signedUrl,
    maxSizeMB: MAX_PDF_SIZE_MB,
    storageWarning: storageWarning || undefined,
  })
}

type StoredPaperDocument = {
  id?: string | null
  bucket?: string | null
  file_path?: string | null
  title?: string | null
  summary?: string | null
  page_count?: number | null
  extraction_method?: string | null
  parser_used?: string | null
  ocr_used?: boolean | null
  source_file_size_bytes?: number | null
}

type StorageHistoryEntry = {
  name?: string | null
  created_at?: string | null
  updated_at?: string | null
  metadata?: Record<string, unknown> | null
}

function titleFromStorageName(name: string) {
  return String(name || "Documento")
    .replace(/^\d{10,}-/, "")
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "Documento"
}

function uploadedAtFromPath(filePath: string, fallback = "") {
  const filename = filePath.split("/").pop() || ""
  const timestamp = Number(filename.match(/^(\d{10,})-/)?.[1] || 0)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp).toISOString()
  }
  return fallback || new Date(0).toISOString()
}

function storageEntrySize(entry: StorageHistoryEntry) {
  const metadata = entry.metadata || {}
  const candidates = [
    metadata.size,
    metadata.contentLength,
    metadata.content_length,
  ]

  for (const candidate of candidates) {
    const size = Number(candidate || 0)
    if (Number.isFinite(size) && size > 0) return size
  }

  return 0
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json(
      { error: "Sesión no válida. Vuelve a iniciar sesión." },
      { status: 401 },
    )
  }

  try {
    const adminClient = getAdminClient()
    const dataClient: any = adminClient || supabase
    let warning = ""

    const { data: storedFiles, error: storageError } = await dataClient.storage
      .from(STORAGE_BUCKET)
      .list(user.id, {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      })

    if (storageError) {
      warning = "No se pudo consultar completamente Supabase Storage: " + storageError.message
      console.warn("[Paper][history][storage]", storageError)
    }

    const { data: documents, error: documentsError } = await dataClient
      .from("paper_documents")
      .select(
        "id,bucket,file_path,title,summary,page_count,extraction_method,parser_used,ocr_used,source_file_size_bytes",
      )
      .eq("user_id", user.id)
      .eq("bucket", STORAGE_BUCKET)
      .limit(200)

    if (documentsError) {
      warning = warning || "Los archivos están disponibles, pero no se pudo leer el estado de la caché."
      console.warn("[Paper][history][documents]", documentsError)
    }

    const documentMap = new Map<string, StoredPaperDocument>()
    for (const document of (documents || []) as StoredPaperDocument[]) {
      if (document.file_path) documentMap.set(document.file_path, document)
    }

    const items = ((storedFiles || []) as StorageHistoryEntry[])
      .filter((entry) => !!entry.name && entry.name.toLowerCase().endsWith(".pdf"))
      .map((entry) => {
        const filePath = user.id + "/" + entry.name
        const document = documentMap.get(filePath)
        const uploadedAt = uploadedAtFromPath(
          filePath,
          entry.created_at || entry.updated_at || "",
        )

        return {
          id: document?.id || null,
          title: document?.title || titleFromStorageName(entry.name || "Documento"),
          bucket: STORAGE_BUCKET,
          filePath,
          summary: document?.summary || "",
          pageCount: Number(document?.page_count || 0),
          extractionMethod: document?.extraction_method || "",
          parserUsed: document?.parser_used || "",
          ocrUsed: !!document?.ocr_used,
          fileSizeBytes: Number(
            document?.source_file_size_bytes || storageEntrySize(entry) || 0,
          ),
          uploadedAt,
          processed: !!document?.id,
        }
      })
      .sort(
        (left, right) =>
          new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
      )

    return Response.json({
      items,
      newestFirst: true,
      warning: warning || undefined,
    })
  } catch (error: unknown) {
    console.error("[Paper][history] error:", error)
    return Response.json(
      { error: getErrorMessage(error) || "No se pudo cargar el historial." },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json(
      { error: "Sesión no válida. Vuelve a iniciar sesión." },
      { status: 401 },
    )
  }

  try {
    const body = await req.json().catch(() => ({}))

    if (body?.action === "prepare-upload") {
      return prepareUpload({ body, user, userClient: supabase })
    }

    const bucket = getString(body?.bucket).trim()
    const filePath = getString(body?.filePath).trim()
    const filename = getString(body?.filename).trim()
    const forceRefresh = body?.forceRefresh === true

    if (!bucket || !filePath) {
      return Response.json({ error: "Faltan bucket o filePath." }, { status: 400 })
    }

    if (bucket !== STORAGE_BUCKET) {
      return Response.json({ error: "Bucket no permitido." }, { status: 400 })
    }

    if (!filePath.startsWith(`${user.id}/`)) {
      return Response.json(
        { error: "No tienes permisos para acceder a este archivo." },
        { status: 403 },
      )
    }

    const result = await ensurePaperProcessed({
      supabase,
      userId: user.id,
      bucket,
      filePath,
      filename,
      forceRefresh,
    })

    if (result.error || !result.text?.trim()) {
      return Response.json(
        {
          error:
            result.summary ||
            "No se pudo extraer texto útil del PDF. Prueba con un PDF que contenga texto seleccionable o revisa la configuración OCR.",
          extractionMethod: result.extractionMethod,
          parserUsed: result.parserUsed,
          ocrUsed: result.ocrUsed,
        },
        { status: 422 },
      )
    }

    if (result.documentId) {
      try {
        await updateChunkEmbeddings({
          supabase,
          documentId: result.documentId,
          userId: user.id,
        })
      } catch (embedError) {
        console.error("[Paper][extract][embeddings] error:", embedError)
      }
    }

    const finalText = truncateText(result.text || "", MAX_RETURN_TEXT_CHARS)

    return Response.json({
      title: result.title,
      text: finalText,
      summary: result.summary,
      pageCount: result.pageCount,
      truncated: finalText.length < (result.text || "").length,
      extractionMethod: result.extractionMethod,
      parserUsed: result.parserUsed,
      ocrUsed: result.ocrUsed,
      fromCache: result.fromCache,
      bucket,
      filePath,
      documentId: result.documentId || null,
      chunkCount: result.chunks?.length || 0,
      error: false,
    })
  } catch (error: unknown) {
    console.error("[Paper][extract] error:", error)

    return Response.json(
      {
        error: getErrorMessage(error) || "No se pudo procesar el PDF automáticamente.",
      },
      { status: 500 },
    )
  }
}
