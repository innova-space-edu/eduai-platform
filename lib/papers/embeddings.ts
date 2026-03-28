const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
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

function chunkForEmbedding(text: string, maxChars = 8000) {
  const clean = cleanEmbeddingText(text)
  if (clean.length <= maxChars) return clean
  return clean.slice(0, maxChars)
}

export function toPgVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`
}

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY para generar embeddings.")
  }

  const input = chunkForEmbedding(text)
  if (!input) {
    throw new Error("No hay texto útil para generar embedding.")
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: input }],
        },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    }
  )

  const raw = await res.text()

  if (!res.ok) {
    throw new Error(`Gemini embeddings error ${res.status}: ${raw}`)
  }

  const data = JSON.parse(raw)
  const values = data?.embedding?.values

  if (!Array.isArray(values) || !values.length) {
    throw new Error("La respuesta de Gemini no devolvió embedding válido.")
  }

  return values.map((v: unknown) => Number(v))
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = []

  for (const text of texts) {
    const vec = await embedText(text)
    results.push(vec)
  }

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
    .select("id, chunk_index, section_title, content, embedding")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .order("chunk_index", { ascending: true })

  if (error) {
    throw error
  }

  const pending = (chunks || []).filter((chunk: any) => !chunk.embedding)

  for (const chunk of pending) {
    const embeddingSource =
      `${chunk.section_title || ""}\n\n${chunk.content || ""}`.trim()

    const vector = await embedText(embeddingSource)
    const literal = toPgVectorLiteral(vector)

    const { error: updateError } = await supabase
      .from("paper_chunks")
      .update({ embedding: literal })
      .eq("id", chunk.id)
      .eq("user_id", userId)

    if (updateError) {
      throw updateError
    }
  }

  return {
    total: chunks?.length || 0,
    embedded: pending.length,
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

  const queryEmbedding = await embedText(query)
  const queryVector = toPgVectorLiteral(queryEmbedding)

  const { data, error } = await supabase.rpc("match_paper_chunks", {
    query_embedding: queryVector,
    match_count: limit,
    filter_document_id: documentId,
    filter_user_id: userId,
  })

  if (error) {
    throw error
  }

  return data || []
}
