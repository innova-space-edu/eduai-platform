import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildDesignPromptDirective, getDesignTemplateSummary } from "@/lib/design-templates/registry"
import { extractFromDOCX, extractFromPDF, extractFromText } from "@/lib/content-processor"
import { safeRemoteFetch } from "@/lib/safe-remote-url"

export const runtime = "nodejs"
export const maxDuration = 60

const HEADERS = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
const MAX_BODY_BYTES = 22 * 1024 * 1024
const MAX_TEXT = 180_000

export type EducationalFormat =
  | "worksheet"
  | "rubric"
  | "exam"
  | "answer-key"
  | "lab-sheet"
  | "exit-ticket"
  | "checklist"
  | "report"

const FORMATS = new Set<EducationalFormat>([
  "worksheet",
  "rubric",
  "exam",
  "answer-key",
  "lab-sheet",
  "exit-ticket",
  "checklist",
  "report",
])

const SOURCE_TYPES = new Set(["topic", "text", "url", "pdf", "docx"])

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ["multiple_choice", "true_false", "short_answer", "development", "matching", "problem"] },
    prompt: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    correctAnswer: { type: "string" },
    explanation: { type: "string" },
    points: { type: "number" },
    difficulty: { type: "string", enum: ["basic", "intermediate", "advanced"] },
    skill: { type: "string" },
    workspaceLines: { type: "number" },
  },
  required: ["id", "type", "prompt", "options", "correctAnswer", "explanation", "points", "difficulty", "skill", "workspaceLines"],
}

