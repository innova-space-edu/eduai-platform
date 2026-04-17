// src/lib/content-processor.ts
// v3 — Gemini 2.5 Flash + responseSchema + prompts potenciados + contexto extendido 12K

// ============================================================
// TYPES
// ============================================================

export type SourceType = "url" | "text" | "topic" | "pdf" | "docx"
export type OutputFormat =
  | "infographic" | "ppt" | "poster" | "podcast"
  | "mindmap" | "flashcards" | "quiz" | "timeline" | "cornell"
  | "glossary" | "story" | "song" | "lessonplan"

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
    // Gemini 2.5 Flash soporta contexto largo — subimos el límite a 12K chars
    if (mainContent.length > 12000) mainContent = mainContent.substring(0, 12000) + "..."

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
    if (text.length > 12000) text = text.substring(0, 12000) + "..."

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
    if (text.length > 12000) text = text.substring(0, 12000) + "..."

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
// 2. JSON SCHEMAS POR FORMATO (para responseSchema de Gemini 2.5)
// ============================================================

const SCHEMAS: Record<OutputFormat, object> = {
  infographic: {
    type: "object",
    properties: {
      title:       { type: "string" },
      subtitle:    { type: "string" },
      keyFact:     { type: "string" },
      conclusion:  { type: "string" },
      colorScheme: { type: "string", enum: ["blue","green","purple","orange","red","teal","indigo"] },
      visualType:  { type: "string", enum: ["statistics","process","comparison","educational","timeline"] },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading:    { type: "string" },
            icon:       { type: "string" },
            points:     { type: "array", items: { type: "string" } },
            stat:       { type: "object", properties: { value: { type: "string" }, label: { type: "string" } } },
          },
          required: ["heading","points"],
        },
      },
    },
    required: ["title","sections","keyFact"],
  },

  ppt: {
    type: "object",
    properties: {
      title:  { type: "string" },
      author: { type: "string" },
      theme:  { type: "string", enum: ["academic","minimal","corporate","creative","dark"] },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type:       { type: "string", enum: ["title","content","comparison","quote","summary","stats"] },
            title:      { type: "string" },
            subtitle:   { type: "string" },
            bullets:    { type: "array", items: { type: "string" } },
            notes:      { type: "string" },
            timingHint: { type: "string" },
            layout:     { type: "string", enum: ["default","two-column","image-left","quote-center","stats-grid"] },
          },
          required: ["type","title"],
        },
      },
    },
    required: ["title","slides"],
  },

  poster: {
    type: "object",
    properties: {
      headline:     { type: "string" },
      tagline:      { type: "string" },
      callToAction: { type: "string" },
      colorScheme:  { type: "string", enum: ["vibrant","pastel","dark","monochrome","neon"] },
      mainPoints: {
        type: "array",
        items: {
          type: "object",
          properties: {
            icon:        { type: "string" },
            title:       { type: "string" },
            description: { type: "string" },
            stat:        { type: "string" },
          },
          required: ["icon","title","description"],
        },
      },
    },
    required: ["headline","tagline","mainPoints","callToAction"],
  },

  podcast: {
    type: "object",
    properties: {
      title:    { type: "string" },
      duration: { type: "string" },
      segments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            speaker: { type: "string", enum: ["A","B"] },
            text:    { type: "string" },
            emotion: { type: "string", enum: ["neutral","enthusiastic","curious","thoughtful","surprised","humorous"] },
          },
          required: ["speaker","text"],
        },
      },
    },
    required: ["title","segments"],
  },

  mindmap: {
    type: "object",
    properties: {
      centralTopic: { type: "string" },
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id:          { type: "string" },
            label:       { type: "string" },
            description: { type: "string" },
            category:    { type: "string", enum: ["main","sub","detail"] },
            color:       { type: "string" },
            importance:  { type: "number" },
            connections: { type: "array", items: { type: "string" } },
            edgeLabels:  { type: "array", items: { type: "string" } },
          },
          required: ["id","label","category","connections"],
        },
      },
    },
    required: ["centralTopic","nodes"],
  },

  flashcards: {
    type: "object",
    properties: {
      deckTitle: { type: "string" },
      topic:     { type: "string" },
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id:         { type: "string" },
            front:      { type: "string" },
            back:       { type: "string" },
            hint:       { type: "string" },
            mnemonic:   { type: "string" },
            difficulty: { type: "number" },
            tags:       { type: "array", items: { type: "string" } },
          },
          required: ["id","front","back","difficulty"],
        },
      },
    },
    required: ["deckTitle","topic","cards"],
  },

  quiz: {
    type: "object",
    properties: {
      title: { type: "string" },
      topic: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type:          { type: "string", enum: ["multiple_choice","true_false","fill_blank"] },
            question:      { type: "string" },
            options:       { type: "array", items: { type: "string" } },
            correctAnswer: { type: "number" },
            explanation:   { type: "string" },
            difficulty:    { type: "number" },
            distractorHints: { type: "array", items: { type: "string" } },
          },
          required: ["type","question","options","correctAnswer","explanation","difficulty"],
        },
      },
    },
    required: ["title","topic","questions"],
  },

  timeline: {
    type: "object",
    properties: {
      title:  { type: "string" },
      period: { type: "string" },
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date:        { type: "string" },
            title:       { type: "string" },
            description: { type: "string" },
            impact:      { type: "string" },
            importance:  { type: "string", enum: ["high","medium","low"] },
            icon:        { type: "string" },
          },
          required: ["date","title","description","importance"],
        },
      },
      causalLinks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from:  { type: "string" },
            to:    { type: "string" },
            label: { type: "string" },
          },
        },
      },
    },
    required: ["title","events"],
  },

  cornell: {
    type: "object",
    properties: {
      title:   { type: "string" },
      subject: { type: "string" },
      date:    { type: "string" },
      mainNotes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            notes: { type: "string" },
          },
          required: ["topic","notes"],
        },
      },
      summary: { type: "string" },
      keywords: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["title","subject","date","mainNotes","summary","keywords"],
  },

  glossary: {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      terms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            term: { type: "string" },
            definition: { type: "string" },
            example: { type: "string" },
            category: { type: "string" },
          },
          required: ["term","definition","example"],
        },
      },
    },
    required: ["title","subject","terms"],
  },

  story: {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      moral: { type: "string" },
      characters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string" },
          },
          required: ["name","role"],
        },
      },
      chapters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
          },
          required: ["title","content"],
        },
      },
    },
    required: ["title","subject","moral","characters","chapters"],
  },

  song: {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      style: { type: "string" },
      chorus: {
        type: "object",
        properties: {
          lines: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["lines"],
      },
      verses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            lines: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["label","lines"],
        },
      },
      tip: { type: "string" },
    },
    required: ["title","subject","style","chorus","verses","tip"],
  },

  lessonplan: {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      grade: { type: "string" },
      duration: { type: "string" },
      bloom: { type: "string" },
      objective: { type: "string" },
      phases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            duration: { type: "string" },
            activity: { type: "string" },
            materials: { type: "string" },
            notes: { type: "string" },
          },
          required: ["name","duration","activity","materials","notes"],
        },
      },
      assessment: { type: "string" },
      resources: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["title","subject","grade","duration","bloom","objective","phases","assessment","resources"],
  },
}

