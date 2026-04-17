import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"
import {
  STORAGE_BUCKET,
  ensurePaperProcessed,
  cleanText,
} from "@/lib/papers/extraction"
import { semanticSearchPaperChunks, updateChunkEmbeddings } from "@/lib/papers/embeddings"

export const runtime = "nodejs"

type ChunkRecord = {
  id?: string
  chunk_index: number
  section_title: string | null
  page_start: number
  page_end: number
  content: string
  lexical_hint: string
  similarity?: number
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalize(text: string) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s\-.:/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractKeywords(text: string) {
  const stopwords = new Set([
    "de","la","el","los","las","un","una","unos","unas","y","o","u","que","qué",
    "en","por","para","con","sin","del","al","se","su","sus","es","son","ser",
    "como","cómo","cuál","cuáles","me","mi","tu","te","lo","le","les","this","that",
    "the","and","or","for","with","from","into","about","paper","documento","artículo"
  ])

  return Array.from(
    new Set(
      normalize(text)
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length >= 3 && !stopwords.has(t))
    )
  ).slice(0, 20)
}

function scoreChunkLexically(chunk: ChunkRecord, query: string) {
  const content = normalize(`${chunk.section_title || ""} ${chunk.content} ${chunk.lexical_hint || ""}`)
  const keywords = extractKeywords(query)

  let score = 0

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "gi")
    const matches = content.match(regex)
    if (matches) score += matches.length * 4
    else if (content.includes(keyword)) score += 1
  }

  if (/(resumen|abstract|summary)/i.test(query) && /(abstract|summary|resumen)/i.test(content)) score += 5
  if (/(m[eé]todo|metodolog|method)/i.test(query) && /(method|methodology|metodolog)/i.test(content)) score += 5
  if (/(resultado|hallazgo|result)/i.test(query) && /(result|resultado|finding)/i.test(content)) score += 5
  if (/(conclusi)/i.test(query) && /(conclusi|discussion)/i.test(content)) score += 5
  if (/(tabla|figure|figura|ecuaci|formula)/i.test(query) && /(tabla|table|figure|figura|equation|ecuaci|formula)/i.test(content)) score += 4

  return score
}

function mergeSemanticAndLexical(params: {
  semantic: ChunkRecord[]
  lexical: ChunkRecord[]
  maxItems?: number
}) {
  const { semantic, lexical, maxItems = 8 } = params
  const map = new Map<number, ChunkRecord & { rankScore: number }>()

  semantic.forEach((chunk, index) => {
    map.set(chunk.chunk_index, {
      ...chunk,
      rankScore: (map.get(chunk.chunk_index)?.rankScore || 0) + (100 - index * 8) + ((chunk.similarity || 0) * 20),
    })
  })

  lexical.forEach((chunk, index) => {
    map.set(chunk.chunk_index, {
      ...chunk,
      rankScore: (map.get(chunk.chunk_index)?.rankScore || 0) + (60 - index * 5),
    })
  })

  return Array.from(map.values())
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, maxItems)
}

async function rerankChunksWithGemini(question: string, chunks: ChunkRecord[]) {
  if (!process.env.GEMINI_API_KEY || chunks.length <= 3) return chunks.slice(0, 5)

  try {
    const compact = chunks.map((chunk) => ({
      chunk_index: chunk.chunk_index,
      section_title: chunk.section_title,
      page_start: chunk.page_start,
      page_end: chunk.page_end,
      preview: chunk.content.slice(0, 1000),
    }))

    const messages = [
      {
        role: "system" as const,
        content:
          "Eres un reranker documental. " +
          "Debes elegir los fragmentos más útiles para responder una pregunta sobre un documento. " +
          'Responde SOLO JSON válido con este formato: {"selected":[0,3,2,5]}. ' +
          "Máximo 5 índices. No expliques nada.",
      },
      {
        role: "user" as const,
        content:
          `Pregunta del usuario:\n${question}\n\n` +
          `Fragmentos candidatos:\n${JSON.stringify(compact)}`,
      },
    ]

    const result = await callAI(messages, {
      maxTokens: 300,
      preferProvider: "gemini-lite",
    })

    const raw = result.text || ""
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(raw)

    const selected = Array.isArray(parsed?.selected)
      ? parsed.selected.filter((n: unknown) => Number.isInteger(n)).map((n: number) => Number(n))
      : []

    const byIndex = new Map(chunks.map(chunk => [chunk.chunk_index, chunk]))
    const reranked = selected
      .map((index: number) => byIndex.get(index))
      .filter(Boolean) as ChunkRecord[]

    return reranked.length ? reranked.slice(0, 5) : chunks.slice(0, 5)
  } catch (error) {
    console.warn("[Paper][rerank] fallback merged:", error)
    return chunks.slice(0, 5)
  }
}

