import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source
  if (!source.includes(before)) {
    throw new Error(`[paper-hybrid] No se encontró el ancla: ${label}`)
  }
  return source.replace(before, after)
}

async function patchExtraction() {
  const filePath = path.join(root, "lib/papers/extraction.ts")
  let source = await fs.readFile(filePath, "utf8")

  source = replaceRequired(
    source,
    'import { parseDocumentWithExternalService } from "@/lib/papers/parser-client"',
    'import { parseDocumentWithExternalService } from "@/lib/papers/parser-client"\nimport { extractWithPdfInspector } from "@/lib/papers/pdf-inspector"',
    "import pdf-inspector",
  )

  source = replaceRequired(
    source,
    'export const MAX_PDF_SIZE_MB = 50\nexport const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024',
    'const configuredMaxPdfSizeMb = Number(process.env.PAPER_MAX_PDF_SIZE_MB || 250)\nexport const MAX_PDF_SIZE_MB = Number.isFinite(configuredMaxPdfSizeMb)\n  ? Math.min(Math.max(configuredMaxPdfSizeMb, 10), 500)\n  : 250\nexport const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024',
    "límite PDF",
  )

  source = replaceRequired(
    source,
    `interface ExtractorResult {
  text: string
  pageCount: number
  pages: PageText[]
  summary?: string
  success: boolean
  usedOCR?: boolean
  method: string
}`,
    `interface ExtractorResult {
  text: string
  pageCount: number
  pages: PageText[]
  summary?: string
  success: boolean
  usedOCR?: boolean
  method: string
  pdfType?: string
  pagesNeedingOcr?: number[]
}

function parserNameForMethod(method: string) {
  const normalized = String(method || "").toLowerCase()
  if (normalized.startsWith("pdf-inspector")) return "pdf-inspector"
  if (normalized.includes("pymupdf") || normalized.includes("docling") || normalized.includes("external")) {
    return "eduai-paper-parser"
  }
  if (normalized.includes("pdf-parse")) return "pdf-parse"
  if (normalized.includes("ocr-space")) return "ocr-space"
  if (normalized.includes("gemini")) return "gemini"
  return "internal-v3"
}`,
    "ExtractorResult híbrido",
  )

  const oldPipeline = `  const external = await parseDocumentWithExternalService({
    buffer,
    filename: filename || filePath.split("/").pop() || "documento.pdf",
    mimeType: "application/pdf",
  })

  if (external?.success) {
    chosen = {
      text: external.text,
      pageCount: external.pageCount,
      pages: external.pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text,
      })),
      success: true,
      usedOCR: !!external.ocrUsed,
      method: external.method || "docling-api",
      summary: external.summary,
    }
  } else {
    const pdfResult = await extractTextWithPdfParse(buffer)
    chosen = pdfResult
  }`

  const newPipeline = `  const inspector = await extractWithPdfInspector(buffer)
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
    let sourceUrl: string | undefined
    try {
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 10 * 60)
      sourceUrl = data?.signedUrl || undefined
    } catch (signedUrlError) {
      console.warn("[Paper] signed parser URL failed:", signedUrlError)
    }

    const external = await parseDocumentWithExternalService({
      buffer: buffer.byteLength <= 50 * 1024 * 1024 ? buffer : undefined,
      sourceUrl,
      filename: filename || filePath.split("/").pop() || "documento.pdf",
      mimeType: "application/pdf",
      forceOCR: localNeedsOcr || !localCandidate.success,
    })

    if (external?.success) {
      chosen = {
        text: external.text,
        pageCount: external.pageCount,
        pages: external.pages.map((p) => ({
          pageNumber: p.pageNumber,
          text: p.text,
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
  }`

  source = replaceRequired(source, oldPipeline, newPipeline, "pipeline de extracción")

  source = source.replaceAll(
    'parserUsed: "internal-v2",',
    'parserUsed: parserNameForMethod(chosen.method),',
  )

  source = replaceRequired(
    source,
    'parser_used: chosen.method === "docling-api" ? "docling" : "internal-v2",',
    'parser_used: parserNameForMethod(chosen.method),',
    "parser usado persistido",
  )

  source = replaceRequired(
    source,
    `    metadata: {
      chunk_count: builtChunks.length,
    },`,
    `    metadata: {
      chunk_count: builtChunks.length,
      pdf_type: chosen.pdfType || null,
      pages_needing_ocr: chosen.pagesNeedingOcr || [],
    },`,
    "metadata híbrida",
  )

  await fs.writeFile(filePath, source)
}

