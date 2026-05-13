// lib/superagent/tool-registry.ts
// ─────────────────────────────────────────────────────────────────────────────
// Registro de herramientas del SuperAgent EduAI Claw
// Cada tool tiene: nombre, descripción, parámetros y función execute()
// El core usa este registro para decidir qué tool llamar según el mensaje.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tipos base ────────────────────────────────────────────────────────────────

export type ToolName =
  | "generate_exam_questions"
  | "adapt_for_pie"
  | "plan_curriculum"
  | "explain_concept"
  | "generate_rubric"
  | "summarize_text"
  | "translate_text"
  | "generate_image_prompt"

export interface ToolParam {
  name:        string
  type:        "string" | "number" | "boolean"
  description: string
  required:    boolean
  options?:    string[]  // valores posibles (para selects)
}

export interface ToolDefinition {
  name:        ToolName
  label:       string      // nombre bonito para UI
  icon:        string
  description: string
  category:    "exam" | "accessibility" | "planning" | "content" | "media"
  params:      ToolParam[]
  enabled:     boolean
  execute:     (args: Record<string, unknown>, baseUrl: string) => Promise<ToolResult>
}

export interface ToolResult {
  success: boolean
  output:  string          // respuesta en texto/markdown para mostrar en chat
  data?:   unknown         // datos estructurados opcionales (JSON, etc.)
  error?:  string
}

// ── Helpers internos ──────────────────────────────────────────────────────────

async function callInternalAPI(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const url = `${baseUrl}${path}`
  return fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
}

// ── Definición de tools ───────────────────────────────────────────────────────

