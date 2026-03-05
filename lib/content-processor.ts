// src/lib/content-processor.ts
// Pipeline universal de procesamiento de contenido para EduAI Creator Studio

import type { NextRequest } from "next/server"

// ============================================================
// TYPES
// ============================================================

export type SourceType = "url" | "text" | "topic" | "pdf" | "docx"
export type OutputFormat =
  | "infographic" | "ppt" | "poster" | "podcast"
  | "mindmap" | "flashcards" | "quiz" | "timeline" | "cornell"

interface ExtractedContent {
  success: boolean
  sourceType?: string
  sourceUrl?: string
  title?: string
  description?: string
  rawText?: string
  images?: { src: string; alt: string }[]
  wordCount?: number
  pageCount?: number
  extractedAt?: string
  error?: string
}

interface ProcessResult {
  success: boolean
  source?: {
    type: string
    title: string
    wordCount: number
    url: string | null
  }
  output?: {
    format: string
    data: any
  }
  processedAt?: string
  error?: string
}

// ============================================================
// 1. EXTRACTORES DE CONTENIDO
// ============================================================

export async function extractFromURL(url: string): Promise<ExtractedContent> {
  try {
    const cheerio = await import("cheerio")
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const $ = cheerio.load(html)

    $("script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar, noscript, iframe").remove()

    const title =
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content") || ""

    const description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") || ""

    const selectors = ["article", "main", '[role="main"]', ".content", ".post-content", ".entry-content", "#content"]
    let mainContent = ""

    for (const sel of selectors) {
      const el = $(sel)
      if (el.length && el.text().trim().length > 200) {
        mainContent = el.text().trim()
        break
      }
    }
    if (!mainContent) mainContent = $("body").text().trim()

    mainContent = mainContent.replace(/\s+/g, " ").replace(/\n\s*\n/g, "\n").trim()
    if (mainContent.length > 8000) mainContent = mainContent.substring(0, 8000) + "..."

    const images: { src: string; alt: string }[] = []
    $("img").each((_, el) => {
      const src = $(el).attr("src")
      const alt = $(el).attr("alt") || ""
      if (src && !src.includes("logo") && !src.includes("icon") && !src.includes("avatar")) {
        let fullSrc = src
        if (src.startsWith("/")) {
          const urlObj = new URL(url)
          fullSrc = `${urlObj.origin}${src}`
        }
        images.push({ src: fullSrc, alt })
      }
    })

    return {
      success: true,
      sourceType: "url",
      sourceUrl: url,
      title,
      description,
      rawText: mainContent,
      images: images.slice(0, 5),
      wordCount: mainContent.split(/\s+/).length,
      extractedAt: new Date().toISOString(),
    }
  } catch (err: any) {
    return { success: false, error: `Error extrayendo URL: ${err.message}` }
  }
}

export function extractFromText(text: string, isTopic = false): ExtractedContent {
  return {
    success: true,
    sourceType: isTopic ? "topic" : "text",
    title: isTopic ? text : text.substring(0, 60) + (text.length > 60 ? "..." : ""),
    rawText: text,
    wordCount: text.split(/\s+/).length,
    extractedAt: new Date().toISOString(),
  }
}

export async function extractFromPDF(base64Data: string, fileName = "document.pdf"): Promise<ExtractedContent> {
  try {
    const { PDFParse } = await import("pdf-parse")
    const buffer = Buffer.from(base64Data, "base64")
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()

    let text = result.text || ""
    text = text.replace(/\s+/g, " ").replace(/\n\s*\n/g, "\n").trim()
    if (text.length > 8000) text = text.substring(0, 8000) + "..."

    return {
      success: true,
      sourceType: "pdf",
      title: fileName.replace(".pdf", ""),
      rawText: text,
      pageCount: result.pages?.length || 0,
      wordCount: text.split(/\s+/).length,
      extractedAt: new Date().toISOString(),
    }
  } catch (err: any) {
    return { success: false, error: `Error procesando PDF: ${err.message}` }
  }
}

