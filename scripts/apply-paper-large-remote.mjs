import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const REMOTE_MARKER = "const SERVER_BUFFER_MAX_MB"

async function patchExtraction() {
  const filePath = path.join(root, "lib/papers/extraction.ts")
  let source = await fs.readFile(filePath, "utf8")
  if (source.includes(REMOTE_MARKER)) return

  const start = source.indexOf("export async function ensurePaperProcessed(")
  if (start < 0) throw new Error("[paper-large-remote] No se encontró ensurePaperProcessed")

  const replacement = `export async function ensurePaperProcessed(params: {
  supabase: SupabaseClientLike
  userId: string
  bucket: string
  filePath: string
  filename?: string
  forceRefresh?: boolean
}): Promise<PaperExtractionResult> {
  const {
    supabase,
    userId,
    bucket,
    filePath,
    filename = "",
    forceRefresh = false,
  } = params

  const title = deriveTitle(filename, filePath)

  if (!forceRefresh) {
    const cachedDoc = await getPaperDocument(supabase, userId, bucket, filePath)
    if (cachedDoc?.raw_text?.trim()) {
      const chunks = cachedDoc.id ? await getPaperChunks(supabase, cachedDoc.id) : []

      return {
        title: cachedDoc.title || title,
        text: cachedDoc.raw_text,
        summary: cachedDoc.summary || "",
        pageCount: cachedDoc.page_count || 0,
        extractionMethod: cachedDoc.extraction_method || "cache",
        parserUsed: cachedDoc.parser_used || "internal-v3",
        ocrUsed: !!cachedDoc.ocr_used,
        truncated: false,
        fromCache: true,
        bucket,
        filePath,
        documentId: cachedDoc.id,
        chunks,
      }
    }
  }

  const resolvedFilename = filename || filePath.split("/").pop() || "documento.pdf"
  const configuredServerBufferMb = Number(process.env.PAPER_SERVER_BUFFER_MAX_MB || 40)
  const SERVER_BUFFER_MAX_MB = Number.isFinite(configuredServerBufferMb)
    ? Math.min(Math.max(configuredServerBufferMb, 5), 80)
    : 40
  const serverBufferMaxBytes = SERVER_BUFFER_MAX_MB * 1024 * 1024

  const lastSlash = filePath.lastIndexOf("/")
  const folder = lastSlash >= 0 ? filePath.slice(0, lastSlash) : ""
  const objectName = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath

  let sourceFileSizeBytes = 0
  try {
    const { data: entries } = await supabase.storage
      .from(bucket)
      .list(folder, { search: objectName, limit: 20 })
    const entry = (entries || []).find((item: any) => item?.name === objectName)
    sourceFileSizeBytes = Number(
      entry?.metadata?.size ||
      entry?.metadata?.contentLength ||
      entry?.metadata?.content_length ||
      0
    )
  } catch (metadataError) {
    console.warn("[Paper] no se pudo leer metadata de Storage:", metadataError)
  }

  let sourceUrl: string | undefined
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 15 * 60)
    if (!error) sourceUrl = data?.signedUrl || undefined
  } catch (signedUrlError) {
    console.warn("[Paper] no se pudo crear URL firmada:", signedUrlError)
  }

  if (!sourceFileSizeBytes && sourceUrl) {
    try {
      const head = await fetch(sourceUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      })
      const contentLength = Number(head.headers.get("content-length") || 0)
      if (Number.isFinite(contentLength) && contentLength > 0) {
        sourceFileSizeBytes = contentLength
      }
    } catch (headError) {
      console.warn("[Paper] HEAD de Storage no disponible:", headError)
    }
  }

  if (sourceFileSizeBytes > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      \`El archivo pesa \${(sourceFileSizeBytes / 1024 / 1024).toFixed(1)} MB y excede el límite de \${MAX_PDF_SIZE_MB} MB.\`
    )
  }

  let buffer: Buffer | null = null
  let sha256: string | null = null

  const shouldBufferOnVercel =
    !sourceFileSizeBytes ||
    sourceFileSizeBytes <= serverBufferMaxBytes ||
    !sourceUrl

  if (shouldBufferOnVercel) {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath)

    if (downloadError || !fileBlob) {
      throw new Error("No se pudo descargar el PDF desde Supabase Storage.")
    }

    sourceFileSizeBytes = fileBlob.size
    if (sourceFileSizeBytes > MAX_PDF_SIZE_BYTES) {
      throw new Error(
        \`El archivo pesa \${(sourceFileSizeBytes / 1024 / 1024).toFixed(1)} MB y excede el límite de \${MAX_PDF_SIZE_MB} MB.\`
      )
    }

    const arrayBuffer = await fileBlob.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
    sha256 = createHash("sha256").update(buffer).digest("hex")
  }

  let chosen: ExtractorResult = {
    text: "",
    pageCount: 0,
    pages: [],
    success: false,
    method: "none",
  }

  if (!buffer) {
    const external = await parseDocumentWithExternalService({
      sourceUrl,
      filename: resolvedFilename,
      mimeType: "application/pdf",
      forceOCR: false,
    })

    if (external?.success) {
      chosen = {
        text: external.text,
        pageCount: external.pageCount,
        pages: external.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
        })),
        success: true,
        usedOCR: !!external.ocrUsed,
        method: external.method || "eduai-paper-parser-remote",
        summary: external.summary,
        pdfType: String(external.metadata?.pdfType || "RemoteLarge"),
        pagesNeedingOcr: Array.isArray(external.metadata?.pagesNeedingOcr)
          ? external.metadata.pagesNeedingOcr
          : [],
      }
    }
  } else {
    const inspector = await extractWithPdfInspector(buffer)
    const inspectorCandidate: ExtractorResult = {
      text: inspector.text,
      pageCount: inspector.pageCount,
      pages: inspector.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
      })),
      success: inspector.success,
      usedOCR: false,
      method: "pdf-inspector",
      pdfType: inspector.pdfType,
      pagesNeedingOcr: inspector.pagesNeedingOcr,
    }

    let localCandidate = inspectorCandidate
    if (!inspector.available) {
      localCandidate = await extractTextWithPdfParse(buffer)
    }

    const localNeedsOcr = inspector.available && (
      inspector.pdfType !== "TextBased" || inspector.pagesNeedingOcr.length > 0
    )

    if (localCandidate.success && !localNeedsOcr) {
      chosen = localCandidate
    } else {
      const external = await parseDocumentWithExternalService({
        buffer: buffer.byteLength <= 50 * 1024 * 1024 ? buffer : undefined,
        sourceUrl,
        filename: resolvedFilename,
        mimeType: "application/pdf",
        forceOCR: localNeedsOcr || !localCandidate.success,
      })

      if (external?.success) {
        chosen = {
          text: external.text,
          pageCount: external.pageCount,
          pages: external.pages.map((page) => ({
            pageNumber: page.pageNumber,
            text: page.text,
          })),
          success: true,
          usedOCR: !!external.ocrUsed,
          method: external.method || "eduai-paper-parser",
          summary: external.summary,
          pdfType: inspector.pdfType,
          pagesNeedingOcr: inspector.pagesNeedingOcr,
        }
      } else if (localCandidate.success) {
        chosen = localCandidate
      } else {
        chosen = await extractTextWithPdfParse(buffer)
      }
    }

    if (!chosen.success) {
      const ocrResult = await extractTextWithOCR(buffer, resolvedFilename)
      if (ocrResult.success) chosen = ocrResult
    }

    if (!chosen.success && buffer.byteLength <= MAX_GEMINI_INLINE_PDF_BYTES) {
      const geminiResult = await extractTextWithGemini(buffer.toString("base64"), title)
      if (geminiResult.success) chosen = geminiResult
    }
  }

  const extractedText = cleanText(chosen.text)
  const pages = chosen.pages?.length ? chosen.pages : buildPagesFromRawText(extractedText)

  if (!extractedText) {
    return {
      title,
      text: "",
      summary: buffer
        ? "No se pudo extraer texto útil del documento."
        : "El parser remoto no pudo procesar el PDF grande. Revisa el estado de Hugging Face o vuelve a intentarlo.",
      pageCount: chosen.pageCount || 0,
      extractionMethod: chosen.method || "none",
      parserUsed: parserNameForMethod(chosen.method),
      ocrUsed: !!chosen.usedOCR,
      truncated: false,
      fromCache: false,
      bucket,
      filePath,
      error: true,
    }
  }

  const summary = chosen.summary || await summarizeWithGemini(title, extractedText) || "Documento procesado correctamente."
  const builtChunks = buildChunksFromPages(pages)
  const parserUsed = parserNameForMethod(chosen.method)

  const documentId = await upsertPaperDocument(supabase, {
    user_id: userId,
    bucket,
    file_path: filePath,
    title,
    raw_text: extractedText,
    summary,
    page_count: chosen.pageCount || pages.length || 1,
    extraction_method: chosen.method,
    parser_used: parserUsed,
    ocr_used: !!chosen.usedOCR,
    source_file_size_bytes: sourceFileSizeBytes || null,
    source_file_sha256: sha256,
    metadata: {
      chunk_count: builtChunks.length,
      pdf_type: chosen.pdfType || null,
      pages_needing_ocr: chosen.pagesNeedingOcr || [],
      input_mode: buffer ? "vercel-buffer" : "signed-url",
      server_buffer_limit_mb: SERVER_BUFFER_MAX_MB,
    },
  })

  const chunkRows: PaperChunkRow[] = builtChunks.map((chunk, index) => ({
    document_id: documentId,
    user_id: userId,
    chunk_index: index,
    section_title: chunk.sectionTitle,
    page_start: chunk.pageStart,
    page_end: chunk.pageEnd,
    content: chunk.content,
    lexical_hint: chunk.lexicalHint,
  }))

  await replacePaperChunks(supabase, documentId, chunkRows)

  await syncLegacyExtractionCache(supabase, {
    userId,
    bucket,
    filePath,
    title,
    text: extractedText,
    summary,
    pageCount: chosen.pageCount || pages.length || 1,
    extractionMethod: chosen.method,
    fileSize: sourceFileSizeBytes || undefined,
    sha256: sha256 || undefined,
  })

  return {
    title,
    text: extractedText,
    summary,
    pageCount: chosen.pageCount || pages.length || 1,
    extractionMethod: chosen.method,
    parserUsed,
    ocrUsed: !!chosen.usedOCR,
    truncated: false,
    fromCache: false,
    bucket,
    filePath,
    documentId,
    chunks: chunkRows,
  }
}
`

  source = source.slice(0, start) + replacement
  await fs.writeFile(filePath, source)
}