export const TOOL_REGISTRY: ToolDefinition[] = [

  // ── 1. Generador de preguntas de examen ──────────────────────────────────
  {
    name:        "generate_exam_questions",
    label:       "Generar preguntas",
    icon:        "📝",
    description: "Genera preguntas de examen sobre un tema. Soporta alternativas, V/F y desarrollo.",
    category:    "exam",
    enabled:     true,
    params: [
      { name: "topic",    type: "string", description: "Tema de las preguntas",                  required: true },
      { name: "subject",  type: "string", description: "Asignatura (Matemática, Física, etc.)",  required: false },
      { name: "count",    type: "number", description: "Cantidad de preguntas (1-10)",            required: false },
      { name: "type",     type: "string", description: "Tipo",                                    required: false,
        options: ["multiple_choice", "true_false", "development", "mixed"] },
      { name: "level",    type: "string", description: "Nivel",                                   required: false,
        options: ["1° Básico","2° Básico","3° Básico","4° Básico","5° Básico","6° Básico",
                  "7° Básico","8° Básico","1° Medio","2° Medio","3° Medio","4° Medio"] },
    ],
    async execute(args, baseUrl) {
      try {
        const topic   = String(args.topic   || "")
        const subject = String(args.subject || "")
        const count   = Math.min(10, Math.max(1, Number(args.count) || 5))
        const type    = String(args.type    || "mixed")
        const level   = String(args.level   || "")

        const prompt = `Genera ${count} preguntas de examen en español para el tema: "${topic}".
${subject ? `Asignatura: ${subject}.` : ""}
${level   ? `Nivel: ${level}.` : ""}
Tipo de preguntas: ${type === "mixed" ? "variado (alternativas, V/F y desarrollo)" : type}.

Responde SOLO con un JSON con esta estructura exacta:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "texto de la pregunta",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "por qué es correcta"
    }
  ]
}
Para true_false: omite options, usa correctAnswer: 0 (verdadero) o 1 (falso).
Para development: omite options y correctAnswer, agrega "modelAnswer": "respuesta esperada".`

        const res  = await callInternalAPI(baseUrl, "/api/superagent/chat", {
          messages:   [{ role: "user", content: prompt }],
          task:       "general",
          maxTokens:  3000,
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)

        // Intentar parsear JSON de preguntas
        const raw = data.text as string
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            const qs = parsed.questions || []
            const summary = qs
              .map((q: Record<string, unknown>, i: number) =>
                `**${i + 1}.** ${q.question}\n${
                  Array.isArray(q.options)
                    ? q.options.map((o: string, j: number) =>
                        `  ${["A","B","C","D"][j]}) ${o}`).join("\n")
                    : ""
                }`
              )
              .join("\n\n")
            return {
              success: true,
              output:  `✅ **${qs.length} preguntas generadas** sobre "${topic}":\n\n${summary}`,
              data:    parsed,
            }
          } catch {
            // Si no parsea, devolver el texto completo
          }
        }

        return { success: true, output: raw }
      } catch (err) {
        return {
          success: false,
          output:  "No se pudieron generar las preguntas.",
          error:   err instanceof Error ? err.message : String(err),
        }
      }
    },
  },

  // ── 2. Adaptación PIE/NEE ────────────────────────────────────────────────
  {
    name:        "adapt_for_pie",
    label:       "Adaptar para PIE",
    icon:        "♿",
    description: "Adapta texto, preguntas o instrucciones para estudiantes con NEE (dislexia, TDAH, baja visión, TEA).",
    category:    "accessibility",
    enabled:     true,
    params: [
      { name: "content",      type: "string",  description: "Texto a adaptar",   required: true },
      { name: "dyslexia",     type: "boolean", description: "Dislexia",          required: false },
      { name: "adhd",         type: "boolean", description: "TDAH",              required: false },
      { name: "low_vision",   type: "boolean", description: "Baja visión",       required: false },
      { name: "tea",          type: "boolean", description: "TEA",               required: false },
      { name: "tel",          type: "boolean", description: "TEL",               required: false },
    ],
    async execute(args, baseUrl) {
      try {
        const content    = String(args.content || "")
        const dyslexia   = Boolean(args.dyslexia)
        const adhd       = Boolean(args.adhd)
        const lowVision  = Boolean(args.low_vision)
        const tea        = Boolean(args.tea)
        const tel        = Boolean(args.tel)

        const needs = [
          dyslexia  && "dislexia (frases cortas, palabras simples, sin texto justificado)",
          adhd      && "TDAH (instrucciones en pasos, bloques cortos, una idea por vez)",
          lowVision && "baja visión (texto grande, alto contraste, sin cursiva)",
          tea       && "TEA (lenguaje literal, sin metáforas, estructura predecible)",
          tel       && "TEL (vocabulario básico, oraciones simples, ejemplos concretos)",
        ].filter(Boolean).join(", ")

        const prompt = `Adapta el siguiente texto para estudiantes con NEE: ${needs || "necesidades generales"}.

TEXTO ORIGINAL:
${content}

REGLAS DE ADAPTACIÓN:
- Frases cortas (máximo 15 palabras)
- Vocabulario simple y directo
- Sin metáforas ni lenguaje figurado
- Instrucciones en pasos numerados si aplica
- Palabras clave en **negrita**
- Sin información innecesaria

Devuelve SOLO el texto adaptado, sin explicaciones previas.`

        const res  = await callInternalAPI(baseUrl, "/api/superagent/chat", {
          messages:  [{ role: "user", content: prompt }],
          task:      "general",
          maxTokens: 2000,
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)

        return {
          success: true,
          output:  `♿ **Texto adaptado para PIE** (${needs || "NEE general"}):\n\n${data.text}`,
        }
      } catch (err) {
        return {
          success: false,
          output:  "No se pudo adaptar el texto.",
          error:   err instanceof Error ? err.message : String(err),
        }
      }
    },
  },

  // ── 3. Planificación curricular ──────────────────────────────────────────
  {
    name:        "plan_curriculum",
    label:       "Planificación de clase",
    icon:        "📚",
    description: "Genera una planificación de clase o unidad alineada al currículum MINEDUC.",
    category:    "planning",
    enabled:     true,
    params: [
      { name: "subject",  type: "string", description: "Asignatura",   required: true },
      { name: "level",    type: "string", description: "Nivel/Curso",  required: true },
      { name: "topic",    type: "string", description: "Tema central", required: true },
      { name: "sessions", type: "number", description: "N° de clases", required: false },
    ],
    async execute(args, baseUrl) {
      try {
        const subject  = String(args.subject  || "")
        const level    = String(args.level    || "")
        const topic    = String(args.topic    || "")
        const sessions = Math.min(8, Math.max(1, Number(args.sessions) || 3))

        const prompt = `Crea una planificación de ${sessions} clase(s) para:
- Asignatura: ${subject}
- Nivel: ${level}
- Tema: ${topic}
- Marco: Currículum Nacional MINEDUC Chile

Incluye para cada clase:
1. Objetivo de Aprendizaje (OA)
2. Indicadores de evaluación
3. Actividades (inicio, desarrollo, cierre)
4. Recursos necesarios
5. Tiempo estimado por etapa

Formato Markdown con encabezados claros.`

        const res  = await callInternalAPI(baseUrl, "/api/superagent/chat", {
          messages:  [{ role: "user", content: prompt }],
          task:      "long_context",
          maxTokens: 4000,
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)

        return {
          success: true,
          output:  `📚 **Planificación generada** — ${subject} · ${level} · "${topic}":\n\n${data.text}`,
        }
      } catch (err) {
        return {
          success: false,
          output:  "No se pudo generar la planificación.",
          error:   err instanceof Error ? err.message : String(err),
        }
      }
    },
  },

  // ── 4. Explicar concepto ─────────────────────────────────────────────────
  {
    name:        "explain_concept",
    label:       "Explicar concepto",
    icon:        "🔬",
    description: "Explica un concepto educativo de forma clara, con ejemplos y analogías.",
    category:    "content",
    enabled:     true,
    params: [
      { name: "concept", type: "string", description: "Concepto a explicar",  required: true },
      { name: "level",   type: "string", description: "Nivel del estudiante", required: false },
      { name: "subject", type: "string", description: "Asignatura",           required: false },
    ],
    async execute(args, baseUrl) {
      try {
        const concept = String(args.concept || "")
        const level   = String(args.level   || "estudiante de enseñanza media")
        const subject = String(args.subject || "")

        const prompt = `Explica "${concept}" para un ${level}${subject ? ` en ${subject}` : ""}.

Estructura:
1. **Definición simple** (2-3 oraciones)
2. **Ejemplo concreto** del contexto chileno o cotidiano
3. **Analogía** para facilitar la comprensión
4. **Puntos clave** (máximo 4, en lista)
5. **Pregunta de reflexión** para el estudiante

Usa lenguaje claro y amigable.`

        const res  = await callInternalAPI(baseUrl, "/api/superagent/chat", {
          messages:  [{ role: "user", content: prompt }],
          task:      "general",
          maxTokens: 1500,
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)

        return {
          success: true,
          output:  `🔬 **Explicación de "${concept}"**:\n\n${data.text}`,
        }
      } catch (err) {
        return {
          success: false,
          output:  "No se pudo explicar el concepto.",
          error:   err instanceof Error ? err.message : String(err),
        }
      }
    },
  },

  // ── 5. Generar rúbrica ───────────────────────────────────────────────────
  {
    name:        "generate_rubric",
    label:       "Crear rúbrica",
    icon:        "📊",
    description: "Crea una rúbrica de evaluación con criterios y niveles de logro.",
    category:    "exam",
    enabled:     true,
    params: [
      { name: "task",    type: "string", description: "Tarea/actividad a evaluar",  required: true },
      { name: "subject", type: "string", description: "Asignatura",                 required: false },
      { name: "points",  type: "number", description: "Puntaje total",              required: false },
    ],
    async execute(args, baseUrl) {
      try {
        const task    = String(args.task    || "")
        const subject = String(args.subject || "")
        const points  = Number(args.points  || 20)

        const prompt = `Crea una rúbrica para evaluar: "${task}"${subject ? ` en ${subject}` : ""}.
Puntaje total: ${points} puntos.

Formato Markdown con tabla:
| Criterio | Excelente | Satisfactorio | En desarrollo | Insuficiente | Pts |
|---|---|---|---|---|---|

Incluye 4-5 criterios relevantes. Sé específico y medible.`

        const res  = await callInternalAPI(baseUrl, "/api/superagent/chat", {
          messages:  [{ role: "user", content: prompt }],
          task:      "general",
          maxTokens: 2000,
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)

        return {
          success: true,
          output:  `📊 **Rúbrica para "${task}"**:\n\n${data.text}`,
        }
      } catch (err) {
        return {
          success: false,
          output:  "No se pudo generar la rúbrica.",
          error:   err instanceof Error ? err.message : String(err),
        }
      }
    },
  },

  // ── 6. Resumir texto ─────────────────────────────────────────────────────
  {
    name:        "summarize_text",
    label:       "Resumir texto",
    icon:        "📄",
    description: "Resume un texto largo manteniendo las ideas principales.",
    category:    "content",
    enabled:     true,
    params: [
      { name: "text",  type: "string", description: "Texto a resumir",    required: true },
      { name: "lines", type: "number", description: "Líneas del resumen", required: false },
    ],
    async execute(args, baseUrl) {
      try {
        const text  = String(args.text  || "")
        const lines = Math.min(20, Math.max(3, Number(args.lines) || 5))

        const res  = await callInternalAPI(baseUrl, "/api/superagent/chat", {
          messages: [{ role: "user", content:
            `Resume el siguiente texto en ${lines} puntos clave (lista con viñetas, en español):\n\n${text}` }],
          task:      text.length > 3000 ? "long_context" : "fast",
          maxTokens: 800,
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)

        return { success: true, output: `📄 **Resumen:**\n\n${data.text}` }
      } catch (err) {
        return {
          success: false,
          output:  "No se pudo resumir el texto.",
          error:   err instanceof Error ? err.message : String(err),
        }
      }
    },
  },

  // ── 7. Traducir texto ────────────────────────────────────────────────────
  {
    name:        "translate_text",
    label:       "Traducir",
    icon:        "🌐",
    description: "Traduce texto al español u otro idioma.",
    category:    "content",
    enabled:     true,
    params: [
      { name: "text",   type: "string", description: "Texto a traducir",  required: true },
      { name: "target", type: "string", description: "Idioma destino",    required: false,
        options: ["Español", "Inglés", "Francés", "Portugués", "Alemán"] },
    ],
    async execute(args, baseUrl) {
      try {
        const text   = String(args.text   || "")
        const target = String(args.target || "Español")

        const res  = await callInternalAPI(baseUrl, "/api/superagent/chat", {
          messages: [{ role: "user", content:
            `Traduce al ${target}. Devuelve SOLO la traducción, sin explicaciones:\n\n${text}` }],
          task:      "fast",
          maxTokens: 2000,
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)

        return { success: true, output: `🌐 **Traducción al ${target}:**\n\n${data.text}` }
      } catch (err) {
        return {
          success: false,
          output:  "No se pudo traducir el texto.",
          error:   err instanceof Error ? err.message : String(err),
        }
      }
    },
  },

  // ── 8. Prompt para imagen educativa ─────────────────────────────────────
  {
    name:        "generate_image_prompt",
    label:       "Prompt para imagen",
    icon:        "🖼️",
    description: "Genera un prompt optimizado para crear imágenes educativas con IA.",
    category:    "media",
    enabled:     true,
    params: [
      { name: "concept", type: "string", description: "Concepto o escena a ilustrar", required: true },
      { name: "style",   type: "string", description: "Estilo visual",                required: false,
        options: ["diagrama científico", "ilustración infantil", "infografía", "realista", "minimalista"] },
    ],
    async execute(args, baseUrl) {
      try {
        const concept = String(args.concept || "")
        const style   = String(args.style   || "diagrama científico")

        const res  = await callInternalAPI(baseUrl, "/api/superagent/chat", {
          messages: [{ role: "user", content:
            `Crea un prompt en inglés para generar una imagen educativa.
Concepto: "${concept}"
Estilo: ${style}
El prompt debe ser detallado, descriptivo y apto para herramientas como DALL-E, Midjourney o Flux.
Responde SOLO con el prompt en inglés, sin explicaciones.` }],
          task:      "fast",
          maxTokens: 300,
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)

        return {
          success: true,
          output:  `🖼️ **Prompt para imagen** (${style}):\n\n\`\`\`\n${data.text}\n\`\`\`\n\nPuedes usarlo directamente en el generador de imágenes de EduAI.`,
          data:    { prompt: data.text },
        }
      } catch (err) {
        return {
          success: false,
          output:  "No se pudo generar el prompt.",
          error:   err instanceof Error ? err.message : String(err),
        }
      }
    },
  },
]

// ── Funciones del registro ────────────────────────────────────────────────────

export function getToolByName(name: ToolName): ToolDefinition | undefined {
  return TOOL_REGISTRY.find(t => t.name === name)
}

export function getEnabledTools(): ToolDefinition[] {
  return TOOL_REGISTRY.filter(t => t.enabled)
}

export function getToolsByCategory(category: ToolDefinition["category"]): ToolDefinition[] {
  return TOOL_REGISTRY.filter(t => t.enabled && t.category === category)
}

/** Detecta qué tool usar según el texto del mensaje del usuario */
export function detectToolFromMessage(message: string): ToolName | null {
  const m = message.toLowerCase()

  if (/genera(r|)\s*(preguntas?|examen|evaluac)/i.test(m))      return "generate_exam_questions"
  if (/adapt(a|ar)\s*(para|el|texto).*(pie|nee|dislexia|tdah)/i.test(m)) return "adapt_for_pie"
  if (/pie|nee|dislexia|tdah|tea|baja\s*visión|adapta/i.test(m) && /text|pregunta|contenid/i.test(m)) return "adapt_for_pie"
  if (/planifica(ción|r|)\s*(de\s*)?(clase|unidad|semana)/i.test(m)) return "plan_curriculum"
  if (/rubric(a|)\s*(de|para|evaluac)/i.test(m))                  return "generate_rubric"
  if (/resum(e|ir|en)\s*(este|el|texto|document)/i.test(m))       return "summarize_text"
  if (/traduc(e|ir|ción)/i.test(m))                               return "translate_text"
  if (/explic(a|ar)\s*(el|la|qué\s*es|concepto)/i.test(m))        return "explain_concept"
  if (/prompt.*(imagen|ilustrac|visual)/i.test(m))                return "generate_image_prompt"

  return null
}
