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

// ============================================================
// PATCH: Reemplazar la función getFormatPrompt en
// src/lib/content-processor.ts
// ============================================================
// Busca "function getFormatPrompt" y reemplaza toda la función con esta:

function getFormatPrompt(format: OutputFormat): string {
  const prompts: Record<OutputFormat, string> = {
    infographic: `Estructura este contenido para una INFOGRAFÍA educativa MUY COMPLETA Y DETALLADA.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título atractivo y conciso (max 8 palabras)",
  "subtitle": "Subtítulo descriptivo que resuma el tema",
  "sections": [
    {
      "heading": "Título de sección",
      "icon": "emoji relevante",
      "points": ["punto detallado con datos concretos 1", "punto detallado 2", "punto detallado 3", "punto detallado 4"],
      "stat": { "value": "número o porcentaje impactante", "label": "explicación del dato" }
    }
  ],
  "keyFact": "Dato destacado principal que sorprenda al lector",
  "conclusion": "Mensaje de cierre reflexivo y motivador",
  "colorScheme": "blue|green|purple|orange|red",
  "style": "statistics|process|comparison|educational|timeline"
}
IMPORTANTE:
- Genera EXACTAMENTE 5-6 secciones con 3-4 puntos DETALLADOS cada una
- Los puntos deben incluir datos específicos, cifras, porcentajes, fechas cuando sea posible
- Cada sección debe tener un stat con dato numérico real
- El keyFact debe ser un dato sorprendente y verificable
- El contenido debe ser EXHAUSTIVO y PROFUNDO, no superficial
- Usa lenguaje claro pero informativo
- Todo en español`,

    ppt: `Estructura este contenido para una PRESENTACIÓN PROFESIONAL de slides.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título de la presentación",
  "author": "EduAI",
  "slides": [
    {
      "type": "title|content|comparison|quote|summary",
      "title": "Título del slide",
      "bullets": ["punto detallado 1", "punto detallado 2", "punto detallado 3", "punto 4"],
      "notes": "Notas detalladas del orador para este slide (2-3 oraciones)"
    }
  ],
  "theme": "academic|minimal|corporate|creative"
}
IMPORTANTE:
- Genera 8-12 slides completos
- Slide 1 = portada con título impactante
- Slide 2 = índice/agenda
- Slides 3-10 = contenido detallado con 3-5 bullets cada uno
- Penúltimo slide = resumen/conclusiones
- Último slide = referencias o "Gracias"
- Cada bullet debe ser una oración completa con información sustancial
- Las notas del orador deben ser útiles (datos extra, cómo explicar)
- Todo en español`,

    poster: `Estructura este contenido para un AFICHE/POSTER educativo IMPACTANTE.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "headline": "Título grande impactante (max 6 palabras)",
  "tagline": "Subtítulo que complemente el título",
  "mainPoints": [
    { "icon": "emoji", "title": "Punto clave (3-4 palabras)", "description": "Explicación detallada de 2-3 oraciones con datos concretos" }
  ],
  "callToAction": "Mensaje de cierre motivador y memorable",
  "colorScheme": "vibrant|pastel|dark|monochrome"
}
IMPORTANTE:
- Genera 4-5 puntos principales
- Cada descripción debe ser sustancial (2-3 oraciones completas)
- Incluir datos numéricos cuando sea posible
- El headline debe ser memorable y llamativo
- Todo en español`,

    podcast: `Estructura este contenido para un PODCAST educativo entre dos hosts.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título del episodio atractivo",
  "duration": "8min",
  "segments": [
    {
      "speaker": "A|B",
      "text": "Lo que dice este host (2-4 oraciones por segmento)",
      "emotion": "neutral|enthusiastic|curious|thoughtful|surprised"
    }
  ]
}
REGLAS DEL PODCAST:
- Host A = "El Profesor" - Explica con autoridad, usa analogías, da datos
- Host B = "El Estudiante Curioso" - Hace preguntas inteligentes, pide ejemplos, reacciona con sorpresa
- MÍNIMO 25 segmentos para un podcast sustancial
- Estructura: Saludo (2 seg) → Introducción al tema (3 seg) → Desarrollo profundo (12 seg) → Ejemplos prácticos (5 seg) → Resumen (3 seg)
- Cada segmento debe tener 2-4 oraciones completas
- Incluir datos curiosos, analogías, ejemplos de la vida real
- Tono conversacional natural, como si fuera un podcast real de Spotify
- Host B debe hacer preguntas que profundicen el tema
- Incluir momentos de humor o sorpresa
- Todo en español`,

    mindmap: `Estructura este contenido para un MAPA CONCEPTUAL interactivo COMPLETO.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "centralTopic": "Tema central (2-4 palabras)",
  "nodes": [
    {
      "id": "n1",
      "label": "Concepto (2-4 palabras)",
      "description": "Explicación detallada del concepto en 2-3 oraciones con datos relevantes",
      "category": "main|sub|detail",
      "color": "#hex",
      "connections": ["n2", "n3"]
    }
  ]
}
IMPORTANTE:
- Genera 15-20 nodos para un mapa completo
- 4-5 nodos "main" (conceptos principales)
- 5-7 nodos "sub" (subconceptos)
- 4-6 nodos "detail" (detalles específicos)
- Cada nodo debe tener una descripción informativa
- Las conexiones deben ser lógicas y crear una red coherente
- Usa colores distintos para cada rama principal
- Todo en español`,

    flashcards: `Genera FLASHCARDS de estudio COMPLETAS desde este contenido.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "deckTitle": "Título descriptivo del deck",
  "topic": "Tema general",
  "cards": [
    {
      "front": "Pregunta clara y específica",
      "back": "Respuesta completa y detallada (2-3 oraciones)",
      "difficulty": 1,
      "tags": ["categoría"]
    }
  ]
}
IMPORTANTE:
- Genera 15-20 tarjetas variadas
- Mezcla tipos: definiciones, datos numéricos, procesos, comparaciones, aplicaciones prácticas
- Las respuestas deben ser COMPLETAS, no solo una palabra
- difficulty: 1=conceptos básicos, 2=relaciones y aplicaciones, 3=análisis y síntesis
- Incluir al menos 3 tarjetas de cada nivel de dificultad
- Los "front" deben ser preguntas bien formuladas, no solo "¿Qué es X?"
- Incluir preguntas tipo "¿Por qué...", "¿Cómo...", "¿Cuál es la diferencia...", "Explica el proceso de..."
- Todo en español`,

    quiz: `Genera un QUIZ COMPLETO Y VARIADO desde este contenido.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título del quiz",
  "topic": "Tema evaluado",
  "questions": [
    {
      "type": "multiple_choice|true_false|fill_blank",
      "question": "Pregunta clara y bien formulada",
      "options": ["A detallada", "B detallada", "C detallada", "D detallada"],
      "correctAnswer": 0,
      "explanation": "Explicación detallada de POR QUÉ esta es la respuesta correcta y por qué las otras no (2-3 oraciones)",
      "difficulty": 1
    }
  ]
}
IMPORTANTE:
- Genera 12-15 preguntas
- Mezcla: 8 multiple_choice, 3 true_false, 2 fill_blank
- Para true_false: options = ["Verdadero", "Falso"]
- Para fill_blank: la pregunta contiene "___" y options son las posibles respuestas
- Las opciones incorrectas deben ser PLAUSIBLES (no obviamente incorrectas)
- difficulty: 1=recordar, 2=comprender y aplicar, 3=analizar y evaluar
- Las explicaciones deben ser EDUCATIVAS, explicando el razonamiento
- Todo en español`,

    timeline: `Estructura este contenido como un TIMELINE interactivo DETALLADO.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título del timeline",
  "period": "Período que cubre (ej: 1900-2024)",
  "events": [
    {
      "date": "Fecha específica o período",
      "title": "Nombre del evento (conciso)",
      "description": "Descripción detallada del evento y su importancia en 2-3 oraciones con datos específicos",
      "importance": "high|medium|low",
      "icon": "emoji relevante"
    }
  ]
}
IMPORTANTE:
- Genera 8-12 eventos
- Orden cronológico estricto
- Las descripciones deben explicar el IMPACTO y CONTEXTO del evento
- Al menos 3 eventos "high" importance
- Incluir fechas lo más específicas posible
- Cada descripción debe tener 2-3 oraciones sustanciales
- Todo en español`,

    cornell: `Genera NOTAS CORNELL COMPLETAS desde este contenido.
Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "title": "Título del tema",
  "date": "${new Date().toLocaleDateString("es-CL")}",
  "cueColumn": [
    { "cue": "Pregunta clave o concepto", "notes": "Notas detalladas con explicación completa, datos y ejemplos (3-5 oraciones)" }
  ],
  "summary": "Resumen ejecutivo del tema completo en 4-5 oraciones que capture las ideas principales y su importancia"
}
IMPORTANTE:
- Genera 8-10 pares cue-notes
- Los cues deben ser PREGUNTAS que guíen el estudio
- Las notes deben ser DETALLADAS con datos específicos
- El summary debe ser un párrafo completo y útil para repasar
- Todo en español`,
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