export async function extractFromDOCX(base64Data: string, fileName = "document.docx"): Promise<ExtractedContent> {
  try {
    const mammoth = await import("mammoth")
    const buffer = Buffer.from(base64Data, "base64")
    const result = await mammoth.extractRawText({ buffer })

    let text = result.value || ""
    text = text.replace(/\s+/g, " ").replace(/\n\s*\n/g, "\n").trim()
    if (text.length > 8000) text = text.substring(0, 8000) + "..."

    return {
      success: true,
      sourceType: "docx",
      title: fileName.replace(/\.docx?$/, ""),
      rawText: text,
      wordCount: text.split(/\s+/).length,
      extractedAt: new Date().toISOString(),
    }
  } catch (err: any) {
    return { success: false, error: `Error procesando DOCX: ${err.message}` }
  }
}

// ============================================================
// 2. PROMPTS POR FORMATO
// ============================================================

function getFormatPrompt(format: OutputFormat): string {
  const prompts: Record<OutputFormat, string> = {
    infographic: `Estructura este contenido para una INFOGRAFÍA educativa.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título atractivo y conciso",
  "subtitle": "Subtítulo descriptivo",
  "sections": [
    {
      "heading": "Título de sección",
      "icon": "emoji relevante",
      "points": ["punto clave 1", "punto clave 2", "punto clave 3"],
      "stat": { "value": "número o dato impactante", "label": "descripción" }
    }
  ],
  "keyFact": "Dato destacado principal",
  "conclusion": "Mensaje de cierre",
  "colorScheme": "blue|green|purple|orange|red",
  "style": "statistics|process|comparison|educational|timeline"
}
Máximo 5 secciones. Cada sección máximo 3 puntos. Datos concretos.`,

    ppt: `Estructura este contenido para una PRESENTACIÓN de slides.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título de la presentación",
  "author": "EduAI",
  "slides": [
    {
      "type": "title|content|comparison|quote|summary",
      "title": "Título del slide",
      "bullets": ["punto 1", "punto 2", "punto 3"],
      "notes": "Notas del orador"
    }
  ],
  "theme": "academic|minimal|corporate|creative"
}
Máximo 10 slides. Slide 1 = portada, último = conclusión.`,

    poster: `Estructura este contenido para un AFICHE/POSTER educativo.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "headline": "Título grande e impactante",
  "tagline": "Subtítulo breve",
  "mainPoints": [
    { "icon": "emoji", "title": "Punto", "description": "Descripción corta" }
  ],
  "callToAction": "Mensaje de cierre o llamada a la acción",
  "colorScheme": "vibrant|pastel|dark|monochrome"
}
Máximo 4 puntos principales. Todo muy conciso y visual.`,

    podcast: `Estructura este contenido para un PODCAST educativo entre dos hosts.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título del episodio",
  "duration": "5min",
  "segments": [
    {
      "speaker": "A|B",
      "text": "Lo que dice este host",
      "emotion": "neutral|enthusiastic|curious|thoughtful"
    }
  ]
}
Host A = explica con autoridad. Host B = hace preguntas, pide ejemplos, reacciona.
Intro natural, desarrollo con ejemplos, cierre con resumen.
Mínimo 15 segmentos. Tono conversacional natural. Todo en español.`,

    mindmap: `Estructura este contenido para un MAPA CONCEPTUAL interactivo.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "centralTopic": "Tema central",
  "nodes": [
    {
      "id": "n1",
      "label": "Concepto",
      "description": "Explicación breve",
      "category": "main|sub|detail",
      "color": "#hex",
      "connections": ["n2", "n3"]
    }
  ]
}
Mínimo 8 nodos, máximo 20. Conexiones claras entre conceptos relacionados.`,

    flashcards: `Genera FLASHCARDS de estudio desde este contenido.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "deckTitle": "Título del deck",
  "topic": "Tema general",
  "cards": [
    {
      "front": "Pregunta o concepto",
      "back": "Respuesta o explicación",
      "difficulty": 1,
      "tags": ["tag1"]
    }
  ]
}
Genera 10-15 tarjetas. Mezcla: definiciones, datos, conceptos, aplicaciones.
difficulty: 1=fácil, 2=medio, 3=difícil. Todo en español.`,

    quiz: `Genera un QUIZ adaptativo desde este contenido.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título del quiz",
  "topic": "Tema",
  "questions": [
    {
      "type": "multiple_choice|true_false|fill_blank|sequence",
      "question": "Pregunta",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Por qué esta es la respuesta correcta",
      "difficulty": 1
    }
  ]
}
10 preguntas. Mezcla tipos. difficulty: 1-3. Explicaciones claras. Todo en español.`,

    timeline: `Estructura este contenido como un TIMELINE interactivo.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título del timeline",
  "period": "Período que cubre",
  "events": [
    {
      "date": "Fecha o período",
      "title": "Evento",
      "description": "Descripción breve",
      "importance": "high|medium|low",
      "icon": "emoji"
    }
  ]
}
Orden cronológico. Mínimo 6 eventos.`,

    cornell: `Genera NOTAS CORNELL desde este contenido.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título del tema",
  "date": "${new Date().toLocaleDateString("es-CL")}",
  "cueColumn": [
    { "cue": "Palabra/pregunta clave", "notes": "Notas detalladas correspondientes" }
  ],
  "summary": "Resumen de 2-3 oraciones del contenido completo"
}
5-8 pares cue-notes. Cues son preguntas o palabras clave. Notes son explicaciones.`,
  }

  return prompts[format] || prompts.infographic
}

