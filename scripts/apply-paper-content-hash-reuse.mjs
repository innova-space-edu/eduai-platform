import fs from "node:fs"
import path from "node:path"

const target = path.join(process.cwd(), "lib", "papers", "extraction.ts")
if (!fs.existsSync(target)) throw new Error("[paper-hash-reuse] lib/papers/extraction.ts no encontrado")

let source = fs.readFileSync(target, "utf8")
let changed = false

const oldChunkInterface = `export interface PaperChunkRow {
  document_id: string
  user_id: string
  chunk_index: number
  section_title: string | null
  page_start: number
  page_end: number
  content: string
  lexical_hint: string
}`

const newChunkInterface = `export interface PaperChunkRow {
  document_id: string
  user_id: string
  chunk_index: number
  section_title: string | null
  page_start: number
  page_end: number
  content: string
  lexical_hint: string
  embedding?: string | number[] | null
  embedding_model?: string | null
}`

if (!source.includes(newChunkInterface)) {
  if (!source.includes(oldChunkInterface)) {
    throw new Error("[paper-hash-reuse] interfaz PaperChunkRow esperada no encontrada")
  }
  source = source.replace(oldChunkInterface, newChunkInterface)
  changed = true
}

const helperMarker = "async function upsertPaperDocument("
if (!source.includes("async function getReusablePaperDocumentBySha256(")) {
  const index = source.indexOf(helperMarker)
  if (index < 0) throw new Error("[paper-hash-reuse] marcador upsertPaperDocument no encontrado")

  const helpers = `async function getReusablePaperDocumentBySha256(
  supabase: SupabaseClientLike,
  userId: string,
  sha256: string,
  currentFilePath: string,
) {
  try {
    const { data, error } = await supabase
      .from("paper_documents")
      .select("*")
      .eq("user_id", userId)
      .eq("source_file_sha256", sha256)
      .neq("file_path", currentFilePath)
      .limit(1)
      .maybeSingle()

    if (error) {
      if (error.code !== "42703" && !/source_file_sha256|schema cache/i.test(error.message || "")) {
        console.warn("[Paper][hash reuse] lookup:", error.message)
      }
      return null
    }

    return data?.id && data?.raw_text?.trim() ? data : null
  } catch (error) {
    console.warn("[Paper][hash reuse] lookup failed:", error)
    return null
  }
}

async function clonePaperFromHashCache(params: {
  supabase: SupabaseClientLike
  userId: string
  bucket: string
  filePath: string
  title: string
  sha256: string
  sourceFileSizeBytes: number
}): Promise<PaperExtractionResult | null> {
  const reusable = await getReusablePaperDocumentBySha256(
    params.supabase,
    params.userId,
    params.sha256,
    params.filePath,
  )
  if (!reusable?.id) return null

  const reusableChunks = await getPaperChunks(params.supabase, reusable.id)
  if (!reusableChunks.length) return null

  const documentId = await upsertPaperDocument(params.supabase, {
    user_id: params.userId,
    bucket: params.bucket,
    file_path: params.filePath,
    title: params.title,
    raw_text: reusable.raw_text,
    summary: reusable.summary || "",
    page_count: reusable.page_count || 0,
    extraction_method: reusable.extraction_method || "cache-sha256",
    parser_used: reusable.parser_used || "internal-v3",
    ocr_used: !!reusable.ocr_used,
    source_file_size_bytes: params.sourceFileSizeBytes || reusable.source_file_size_bytes || null,
    source_file_sha256: params.sha256,
    metadata: {
      ...(reusable.metadata && typeof reusable.metadata === "object" ? reusable.metadata : {}),
      reused_from_document_id: reusable.id,
      reuse_strategy: "sha256",
      reused_at: new Date().toISOString(),
    },
  })

  const withEmbeddings: PaperChunkRow[] = reusableChunks.map((chunk: any) => ({
    document_id: documentId,
    user_id: params.userId,
    chunk_index: chunk.chunk_index,
    section_title: chunk.section_title ?? null,
    page_start: chunk.page_start,
    page_end: chunk.page_end,
    content: chunk.content,
    lexical_hint: chunk.lexical_hint || "",
    embedding: chunk.embedding ?? null,
    embedding_model: chunk.embedding_model ?? null,
  }))

  try {
    await replacePaperChunks(params.supabase, documentId, withEmbeddings)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/embedding_model|schema cache|column/i.test(message)) throw error

    const basicChunks: PaperChunkRow[] = withEmbeddings.map(({ embedding: _embedding, embedding_model: _model, ...chunk }) => chunk)
    await replacePaperChunks(params.supabase, documentId, basicChunks)
  }

  await syncLegacyExtractionCache(params.supabase, {
    userId: params.userId,
    bucket: params.bucket,
    filePath: params.filePath,
    title: params.title,
    text: reusable.raw_text,
    summary: reusable.summary || "",
    pageCount: reusable.page_count || 0,
    extractionMethod: reusable.extraction_method || "cache-sha256",
    fileSize: params.sourceFileSizeBytes || reusable.source_file_size_bytes || undefined,
    sha256: params.sha256,
  })

  return {
    title: params.title,
    text: reusable.raw_text,
    summary: reusable.summary || "",
    pageCount: reusable.page_count || 0,
    extractionMethod: reusable.extraction_method || "cache-sha256",
    parserUsed: reusable.parser_used || "internal-v3",
    ocrUsed: !!reusable.ocr_used,
    truncated: false,
    fromCache: true,
    bucket: params.bucket,
    filePath: params.filePath,
    documentId,
    chunks: withEmbeddings.map((chunk) => ({ ...chunk, embedding: undefined, embedding_model: undefined })),
  }
}

`
  source = source.slice(0, index) + helpers + source.slice(index)
  changed = true
}

const parserMarker = `  let chosen: ExtractorResult = {
    text: "",
    pageCount: 0,
    pages: [],
    success: false,
    method: "none",
  }`

const reuseBlock = `  if (!forceRefresh && sha256) {
    const reusedByHash = await clonePaperFromHashCache({
      supabase,
      userId,
      bucket,
      filePath,
      title,
      sha256,
      sourceFileSizeBytes,
    })
    if (reusedByHash) return reusedByHash
  }

${parserMarker}`

if (!source.includes("const reusedByHash = await clonePaperFromHashCache({")) {
  if (!source.includes(parserMarker)) throw new Error("[paper-hash-reuse] bloque inicial del parser no encontrado")
  source = source.replace(parserMarker, reuseBlock)
  changed = true
}

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[paper-hash-reuse] PDF duplicado reutiliza extracción, chunks y embeddings por SHA-256")
} else {
  console.log("[paper-hash-reuse] ya aplicado")
}