const SCHEMAS: Record<EducationalFormat, object> = {
  worksheet: {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      grade: { type: "string" },
      objective: { type: "string" },
      instructions: { type: "string" },
      estimatedTime: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            activityType: { type: "string" },
            questions: { type: "array", items: QUESTION_SCHEMA },
          },
          required: ["title", "description", "activityType", "questions"],
        },
      },
      reflection: { type: "array", items: { type: "string" } },
      teacherNotes: { type: "string" },
    },
    required: ["title", "subject", "grade", "objective", "instructions", "estimatedTime", "sections", "reflection", "teacherNotes"],
  },
  rubric: {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      grade: { type: "string" },
      task: { type: "string" },
      objective: { type: "string" },
      scale: {
        type: "array",
        items: {
          type: "object",
          properties: {
            level: { type: "string" },
            score: { type: "number" },
            generalDescription: { type: "string" },
          },
          required: ["level", "score", "generalDescription"],
        },
      },
      criteria: {
        type: "array",
        items: {
          type: "object",
          properties: {
            criterion: { type: "string" },
            weight: { type: "number" },
            evidence: { type: "string" },
            descriptors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  level: { type: "string" },
                  description: { type: "string" },
                },
                required: ["level", "description"],
              },
            },
          },
          required: ["criterion", "weight", "evidence", "descriptors"],
        },
      },
      feedbackPrompts: { type: "array", items: { type: "string" } },
    },
    required: ["title", "subject", "grade", "task", "objective", "scale", "criteria", "feedbackPrompts"],
  },
  exam: {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      grade: { type: "string" },
      duration: { type: "string" },
      totalPoints: { type: "number" },
      instructions: { type: "string" },
      learningObjectives: { type: "array", items: { type: "string" } },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            directions: { type: "string" },
            questions: { type: "array", items: QUESTION_SCHEMA },
          },
          required: ["title", "directions", "questions"],
        },
      },
      scoringGuide: { type: "string" },
    },
    required: ["title", "subject", "grade", "duration", "totalPoints", "instructions", "learningObjectives", "sections", "scoringGuide"],
  },
  "answer-key": {
    type: "object",
    properties: {
      title: { type: "string" },
      sourceAssessment: { type: "string" },
      subject: { type: "string" },
      grade: { type: "string" },
      totalPoints: { type: "number" },
      answers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            number: { type: "string" },
            question: { type: "string" },
            correctAnswer: { type: "string" },
            development: { type: "string" },
            points: { type: "number" },
            commonErrors: { type: "array", items: { type: "string" } },
            partialCredit: { type: "string" },
          },
          required: ["number", "question", "correctAnswer", "development", "points", "commonErrors", "partialCredit"],
        },
      },
      gradingNotes: { type: "string" },
    },
    required: ["title", "sourceAssessment", "subject", "grade", "totalPoints", "answers", "gradingNotes"],
  },
  "lab-sheet": {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      grade: { type: "string" },
      researchQuestion: { type: "string" },
      objective: { type: "string" },
      safety: { type: "array", items: { type: "string" } },
      materials: { type: "array", items: { type: "string" } },
      hypothesisPrompt: { type: "string" },
      variables: {
        type: "object",
        properties: {
          independent: { type: "string" },
          dependent: { type: "string" },
          controlled: { type: "array", items: { type: "string" } },
        },
        required: ["independent", "dependent", "controlled"],
      },
      procedure: {
        type: "array",
        items: {
          type: "object",
          properties: {
            step: { type: "number" },
            instruction: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["step", "instruction", "evidence"],
        },
      },
      dataTable: {
        type: "object",
        properties: {
          columns: { type: "array", items: { type: "string" } },
          suggestedRows: { type: "number" },
        },
        required: ["columns", "suggestedRows"],
      },
      analysisQuestions: { type: "array", items: { type: "string" } },
      conclusionPrompt: { type: "string" },
      disposal: { type: "string" },
    },
    required: ["title", "subject", "grade", "researchQuestion", "objective", "safety", "materials", "hypothesisPrompt", "variables", "procedure", "dataTable", "analysisQuestions", "conclusionPrompt", "disposal"],
  },
  "exit-ticket": {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      grade: { type: "string" },
      lessonObjective: { type: "string" },
      estimatedTime: { type: "string" },
      prompts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["recall", "application", "reflection", "confidence", "question"] },
            prompt: { type: "string" },
            responseSpace: { type: "string" },
            successIndicator: { type: "string" },
          },
          required: ["type", "prompt", "responseSpace", "successIndicator"],
        },
      },
      teacherInterpretation: { type: "string" },
    },
    required: ["title", "subject", "grade", "lessonObjective", "estimatedTime", "prompts", "teacherInterpretation"],
  },
  checklist: {
    type: "object",
    properties: {
      title: { type: "string" },
      purpose: { type: "string" },
      subject: { type: "string" },
      grade: { type: "string" },
      instructions: { type: "string" },
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  evidence: { type: "string" },
                  mandatory: { type: "boolean" },
                },
                required: ["item", "evidence", "mandatory"],
              },
            },
          },
          required: ["category", "items"],
        },
      },
      finalDecision: { type: "string" },
      observationsPrompt: { type: "string" },
    },
    required: ["title", "purpose", "subject", "grade", "instructions", "categories", "finalDecision", "observationsPrompt"],
  },
  report: {
    type: "object",
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      author: { type: "string" },
      date: { type: "string" },
      executiveSummary: { type: "string" },
      objectives: { type: "array", items: { type: "string" } },
      methodology: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading: { type: "string" },
            content: { type: "string" },
            evidence: { type: "array", items: { type: "string" } },
            keyFinding: { type: "string" },
          },
          required: ["heading", "content", "evidence", "keyFinding"],
        },
      },
      conclusions: { type: "array", items: { type: "string" } },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            priority: { type: "string", enum: ["high", "medium", "low"] },
            action: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["priority", "action", "rationale"],
        },
      },
      references: { type: "array", items: { type: "string" } },
    },
    required: ["title", "subtitle", "author", "date", "executiveSummary", "objectives", "methodology", "sections", "conclusions", "recommendations", "references"],
  },
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

async function extractUrl(url: string) {
  const response = await safeRemoteFetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`La página respondió HTTP ${response.status}`)
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("La URL debe apuntar a una página HTML")
  const cheerio = await import("cheerio")
  const html = (await response.text()).slice(0, 2_000_000)
  const $ = cheerio.load(html)
  $("script,style,nav,footer,header,aside,iframe,noscript,.ad,.advertisement").remove()
  const title = $("h1").first().text().trim() || $("title").text().trim() || "Fuente web"
  const text = ($("article").first().text() || $("main").first().text() || $("body").text()).replace(/\s+/g, " ").trim().slice(0, 14_000)
  if (!text) throw new Error("No se encontró contenido legible")
  return { success: true, title, rawText: `Fuente web: ${title}\nURL: ${url}\n\n${text}`, wordCount: text.split(/\s+/).length }
}