// ============================================================
// 3. PROMPTS POTENCIADOS POR FORMATO
// ============================================================

function getFormatPrompt(format: OutputFormat, title: string, rawText: string): string {
  const contentBlock = `
CONTENIDO A PROCESAR:
Título: ${title || "Sin título"}
${rawText}
`

  const prompts: Record<OutputFormat, string> = {

    infographic: `Eres un diseñador instruccional experto y periodista de datos. 
Crea una INFOGRAFÍA educativa PROFUNDA y VISUALMENTE RICA sobre el contenido dado.

INSTRUCCIONES:
- Razona internamente sobre los conceptos clave antes de estructurarlos
- Genera EXACTAMENTE 6 secciones con 4 puntos detallados cada una
- Cada punto debe incluir datos concretos, cifras, fechas o comparaciones cuando existan
- Cada sección debe tener un stat con dato numérico real o estimado justificado
- El keyFact debe ser un dato sorprendente, contraintuitivo o poco conocido
- La conclusión debe conectar el tema con la vida real del estudiante
- Elige visualType según la naturaleza del contenido:
  * statistics → datos numéricos, comparaciones
  * process → pasos, procedimientos, ciclos
  * comparison → diferencias entre entidades
  * educational → concepto amplio con categorías
  * timeline → evolución histórica
- Todo en español

${contentBlock}`,

    ppt: `Eres un experto en comunicación educativa y diseño de presentaciones académicas.
Crea una PRESENTACIÓN PROFESIONAL completa y lista para usar en clase.

INSTRUCCIONES:
- Genera 10-12 slides con estructura pedagógica clara
- Slide 1: portada con título impactante y subtítulo descriptivo
- Slide 2: agenda/índice con los grandes bloques del tema
- Slides 3-9: contenido principal con 4-5 bullets sustanciales por slide
- Slide 10: estadísticas o datos clave (layout: stats-grid)
- Slide 11: resumen ejecutivo con los 3 aprendizajes clave
- Slide 12: "Preguntas para reflexionar" o referencias
- Cada bullet = una oración completa con información de valor, no palabras sueltas
- Las notes del orador incluyen: cómo introducir el slide, dato extra, tiempo sugerido
- timingHint = "X minutos" sugeridos para cada slide
- Elige el layout que mejor visualice cada slide
- Todo en español

${contentBlock}`,

    poster: `Eres un diseñador gráfico especializado en comunicación educativa visual.
Crea un AFICHE EDUCATIVO de alto impacto visual y pedagógico.

INSTRUCCIONES:
- El headline debe ser memorable, provocador, máximo 6 palabras
- El tagline complementa y amplía el headline
- Genera 5 puntos principales con ícono, título corto y descripción de 2-3 oraciones
- Cada descripción debe incluir al menos un dato numérico o hecho concreto
- Agrega un campo stat por punto: cifra o dato impactante (puede ser estimado si el contenido no lo da)
- El callToAction debe motivar a la acción o reflexión
- Elige colorScheme según el tono del tema:
  * vibrant → ciencias, tecnología, innovación
  * pastel → arte, humanidades, educación infantil
  * dark → historia, filosofía, temas complejos
  * monochrome → matemáticas, lógica, temas formales
  * neon → tecnología, futuro, innovación digital
- Todo en español

${contentBlock}`,

    podcast: `Eres un productor de contenido educativo especializado en podcasts.
Crea el GUIÓN de un PODCAST educativo dinámico y entretenido.

INSTRUCCIONES:
- Host A = "El Profesor Marcos" — Explica con autoridad, usa analogías brillantes, da datos precisos, hace reflexionar
- Host B = "Sofía, la estudiante curiosa" — Hace preguntas profundas, pide ejemplos, reacciona con emoción, conecta con la vida diaria
- MÍNIMO 28 segmentos para un podcast de 8+ minutos
- Estructura obligatoria:
  * Segmentos 1-2: Intro atractiva con gancho (¿Sabías que...?)
  * Segmentos 3-5: Presentación del tema con contexto histórico/científico
  * Segmentos 6-16: Desarrollo profundo con datos, analogías, debate
  * Segmentos 17-22: Ejemplos prácticos de la vida real, casos, aplicaciones
  * Segmentos 23-26: Implicaciones, reflexión crítica, perspectivas
  * Segmentos 27-28: Resumen y cierre con mensaje memorable
- Cada segmento tiene 3-5 oraciones completas
- Incluir momentos de humor, sorpresa, desacuerdo constructivo
- Los datos deben ser reales y verificables del contenido
- Todo en español

${contentBlock}`,

    mindmap: `Eres un experto en cartografía conceptual y ciencias cognitivas.
Crea un MAPA MENTAL COMPLETO e interconectado sobre el contenido dado.

INSTRUCCIONES:
- Genera 18-22 nodos para un mapa rico y detallado
- 5 nodos "main" (conceptos principales del tema — color distinto cada uno)
- 7-8 nodos "sub" (subconceptos o aspectos relevantes de cada main)
- 5-7 nodos "detail" (hechos concretos, datos, ejemplos, aplicaciones)
- Cada nodo tiene descripción de 2-3 oraciones con datos reales
- importance: 3=central, 2=importante, 1=complementario (afecta tamaño del nodo)
- Las connections deben crear una RED coherente (no solo árbol lineal)
- edgeLabels: etiquetas cortas (2-3 palabras) que describen la relación entre nodos
  Ej: ["causa de", "parte de", "contrasta con", "ejemplifica"]
- Usa colores distintos por rama principal:
  main: #3b82f6, #8b5cf6, #06b6d4, #10b981, #f59e0b
- Todo en español

${contentBlock}`,

    flashcards: `Eres un experto en memoria, aprendizaje espaciado y técnicas de estudio.
Crea un DECK DE FLASHCARDS optimizado para máxima retención.

INSTRUCCIONES:
- Genera 20 tarjetas variadas y progresivas
- Distribución por tipo:
  * 5 tarjetas de definición/concepto (difficulty: 1)
  * 6 tarjetas de relación/comparación/proceso (difficulty: 2)
  * 5 tarjetas de aplicación/análisis/síntesis (difficulty: 3)
  * 4 tarjetas de dato numérico/fecha/estadística clave (difficulty: 1-2)
- id = "card-01", "card-02", etc.
- front: pregunta bien formulada — usar "¿Por qué...", "¿Cómo...", "¿Cuál es la diferencia...", "Explica el proceso de...", "¿Qué pasaría si..."
- back: respuesta completa en 2-3 oraciones con el razonamiento, no solo el dato
- hint: pista que ayuda a recordar sin revelar la respuesta (ej: "Piensa en la relación con X")
- mnemonic: truco o asociación para memorizar (acrónimo, imagen mental, analogía)
- tags: categorías del contenido ["definición", "proceso", "dato", "aplicación", etc.]
- Todo en español

${contentBlock}`,

    quiz: `Eres un experto en evaluación educativa y taxonomía de Bloom.
Crea un QUIZ COMPLETO con preguntas que evalúen comprensión real, no solo memoria.

INSTRUCCIONES:
- Genera 15 preguntas con esta distribución:
  * 9 multiple_choice (3 de difficulty 1, 3 de difficulty 2, 3 de difficulty 3)
  * 3 true_false con justificación implícita (difficulty 1-2)
  * 3 fill_blank con contexto suficiente (difficulty 2-3)
- Las opciones incorrectas (distractores) deben ser PLAUSIBLES — errores comunes de comprensión
- distractorHints: para cada opción incorrecta, una frase corta explicando por qué alguien podría elegirla
- explanation: 3 oraciones que expliquen (1) la respuesta correcta, (2) por qué las otras son incorrectas, (3) el concepto subyacente
- difficulty: 1=recordar/reconocer, 2=comprender/aplicar, 3=analizar/evaluar/crear
- Para true_false: options siempre = ["Verdadero", "Falso"]
- Para fill_blank: la pregunta contiene "___" y options son 4 posibles respuestas
- Todo en español

${contentBlock}`,

    timeline: `Eres un historiador y visualizador de datos temporal experto.
Crea un TIMELINE INTERACTIVO detallado con vínculos causales.

INSTRUCCIONES:
- Genera 10-14 eventos en orden cronológico estricto
- Distribución: al menos 4 eventos "high", 4 "medium", 2-3 "low"
- description: 3 oraciones — (1) qué pasó, (2) contexto/causas, (3) impacto o consecuencias
- impact: frase corta (max 10 palabras) sobre el efecto duradero de este evento
- Genera causalLinks: conexiones entre eventos que se relacionan causalmente
  * from/to = títulos exactos de los eventos conectados
  * label = "causó", "aceleró", "fue respuesta a", "permitió", "contradijo"
- El ícono debe ser el emoji más representativo del evento
- Si el tema no es histórico, adaptar: hitos de un proceso, fases de desarrollo, evolución de un concepto
- Todo en español

${contentBlock}`,

    cornell: `Eres un experto en técnicas de estudio. Genera unas notas en formato Cornell estructuradas para estudiar el tema dado.

FORMATO DE RESPUESTA — Solo JSON válido:
{
  "title": "Título descriptivo del tema",
  "subject": "Materia o asignatura",
  "date": "Hoy",
  "mainNotes": [
    { "topic": "Pregunta o palabra clave", "notes": "Apuntes detallados sobre ese sub-tema. Pueden ser varias oraciones." }
  ],
  "summary": "Resumen de 3-4 oraciones que sintetiza los puntos más importantes del tema completo.",
  "keywords": ["palabra1", "palabra2", "palabra3"]
}

INSTRUCCIONES:
- Genera entre 6 y 10 filas en mainNotes
- Los topics deben ser preguntas, conceptos o palabras clave realmente útiles para estudiar
- Las notes deben ser claras, precisas y pedagógicas
- El summary debe sintetizar todo el contenido
- keywords debe incluir entre 8 y 12 palabras clave
- Todo en español

${contentBlock}`,

    glossary: `Eres un lexicógrafo educativo. Genera un glosario completo con los términos clave del tema dado.

FORMATO DE RESPUESTA — Solo JSON válido:
{
  "title": "Glosario: [Tema]",
  "subject": "Materia",
  "terms": [
    {
      "term": "Nombre del término",
      "definition": "Definición clara y precisa en 1-3 oraciones.",
      "example": "Ejemplo concreto y cotidiano de uso o aplicación",
      "category": "Categoría temática (opcional)"
    }
  ]
}

INSTRUCCIONES:
- Genera entre 15 y 25 términos
- Las definiciones deben ser precisas y fáciles de entender
- Cada término debe incluir un ejemplo útil
- Usa category cuando ayude a organizar mejor el contenido
- Todo en español

${contentBlock}`,

    story: `Eres un escritor educativo creativo. Genera un cuento didáctico entretenido que enseñe el concepto dado de forma narrativa.

FORMATO DE RESPUESTA — Solo JSON válido:
{
  "title": "Título creativo y atractivo del cuento",
  "subject": "Concepto educativo que enseña",
  "moral": "La moraleja o lección aprendida en 1-2 oraciones",
  "characters": [
    { "name": "Nombre del personaje", "role": "Rol en la historia (protagonista, maestro, etc.)" }
  ],
  "chapters": [
    { "title": "Nombre del capítulo o escena", "content": "Contenido narrativo de 100-200 palabras" }
  ]
}

INSTRUCCIONES:
- Genera entre 3 y 5 capítulos
- Cada capítulo debe tener entre 100 y 200 palabras
- La historia debe enseñar el concepto de forma clara pero entretenida
- Incluye personajes con roles definidos
- La moraleja debe conectar con el aprendizaje central
- Todo en español

${contentBlock}`,

    song: `Eres un compositor de canciones educativas. Crea una letra de canción o rap mnemónico para ayudar a memorizar el concepto dado.

FORMATO DE RESPUESTA — Solo JSON válido:
{
  "title": "Título de la canción",
  "subject": "Concepto que enseña",
  "style": "Rap educativo / Canción pegadiza / Jingle mnemónico",
  "chorus": {
    "lines": ["Línea 1 del coro", "Línea 2 del coro", "Línea 3 del coro", "Línea 4 del coro"]
  },
  "verses": [
    {
      "label": "ESTROFA 1",
      "lines": ["Línea 1", "Línea 2", "Línea 3", "Línea 4", "Línea 5", "Línea 6"]
    },
    {
      "label": "ESTROFA 2",
      "lines": ["Línea 1", "Línea 2", "Línea 3", "Línea 4", "Línea 5", "Línea 6"]
    }
  ],
  "tip": "Consejo sobre cómo usar esta canción para memorizar (ritmo sugerido, gestos, etc.)"
}

INSTRUCCIONES:
- Debe incluir un coro de 4 líneas
- Genera al menos 2 estrofas de 6 líneas cada una
- El texto debe ayudar a memorizar ideas clave
- Usa un estilo pegadizo y educativo
- Todo en español

${contentBlock}`,

    lessonplan: `Eres un pedagogo experto en diseño curricular chileno (MINEDUC). Genera un plan de clase completo y detallado.

FORMATO DE RESPUESTA — Solo JSON válido:
{
  "title": "Plan de Clase: [Tema específico]",
  "subject": "Asignatura",
  "grade": "Nivel educativo (ej: 7° Básico, 3° Medio)",
  "duration": "45 min",
  "bloom": "Nivel de Bloom principal (Recordar / Comprender / Aplicar / Analizar / Evaluar / Crear)",
  "objective": "OA específico: Los estudiantes serán capaces de... [verbo Bloom + contenido + contexto]",
  "phases": [
    {
      "name": "Inicio",
      "duration": "10 min",
      "activity": "Descripción detallada de la actividad de activación o motivación",
      "materials": "Lista de materiales necesarios",
      "notes": "Sugerencia pedagógica o diferenciación"
    },
    {
      "name": "Desarrollo",
      "duration": "25 min",
      "activity": "Descripción de la actividad principal de enseñanza-aprendizaje",
      "materials": "Materiales",
      "notes": "Notas pedagógicas"
    },
    {
      "name": "Cierre",
      "duration": "10 min",
      "activity": "Síntesis, metacognición o actividad de cierre",
      "materials": "Materiales",
      "notes": "Cómo verificar la comprensión"
    }
  ],
  "assessment": "Descripción del instrumento o criterio de evaluación formativa o sumativa",
  "resources": ["Recurso 1", "Recurso 2", "Recurso 3"]
}

INSTRUCCIONES:
- Debe incluir las 3 fases: Inicio, Desarrollo y Cierre
- El objetivo debe estar redactado pedagógicamente
- El plan debe ser claro, útil y aplicable en aula
- resources debe incluir al menos 3 recursos
- Todo en español

${contentBlock}`,
  }

  return prompts[format] || prompts.infographic
}