function buildCitationLabel(chunk: ChunkRecord) {
  const pageLabel =
    chunk.page_start === chunk.page_end
      ? `p. ${chunk.page_start}`
      : `pp. ${chunk.page_start}-${chunk.page_end}`

  const sectionLabel = chunk.section_title ? ` · ${chunk.section_title}` : ""
  return `Fragmento ${chunk.chunk_index + 1} (${pageLabel}${sectionLabel})`
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const body = await req.json()

    const message = typeof body?.message === "string" ? body.message.trim() : ""
    const history = Array.isArray(body?.history) ? body.history : []
    const paperTitle = typeof body?.paperTitle === "string" ? body.paperTitle : "Documento"
    const storagePath = typeof body?.storagePath === "string" ? body.storagePath : ""
    const storageBucket =
      typeof body?.storageBucket === "string" ? body.storageBucket : STORAGE_BUCKET

    if (!message) {
      return Response.json({ error: "Falta la pregunta del usuario." }, { status: 400 })
    }

    if (!storagePath) {
      return Response.json({ error: "Falta la ruta del documento en Storage." }, { status: 400 })
    }

    if (storageBucket !== STORAGE_BUCKET) {
      return Response.json({ error: "Bucket no permitido." }, { status: 400 })
    }

    if (!storagePath.startsWith(`${user.id}/`)) {
      return Response.json(
        { error: "No tienes permisos para acceder a este archivo." },
        { status: 403 }
      )
    }

    const paper = await ensurePaperProcessed({
      supabase,
      userId: user.id,
      bucket: storageBucket,
      filePath: storagePath,
      filename: paperTitle,
      forceRefresh: false,
    })

    if (!paper.text?.trim()) {
      return Response.json(
        { error: "No hay texto disponible para analizar en este documento." },
        { status: 400 }
      )
    }

    if (paper.documentId) {
      try {
        await updateChunkEmbeddings({
          supabase,
          documentId: paper.documentId,
          userId: user.id,
        })
      } catch (embedError) {
        console.error("[Paper][chat][embeddings] error:", embedError)
      }
    }

    let chunks: ChunkRecord[] = Array.isArray(paper.chunks) ? (paper.chunks as ChunkRecord[]) : []

    if (!chunks.length && paper.documentId) {
      const { data } = await supabase
        .from("paper_chunks")
        .select("*")
        .eq("document_id", paper.documentId)
        .order("chunk_index", { ascending: true })

      chunks = (data || []) as ChunkRecord[]
    }

    if (!chunks.length) {
      return Response.json(
        { error: "El documento no tiene fragmentos indexados todavía." },
        { status: 400 }
      )
    }

    let semanticTop: ChunkRecord[] = []
    if (paper.documentId) {
      try {
        semanticTop = await semanticSearchPaperChunks({
          supabase,
          userId: user.id,
          documentId: paper.documentId,
          query: message,
          limit: 8,
        })
      } catch (semanticError) {
        console.warn("[Paper][semantic] fallback lexical:", semanticError)
      }
    }

    const lexicalTop = chunks
      .map(chunk => ({
        chunk,
        score: scoreChunkLexically(chunk, message),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(item => item.chunk)

    const merged = mergeSemanticAndLexical({
      semantic: semanticTop,
      lexical: lexicalTop,
      maxItems: 8,
    })

    const selected = await rerankChunksWithGemini(message, merged)

    const contextBlock = selected
      .map(chunk => `### ${buildCitationLabel(chunk)}\n${cleanText(chunk.content)}`)
      .join("\n\n")

    const systemPrompt =
  `Eres APaper, el agente de análisis de documentos de EduAI. Hablas como un colega inteligente que acaba de leer el documento completo y quiere compartir lo que encontró de forma natural y conversacional.
   
  DOCUMENTO: "${paper.title || paperTitle}"
  RESUMEN GENERAL:
  ${paper.summary}
   
  FRAGMENTOS RECUPERADOS PARA ESTA PREGUNTA:
  ${contextBlock}
   
  CÓMO RESPONDER:
  - Sé conversacional y directo, como si explicaras a un amigo inteligente. No uses listas de bullets como primer recurso — escribe en párrafos fluidos.
  - Si hay varios puntos importantes, puedes usar una lista corta (máximo 4-5 ítems), pero empieza siempre con una frase introductoria que conecte la respuesta con la pregunta.
  - Cita los fragmentos de forma natural: "según la sección sobre metodología..." o "en el fragmento 3 se menciona que..." — no como labels técnicos al principio de cada párrafo.
  - Si la pregunta pide un resumen general, empieza con la idea central en 1-2 frases, luego desarrolla los puntos clave como una historia coherente.
  - Si la pregunta pide análisis, separa claramente qué dice el documento ("el autor sostiene que...") de tu interpretación ("esto sugiere que...").
  - Si la evidencia es insuficiente para responder bien, dilo de forma honesta y sugiere qué preguntas alternativas podrían funcionar mejor.
  - Usa LaTeX para fórmulas: $E = mc^2$ para inline, $$...$$ para bloques.
  - Responde siempre en español salvo que el usuario pida otro idioma.
  - Longitud ideal: 3-5 párrafos para respuestas generales. Más breve si la pregunta es específica. No rellenes con perogrulladas.`
    
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-10).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: typeof m?.content === "string" ? m.content : "",
      })),
      { role: "user" as const, content: message },
    ]

    const result = await callAI(messages, {
      maxTokens: 2200,
      preferProvider: "gemini",
    })

    return Response.json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      storageBucket,
      storagePath,
      extractionMethod: paper.extractionMethod,
      parserUsed: paper.parserUsed,
      ocrUsed: paper.ocrUsed,
      fromCache: paper.fromCache,
      citations: selected.map(chunk => ({
        chunkIndex: chunk.chunk_index,
        sectionTitle: chunk.section_title,
        pageStart: chunk.page_start,
        pageEnd: chunk.page_end,
      })),
    })
  } catch (e: any) {
    console.error("[Paper][chat] error:", e)
    return Response.json(
      { error: e?.message || "Error al analizar el paper." },
      { status: 500 }
    )
  }
}
