import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"
import {
  STORAGE_BUCKET,
  extractPaperFromStorage,
  cleanText,
} from "@/lib/papers/extraction"

export const runtime = "nodejs"

const CHUNK_SIZE = 3500
const CHUNK_OVERLAP = 400
const MAX_SELECTED_CHUNKS = 4

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function splitIntoChunks(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const clean = cleanText(text)
  if (!clean) return []

  const chunks: string[] = []
  let start = 0

  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length)
    const chunk = clean.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= clean.length) break
    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}

function extractKeywords(text: string) {
  const stopwords = new Set([
    "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "u",
    "que", "qué", "en", "por", "para", "con", "sin", "del", "al", "se", "su",
    "sus", "es", "son", "ser", "como", "cómo", "cuál", "cuáles", "qué", "me",
    "mi", "tu", "te", "lo", "le", "les", "this", "that", "the", "and", "or",
    "for", "with", "from", "into", "about", "paper", "documento", "paper?"
  ])

  const normalized = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")

  const terms = normalized
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !stopwords.has(t))

  return Array.from(new Set(terms)).slice(0, 20)
}

function scoreChunk(chunk: string, query: string) {
  const chunkLower = chunk.toLowerCase()
  const keywords = extractKeywords(query)
  let score = 0

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "gi")
    const matches = chunk.match(regex)
    if (matches) {
      score += matches.length * 3
    } else if (chunkLower.includes(keyword)) {
      score += 1
    }
  }

  if (/abstract|summary|resumen/i.test(chunk) && /resume|summary|abstract|resumen/i.test(query)) {
    score += 4
  }

  if (/method|methodology|metodolog/i.test(chunk) && /método|metodolog|method/i.test(query)) {
    score += 4
  }

  if (/result|resultado/i.test(chunk) && /resultado|hallazgo|result/i.test(query)) {
    score += 4
  }

  if (/conclusion|conclusi/i.test(chunk) && /conclusi/i.test(query)) {
    score += 4
  }

  if (/limit/i.test(chunk) && /limit|sesgo|bias/i.test(query)) {
    score += 4
  }

  return score
}

function selectRelevantChunks(text: string, query: string, maxChunks = MAX_SELECTED_CHUNKS) {
  const chunks = splitIntoChunks(text)
  if (!chunks.length) return []

  const scored = chunks.map((chunk, index) => ({
    chunk,
    index,
    score: scoreChunk(chunk, query),
  }))

  const positive = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)

  if (positive.length > 0) {
    return positive
      .sort((a, b) => a.index - b.index)
      .map(item => item.chunk)
  }

  return chunks.slice(0, maxChunks)
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
      return Response.json(
        { error: "Falta la ruta del documento en Storage." },
        { status: 400 }
      )
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

    const paper = await extractPaperFromStorage({
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

    const relevantChunks = selectRelevantChunks(paper.text, message, MAX_SELECTED_CHUNKS)
    const excerptBlock = relevantChunks
      .map((chunk, index) => `### Fragmento ${index + 1}\n${chunk}`)
      .join("\n\n")

    const systemPrompt = `Eres APaper, un agente especializado en análisis profundo de documentos académicos y papers científicos.

DOCUMENTO CARGADO:
Título: "${paper.title || paperTitle}"

FRAGMENTOS RELEVANTES DEL DOCUMENTO:
---
${excerptBlock}
---

TUS CAPACIDADES:
1. Responder preguntas específicas sobre el paper con citas o referencias al contenido mostrado
2. Explicar metodologías, resultados y conclusiones
3. Cuestionar críticamente los argumentos del paper
4. Comparar con literatura existente
5. Identificar limitaciones y sesgos
6. Extraer datos clave, fórmulas y hallazgos
7. Generar resúmenes por sección
8. Debatir las implicaciones de los resultados

REGLAS:
- Basa tu respuesta solo en los fragmentos entregados y en el contexto conversacional
- Si la respuesta no está suficientemente respaldada por los fragmentos, dilo claramente
- Cuando cites, menciona el "Fragmento 1", "Fragmento 2", etc.
- Sé crítico y académico: no solo describas, analiza
- Usa formato estructurado con markdown
- Para fórmulas matemáticas usa LaTeX: $formula$

Responde en español, salvo que el usuario pida otro idioma.`

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-12).map((m: any) => ({
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
      storageBucket,
      storagePath,
      extractionMethod: paper.extractionMethod,
      fromCache: paper.fromCache,
    })
  } catch (e: any) {
    console.error("Paper chat error:", e)
    return Response.json(
      { error: e?.message || "Error al analizar el paper." },
      { status: 500 }
    )
  }
}
