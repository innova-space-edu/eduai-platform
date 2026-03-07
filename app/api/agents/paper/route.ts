import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const STORAGE_BUCKET = "papers"
const MAX_PDF_SIZE_MB = 50
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024
const MAX_GEMINI_INLINE_PDF_MB = 10
const MAX_GEMINI_INLINE_PDF_BYTES = MAX_GEMINI_INLINE_PDF_MB * 1024 * 1024
const CHUNK_SIZE = 3500
const CHUNK_OVERLAP = 400
const MAX_SELECTED_CHUNKS = 4

function cleanText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

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

function parseGeminiJson(raw: string) {
  let data: any = null

  try {
    data = JSON.parse(raw)
  } catch {}

  if (!data) {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        data = JSON.parse(match[0])
      } catch {}
    }
  }

  if (!data) {
    const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (mdMatch) {
      try {
        data = JSON.parse(mdMatch[1].trim())
      } catch {}
    }
  }

  return data
}

async function extractTextWithPdfParse(buffer: Buffer) {
  try {
    const pdfParseModule: any = await import("pdf-parse")
    const pdfParse = pdfParseModule.default || pdfParseModule
    const parsed = await pdfParse(buffer)

    return {
      text: cleanText(parsed?.text || ""),
      pageCount: parsed?.numpages || 0,
      success: true,
    }
  } catch (error) {
    console.error("pdf-parse extraction failed:", error)
    return {
      text: "",
      pageCount: 0,
      success: false,
    }
  }
}

async function extractTextWithGemini(base64: string, title: string) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      text: "",
      success: false,
    }
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
      {
        text: `Extract ALL text from this document preserving structure, titles, sections and formulas.

IMPORTANT: Respond ONLY with a valid JSON object:
{"title":"document title","text":"full extracted text"}

Rules:
- Keep the original language of the document
- Preserve mathematical formulas as LaTeX when possible
- Include all sections when possible
- If the title is unclear, use: "${title}"`,
      },
    ])

    const raw = result.response.text().trim()
    const data = parseGeminiJson(raw)

    if (!data?.text) {
      return {
        text: "",
        success: false,
      }
    }

    return {
      text: cleanText(data.text || ""),
      success: true,
    }
  } catch (error) {
    console.error("Gemini full extraction failed:", error)
    return {
      text: "",
      success: false,
    }
  }
}

async function loadPaperTextFromStorage(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  bucket: string
  filePath: string
  title: string
}) {
  const { supabase, bucket, filePath, title } = params

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(filePath)

  if (downloadError || !fileBlob) {
    throw new Error("No se pudo descargar el PDF desde Supabase Storage.")
  }

  if (fileBlob.size > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      `El archivo almacenado pesa ${(fileBlob.size / 1024 / 1024).toFixed(2)} MB y excede el límite permitido de ${MAX_PDF_SIZE_MB} MB.`
    )
  }

  const arrayBuffer = await fileBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const parsed = await extractTextWithPdfParse(buffer)
  if (parsed.success && parsed.text) {
    return parsed.text
  }

  if (buffer.byteLength <= MAX_GEMINI_INLINE_PDF_BYTES) {
    const geminiResult = await extractTextWithGemini(buffer.toString("base64"), title)
    if (geminiResult.success && geminiResult.text) {
      return geminiResult.text
    }
  }

  throw new Error(
    "No se pudo extraer el texto automáticamente del PDF. Si el documento es escaneado, habría que agregar OCR."
  )
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

    const paperText = await loadPaperTextFromStorage({
      supabase,
      bucket: storageBucket,
      filePath: storagePath,
      title: paperTitle,
    })

    const relevantChunks = selectRelevantChunks(paperText, message, MAX_SELECTED_CHUNKS)
    const excerptBlock = relevantChunks
      .map((chunk, index) => `### Fragmento ${index + 1}\n${chunk}`)
      .join("\n\n")

    const systemPrompt = `Eres APaper, un agente especializado en análisis profundo de documentos académicos y papers científicos.

DOCUMENTO CARGADO:
Título: "${paperTitle}"

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
    })
  } catch (e: any) {
    console.error("Paper chat error:", e)
    return Response.json(
      { error: e?.message || "Error al analizar el paper." },
      { status: 500 }
    )
  }
}
