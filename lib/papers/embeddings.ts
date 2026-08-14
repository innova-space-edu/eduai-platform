import { GoogleGenAI } from "@google/genai"

const GEMINI_EMBEDDING_MODEL = process.env.GOOGLE_EMBEDDING_MODEL || "gemini-embedding-2"
const EMBEDDING_DIMENSIONS = 768

function cleanEmbeddingText(text: string) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function chunkForEmbedding(text: string, maxChars = 8_000) {
  const clean = cleanEmbeddingText(text)
  if (clean.length <= maxChars) return clean
  return clean.slice(0, maxChars)
}

function embeddingKeys() {
  return (
    process.env.GEMINI_API_KEY_POOL ||
    process.env.GEMINI_API_KEY_TEXT ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  )
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean)
}

export function toPgVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`
}

export async function embedText(text: string): Promise<number[]> {
  const keys = embeddingKeys()
  if (!keys.length) throw new Error("Falta GEMINI_API_KEY para generar embeddings.")

  const input = chunkForEmbedding(text)
  if (!input) throw new Error("No hay texto útil para generar embedding.")

  const key = keys[Math.floor(Math.random() * keys.length)]
  const ai = new GoogleGenAI({ apiKey: key })
  const response = await ai.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: input,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  })

  const values = response.embeddings?.[0]?.values
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("La respuesta de Gemini no devolvió un embedding de 768 dimensiones.")
  }
  return values.map((value) => Number(value))
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (const text of texts) results.push(await embedText(text))
  return results
}

export async function updateChunkEmbeddings(params: {
  supabase: any
  documentId: string
  userId: string
}) {
  const { supabase, documentId, userId } = params

  const { data: chunks, error } = await supabase
    .from("paper_chunks")
    .select("id, chunk_index, section_title, content, embedding, embedding_model")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .order("chunk_index", { ascending: true })

  if (error) {
    // Si aún no se aplicó embedding_model, dejar que Chat Paper use lexical fallback.
    if (error.code === "42703" || /embedding_model/i.test(error.message || "")) {
      return { total: 0, embedded: 0, migrationRequired: true }
    }
    throw error
  }

  const pending = (chunks || []).filter((chunk: any) =>
    !chunk.embedding || chunk.embedding_model !== GEMINI_EMBEDDING_MODEL
  )

  let embedded = 0
  for (const chunk of pending) {
    const embeddingSource = `${chunk.section_title || ""}\n\n${chunk.content || ""}`.trim()
    const vector = await embedText(embeddingSource)
    const literal = toPgVectorLiteral(vector)

    const { error: updateError } = await supabase
      .from("paper_chunks")
      .update({ embedding: literal, embedding_model: GEMINI_EMBEDDING_MODEL })
      .eq("id", chunk.id)
      .eq("user_id", userId)

    if (updateError) throw updateError
    embedded += 1
  }

  return {
    total: chunks?.length || 0,
    embedded,
    model: GEMINI_EMBEDDING_MODEL,
  }
}

export async function semanticSearchPaperChunks(params: {
  supabase: any
  userId: string
  documentId: string
  query: string
  limit?: number
}) {
  const { supabase, userId, documentId, query, limit = 8 } = params

  // No comparar embeddings nuevos con vectores viejos si el documento no ha sido migrado por completo.
  const { count, error: countError } = await supabase
    .from("paper_chunks")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .not("embedding", "is", null)
    .neq("embedding_model", GEMINI_EMBEDDING_MODEL)

  if (countError) {
    if (countError.code === "42703" || /embedding_model/i.test(countError.message || "")) return []
    throw countError
  }
  if ((count || 0) > 0) return []

  const queryEmbedding = await embedText(query)
  const queryVector = toPgVectorLiteral(queryEmbedding)
  const { data, error } = await supabase.rpc("match_paper_chunks", {
    query_embedding: queryVector,
    match_count: limit,
    filter_document_id: documentId,
    filter_user_id: userId,
  })

  if (error) throw error
  return data || []
}