async function loadCustomTemplate(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, id: string) {
  if (!id.startsWith("custom:")) return null
  const templateId = id.slice("custom:".length)
  const { data } = await supabase
    .from("creative_templates")
    .select("name, file_name, file_kind, accent_color, secondary_color, instructions, formats")
    .eq("id", templateId)
    .eq("user_id", userId)
    .maybeSingle()
  return data || null
}

function promptFor(format: EducationalFormat, title: string, rawText: string, designDirective: string, customTemplate: any) {
  const common = `Eres un experto en diseño instruccional, evaluación auténtica y materiales educativos para Chile.
Crea un material completo, claro, pedagógicamente coherente y totalmente editable por bloques.
Título o fuente: ${title || "Sin título"}
Contenido base:
${rawText.slice(0, 14_000)}

Reglas generales:
- Escribe en español de Chile, con instrucciones precisas y lenguaje apropiado para enseñanza básica o media según el contenido.
- No inventes cifras, citas, fechas, fuentes ni resultados que no aparezcan en el contenido. Cuando falte información concreta, formula una actividad abierta o marca el dato como pendiente.
- Mantén correspondencia entre objetivos, actividades, evidencias, evaluación y respuestas.
- Evita preguntas ambiguas, respuestas dobles y distractores evidentemente absurdos.
- Incluye espacio de respuesta o guía de corrección cuando corresponda.
- Devuelve únicamente JSON válido conforme al esquema solicitado.
${designDirective}
${customTemplate ? `PLANTILLA DEL USUARIO:\nNombre: ${customTemplate.name}\nArchivo: ${customTemplate.file_name || ""}\nTipo: ${customTemplate.file_kind || ""}\nColor principal: ${customTemplate.accent_color || ""}\nColor secundario: ${customTemplate.secondary_color || ""}\nInstrucciones: ${customTemplate.instructions || ""}\nRespeta estas indicaciones de estructura y estilo.` : ""}`

  const instructions: Record<EducationalFormat, string> = {
    worksheet: `Crea una guía de aprendizaje progresiva con 3 o 4 secciones, explicación breve, ejemplos, 12 a 18 ejercicios variados, reflexión final y notas docentes. Mezcla comprensión, aplicación y desafío.`,
    rubric: `Crea una rúbrica analítica con 4 niveles de desempeño y entre 4 y 7 criterios observables. Los pesos deben sumar 100. Cada descriptor debe ser específico, medible y diferenciar claramente los niveles.`,
    exam: `Crea una evaluación equilibrada con instrucciones, objetivos, puntaje total coherente y 18 a 25 preguntas distribuidas en secciones. Mezcla selección múltiple, verdadero/falso, respuesta breve, desarrollo y problemas según la asignatura. Incluye respuestas y explicación para el solucionario, aunque no se muestren al estudiante.`,
    "answer-key": `Crea un solucionario detallado a partir del contenido o evaluación proporcionada. Incluye respuesta correcta, desarrollo, puntaje, errores frecuentes y criterios de puntaje parcial. Si el contenido no incluye preguntas explícitas, crea un solucionario modelo coherente e indica que es una propuesta.`,
    "lab-sheet": `Crea una ficha de laboratorio segura y realizable: pregunta de investigación, objetivo, hipótesis, variables, materiales, advertencias, procedimiento numerado, tabla de datos, preguntas de análisis y conclusión. No sugieras sustancias o procedimientos peligrosos.`,
    "exit-ticket": `Crea un ticket de salida breve para 5 a 8 minutos con 4 o 5 preguntas: recuperación, aplicación, reflexión, nivel de confianza y duda pendiente. Incluye indicadores para interpretar rápidamente las respuestas.`,
    checklist: `Crea una lista de cotejo organizada por categorías, con 12 a 25 indicadores observables, evidencia esperada, obligatoriedad, decisión final y espacio para observaciones.`,
    report: `Crea un informe educativo o ejecutivo formal con resumen, objetivos, metodología, secciones de análisis, evidencias, hallazgos, conclusiones, recomendaciones priorizadas y referencias basadas solo en la fuente entregada.`,
  }

  return `${common}\n\nINSTRUCCIÓN ESPECÍFICA:\n${instructions[format]}`
}