// ============================================================
// 4. LLAMADAS A APIs — Gemini 2.5 Flash con responseSchema
// ============================================================

async function callGemini25(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  schema: object
): Promise<any> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 8192,        // 2.5 Flash soporta output largo
          responseMimeType: "application/json",
          responseSchema: schema,        // Schema garantiza estructura — cero errores de parsing
        },
      }),
      signal: AbortSignal.timeout(55000), // 2.5 Flash puede tardar más en razonar
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini 2.5 Flash ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("Respuesta vacía de Gemini 2.5 Flash")

  // Con responseSchema el output YA es JSON válido, pero parseamos igual por seguridad
  try {
    return JSON.parse(text)
  } catch {
    // Si por alguna razón viene con backticks
    const clean = text.replace(/```json|```/g, "").trim()
    return JSON.parse(clean)
  }
}

// Fallback a Gemini 2.0 Flash (sin schema, por si 2.5 no está disponible)
async function callGemini20Fallback(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<any> {
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
    throw new Error(`Gemini 2.0 Flash ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("Respuesta vacía de Gemini 2.0 Flash")
  return JSON.parse(text)
}

async function callGroqFallback(systemPrompt: string, userPrompt: string): Promise<any> {
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
// 5. STRUCTURAR CON IA — Cascada de 3 proveedores
// ============================================================

export async function structureWithAI(
  extractedContent: ExtractedContent,
  outputFormat: OutputFormat,
  apiKey: string
) {
  const systemPrompt = `Eres un experto en educación, diseño instruccional y comunicación pedagógica.
Tu tarea es estructurar contenido educativo en formatos visuales de alta calidad.
REGLAS CRÍTICAS:
1. Responde ÚNICAMENTE con JSON válido — sin texto extra, sin backticks, sin markdown
2. Si el contenido es solo un tema (sin texto de referencia), genera contenido educativo exhaustivo y de calidad sobre ese tema
3. El contenido debe ser RICO, PROFUNDO y ESPECÍFICO — no superficial ni genérico
4. Usa datos concretos, ejemplos reales, cifras verificables siempre que sea posible
5. Todo el contenido debe estar en español (excepto términos técnicos internacionales)
6. Razona sobre el contenido antes de estructurarlo para maximizar su valor pedagógico`

  const userPrompt = getFormatPrompt(
    outputFormat,
    extractedContent.title || "Sin título",
    extractedContent.rawText || ""
  )

  const schema = SCHEMAS[outputFormat]

  // Cascada: Gemini 2.5 Flash → Gemini 2.0 Flash → Groq
  try {
    console.log(`[Creator] Llamando Gemini 2.5 Flash para formato: ${outputFormat}`)
    const data = await callGemini25(systemPrompt, userPrompt, apiKey, schema)
    console.log(`[Creator] Gemini 2.5 Flash OK para ${outputFormat}`)
    return { success: true, data, format: outputFormat, provider: "gemini-2.5-flash" }
  } catch (err25: any) {
    console.warn(`[Creator] Gemini 2.5 Flash falló (${err25.message}), intentando 2.0...`)
    try {
      const data = await callGemini20Fallback(systemPrompt, userPrompt, apiKey)
      console.log(`[Creator] Gemini 2.0 Flash OK para ${outputFormat}`)
      return { success: true, data, format: outputFormat, provider: "gemini-2.0-flash" }
    } catch (err20: any) {
      console.warn(`[Creator] Gemini 2.0 Flash falló (${err20.message}), intentando Groq...`)
      try {
        const data = await callGroqFallback(systemPrompt, userPrompt)
        console.log(`[Creator] Groq OK para ${outputFormat}`)
        return { success: true, data, format: outputFormat, provider: "groq" }
      } catch (groqErr: any) {
        return {
          success: false,
          error: `Todos los proveedores fallaron. Gemini 2.5: ${err25.message} | Gemini 2.0: ${err20.message} | Groq: ${groqErr.message}`,
        }
      }
    }
  }
}

// ============================================================
// 6. PIPELINE PRINCIPAL
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
  // Paso 1: Extraer contenido de la fuente
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

  // Paso 2: Estructurar con IA (Gemini 2.5 Flash + cascada de fallbacks)
  const structured = await structureWithAI(extracted, outputFormat, geminiKey)
  if (!structured.success) return { success: false, error: structured.error }

  // Paso 3: Resultado enriquecido
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