async function patchPaperPage() {
  const filePath = path.join(root, "app/paper/page.tsx")
  let source = await fs.readFile(filePath, "utf8")

  source = replaceRequired(
    source,
    'import { createClient } from "@/lib/supabase/client"',
    'import { createClient } from "@/lib/supabase/client"\nimport { uploadPdfResumable } from "@/lib/papers/resumable-upload"\nimport PdfPreview from "@/components/paper/PdfPreview"',
    "imports de carga y vista previa",
  )

  source = replaceRequired(
    source,
    'const STORAGE_BUCKET = "papers"',
    'const STORAGE_BUCKET = "papers"\nconst RESUMABLE_UPLOAD_BYTES = 6 * 1024 * 1024',
    "umbral TUS",
  )

  source = replaceRequired(
    source,
    '  const [uploading, setUploading] = useState(false)\n  const [extracting, setExtracting] = useState(false)',
    '  const [uploading, setUploading] = useState(false)\n  const [uploadProgress, setUploadProgress] = useState(0)\n  const [extracting, setExtracting] = useState(false)',
    "estado de progreso",
  )

  source = replaceRequired(
    source,
    '    setError("")\n    setUploading(true)\n    setExtracting(false)',
    '    setError("")\n    setUploading(true)\n    setUploadProgress(0)\n    setExtracting(false)',
    "reinicio de progreso",
  )

  const oldUpload = `        const { error: signedUploadError } = await supabase.storage
          .from(signedBucket)
          .uploadToSignedUrl(signedPath, signedToken, file, {
            contentType: "application/pdf",
          })

        if (signedUploadError) throw signedUploadError
        uploadData = signedData`

  const newUpload = `        if (file.size >= RESUMABLE_UPLOAD_BYTES) {
          await uploadPdfResumable({
            supabase,
            bucket: signedBucket,
            objectName: signedPath,
            file,
            onProgress: ({ percentage }) => setUploadProgress(percentage),
          })
        } else {
          const { error: signedUploadError } = await supabase.storage
            .from(signedBucket)
            .uploadToSignedUrl(signedPath, signedToken, file, {
              contentType: "application/pdf",
            })

          if (signedUploadError) throw signedUploadError
          setUploadProgress(100)
        }
        uploadData = signedData`

  source = replaceRequired(source, oldUpload, newUpload, "carga TUS principal")

  source = replaceRequired(
    source,
    '{uploading ? "Subiendo…" : "Procesando…"}',
    '{uploading ? `Subiendo ${uploadProgress}%` : "Procesando…"}',
    "texto de progreso",
  )

  source = replaceRequired(
    source,
    `              {paperSummary && (
                <p className="mt-3 text-xs text-sub leading-relaxed border-t border-soft pt-3">
                  {paperSummary}
                </p>
              )}

              <div className="flex gap-2 mt-3">`,
    `              {paperSummary && (
                <p className="mt-3 text-xs text-sub leading-relaxed border-t border-soft pt-3">
                  {paperSummary}
                </p>
              )}

              <PdfPreview
                bucket={storageBucket}
                filePath={storagePath}
                title={paperTitle}
              />

              <div className="flex gap-2 mt-3">`,
    "vista previa en panel",
  )

  await fs.writeFile(filePath, source)
}

await patchExtraction()
await patchPaperPage()
console.log("[paper-hybrid] Parser híbrido, TUS y vista previa aplicados.")