export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") || 0)
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "El contenido supera el límite de 22 MB." }, { status: 413, headers: HEADERS })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const body = await request.json().catch(() => null)
  const format = body?.format as EducationalFormat
  const sourceType = clean(body?.sourceType, 20)
  const content = typeof body?.content === "string" ? body.content : ""
  const fileName = clean(body?.fileName, 240)
  const designTemplateId = clean(body?.designTemplateId, 180)

  if (!FORMATS.has(format)) return NextResponse.json({ error: "Formato educativo no compatible." }, { status: 400, headers: HEADERS })
  if (!SOURCE_TYPES.has(sourceType)) return NextResponse.json({ error: "Fuente no compatible." }, { status: 400, headers: HEADERS })
  if (!content) return NextResponse.json({ error: "Falta el contenido base." }, { status: 400, headers: HEADERS })
  if (["topic", "text", "url"].includes(sourceType) && content.length > MAX_TEXT) return NextResponse.json({ error: "El texto es demasiado extenso." }, { status: 413, headers: HEADERS })

  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "El motor de generación no está configurado." }, { status: 503, headers: HEADERS })

  try {
    let extracted: any
    if (sourceType === "topic") extracted = extractFromText(content, true)
    else if (sourceType === "text") extracted = extractFromText(content, false)
    else if (sourceType === "url") extracted = await extractUrl(content)
    else if (sourceType === "pdf") extracted = await extractFromPDF(content, fileName)
    else extracted = await extractFromDOCX(content, fileName)

    if (!extracted?.success || !extracted?.rawText) return NextResponse.json({ error: extracted?.error || "No fue posible leer la fuente." }, { status: 422, headers: HEADERS })

    const customTemplate = await loadCustomTemplate(supabase, user.id, designTemplateId)
    const designDirective = buildDesignPromptDirective(customTemplate ? "eduai-canva-classroom" : designTemplateId, "generic")
    const prompt = promptFor(format, extracted.title || fileName, extracted.rawText, designDirective, customTemplate)

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 12_000,
          responseMimeType: "application/json",
          responseSchema: SCHEMAS[format],
        },
      }),
      signal: AbortSignal.timeout(55_000),
    })

    if (!response.ok) {
      console.error("[EducationalDocument]", response.status, await response.text())
      return NextResponse.json({ error: "El motor no pudo generar el documento." }, { status: 502, headers: HEADERS })
    }

    const payload = await response.json()
    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return NextResponse.json({ error: "El motor no devolvió contenido." }, { status: 502, headers: HEADERS })
    const data = JSON.parse(raw)
    const design = customTemplate
      ? {
          id: designTemplateId,
          name: customTemplate.name,
          custom: true,
          sourceFile: customTemplate.file_name || null,
          instructions: customTemplate.instructions || null,
          palette: {
            primary: customTemplate.accent_color || "#7c3aed",
            secondary: customTemplate.secondary_color || "#06b6d4",
            accent: customTemplate.accent_color || "#7c3aed",
            background: "#f8fafc",
            surface: "#ffffff",
            text: "#0f172a",
            muted: "#64748b",
          },
        }
      : getDesignTemplateSummary(designTemplateId, "generic")

    return NextResponse.json({
      success: true,
      output: { format, data: { ...data, _design: design } },
      source: { type: sourceType, title: extracted.title || fileName || "Fuente", wordCount: extracted.wordCount || 0 },
      generatedAt: new Date().toISOString(),
    }, { headers: HEADERS })
  } catch (error) {
    console.error("[EducationalDocument]", error)
    return NextResponse.json({ error: "La generación falló o tardó demasiado." }, { status: 500, headers: HEADERS })
  }
}