// ============================================================
// 3. LLAMADAS A APIs DE IA
// ============================================================

async function callGemini(systemPrompt: string, userPrompt: string, apiKey: string): Promise<any> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("Respuesta vacía de Gemini")

  return JSON.parse(text)
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<any> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) throw new Error("GROQ_API_KEY no configurada")

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error("Respuesta vacía de Groq")

  return JSON.parse(text)
}

// ============================================================
// 4. STRUCTURAR CON IA
// ============================================================

export async function structureWithAI(
  extractedContent: ExtractedContent,
  outputFormat: OutputFormat,
  apiKey: string
) {
  const systemPrompt = `Eres un experto en educación y diseño instruccional.
Tu tarea es estructurar contenido educativo en formatos específicos.
REGLA CRÍTICA: Responde ÚNICAMENTE con JSON válido. Sin texto adicional, sin backticks, sin markdown.
Si el contenido es un tema (sin texto de referencia), genera contenido educativo de calidad sobre ese tema.
Todo el contenido debe estar en español.`

  const userPrompt = `${getFormatPrompt(outputFormat)}

CONTENIDO A PROCESAR:
Título: ${extractedContent.title || "Sin título"}
${extractedContent.rawText}`

  try {
    const data = await callGemini(systemPrompt, userPrompt, apiKey)
    return { success: true, data, format: outputFormat }
  } catch (geminiErr: any) {
    console.error("Gemini falló, intentando Groq:", geminiErr.message)
    try {
      const data = await callGroq(systemPrompt, userPrompt)
      return { success: true, data, format: outputFormat }
    } catch (groqErr: any) {
      return {
        success: false,
        error: `Ambas APIs fallaron. Gemini: ${geminiErr.message}. Groq: ${groqErr.message}`,
      }
    }
  }
}

// ============================================================
// 5. PIPELINE PRINCIPAL
// ============================================================

export async function processContent({
  sourceType,
  content,
  fileName,
  outputFormat,
  geminiKey,
}: {
  sourceType: SourceType
  content: string
  fileName?: string
  outputFormat: OutputFormat
  geminiKey: string
}): Promise<ProcessResult> {
  // Paso 1: Extraer
  let extracted: ExtractedContent

  switch (sourceType) {
    case "url":
      extracted = await extractFromURL(content)
      break
    case "text":
      extracted = extractFromText(content, false)
      break
    case "topic":
      extracted = extractFromText(content, true)
      break
    case "pdf":
      extracted = await extractFromPDF(content, fileName)
      break
    case "docx":
      extracted = await extractFromDOCX(content, fileName)
      break
    default:
      return { success: false, error: `Tipo de fuente no soportado: ${sourceType}` }
  }

  if (!extracted.success) return { success: false, error: extracted.error }

  // Paso 2: Estructurar con IA
  const structured = await structureWithAI(extracted, outputFormat, geminiKey)
  if (!structured.success) return { success: false, error: structured.error }

  // Paso 3: Resultado
  return {
    success: true,
    source: {
      type: extracted.sourceType!,
      title: extracted.title!,
      wordCount: extracted.wordCount!,
      url: extracted.sourceUrl || null,
    },
    output: {
      format: outputFormat,
      data: structured.data,
    },
    processedAt: new Date().toISOString(),
  }
}