async function patchDuration(relativePath) {
  const filePath = path.join(root, relativePath)
  let source = await fs.readFile(filePath, "utf8")
  source = source.replace("export const maxDuration = 60", "export const maxDuration = 300")
  await fs.writeFile(filePath, source)
}

async function patchHealthRoute() {
  const filePath = path.join(root, "app/api/agents/paper/parser-health/route.ts")
  let source = await fs.readFile(filePath, "utf8")
  if (!source.includes("export const maxDuration")) {
    source = source.replace(
      'export const runtime = "nodejs"',
      'export const runtime = "nodejs"\nexport const maxDuration = 60',
    )
  }
  source = source.replace("AbortSignal.timeout(10000)", "AbortSignal.timeout(55000)")
  await fs.writeFile(filePath, source)
}

async function patchWakeDuringUpload(relativePath, anchor) {
  const filePath = path.join(root, relativePath)
  let source = await fs.readFile(filePath, "utf8")
  if (source.includes("parser-health\", { cache: \"no-store\"")) return
  if (!source.includes(anchor)) {
    throw new Error(`[paper-large-remote] No se encontró ancla de activación en ${relativePath}`)
  }
  source = source.replace(
    anchor,
    `${anchor}\n\n      // Activa el Space durante la subida para que el OCR esté listo si luego se necesita.\n      void fetch("/api/agents/paper/parser-health", { cache: "no-store" }).catch(() => {})`,
  )
  await fs.writeFile(filePath, source)
}

await patchExtraction()
await patchDuration("app/api/agents/paper/extract/route.ts")
await patchDuration("app/api/agents/paper/route.ts")
await patchHealthRoute()
await patchWakeDuringUpload(
  "app/paper/page.tsx",
  "        const signedData = await signedRes.json()",
)
await patchWakeDuringUpload(
  "app/paper-large/page.tsx",
  "      const signed = await signedResponse.json()",
)
console.log("[paper-large-remote] PDF grandes conectados por URL firmada y parser preactivado.")
