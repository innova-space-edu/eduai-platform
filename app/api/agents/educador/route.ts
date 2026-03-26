// app/api/agents/educador/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildOAContext, cursoToKey, normalizeAsignatura, type NivelKey } from "@/lib/mineduc-oa"
import { callAI } from "@/lib/ai-router-v4"

export const runtime     = "nodejs"
export const maxDuration = 60

// ─── Contexto curricular por nivel ───────────────────────────────────────────
const NIVEL_INFO: Record<NivelKey, string> = {
  parvularia: `
EDUCACIÓN PARVULARIA — Bases Curriculares para la Educación Parvularia (BCEP 2018, MINEDUC Chile)
Niveles: Sala Cuna (0-2 años) | Nivel Medio (2-4 años) | NT1/NT2 (4-6 años)
Ámbitos de Experiencias:
  1. Desarrollo Personal y Social → Núcleos: Identidad y Autonomía · Convivencia y Ciudadanía · Corporalidad y Movimiento
  2. Comunicación Integral → Núcleos: Lenguaje Verbal · Lenguajes Artísticos
  3. Interacción y Comprensión del Entorno → Núcleos: Exploración del Entorno Natural · Pensamiento Matemático · Comprensión del Entorno Sociocultural
Enfoque pedagógico: juego libre y dirigido, experiencias de aprendizaje, ambiente enriquecido, rol de la familia.
Formato oficial: Experiencia de Aprendizaje con Núcleo / OA / Indicadores / Estrategias / Recursos / Evaluación formativa.`,

  basica: `
EDUCACIÓN BÁSICA 1°-6° — Bases Curriculares (2012, actualizadas 2023, MINEDUC Chile)
Asignaturas: Lenguaje y Comunicación · Matemática · Ciencias Naturales · Historia, Geografía y Cs. Sociales · Inglés · Educación Física · Artes Visuales · Música · Tecnología · Orientación
Estructura OA: cada asignatura tiene OA numerados (OA1, OA2…) organizados por curso.
Habilidades transversales: pensamiento crítico, comunicación, colaboración, ciudadanía digital, autogestión.
Formato oficial: Unidad Didáctica con OA / Indicadores de Evaluación / Actividades (Inicio, Desarrollo, Cierre) / Recursos / Evaluación (formativa y sumativa).`,

  media: `
EDUCACIÓN MEDIA 7°-4°M — Bases Curriculares (2015-2020, MINEDUC Chile)
Asignaturas formación general: Lengua y Literatura · Matemática · Historia, Geografía y Cs. Sociales · Inglés · Ciencias Naturales (Biología, Física, Química) · Educación Física · Artes · Filosofía · Orientación
Plan diferenciado: Electivos según modalidad (Humanista-Científica / Técnico-Profesional)
Estructura OA: Objetivos de Aprendizaje numerados por asignatura y curso.
Formato oficial: Unidad con OA / Aprendizajes Esperados / Actividades / Evaluación / Recursos.`,
}

const SEASONS: Record<string, string> = {
  marzo:      "inicio año escolar, conocimiento del grupo, establecimiento de rutinas y expectativas",
  abril:      "otoño, Semana Santa, Mes del Mar, consolidación de aprendizajes iniciales",
  mayo:       "otoño, Día del Trabajador, Día de la Madre, Glorias Navales (21 de mayo)",
  junio:      "invierno, San Juan y San Pedro, inicio vacaciones invierno",
  julio:      "invierno, vacaciones de invierno, retorno segunda mitad del año",
  agosto:     "inicio 2° semestre, preparación Fiestas Patrias",
  septiembre: "primavera, Fiestas Patrias 18-19 septiembre, Día del Roto Chileno, Dieziocho",
  octubre:    "primavera, Día del Encuentro de dos Mundos, Día del Docente (16 oct)",
  noviembre:  "primavera, cierre de unidades, pre-evaluaciones finales",
  diciembre:  "verano, Navidad, cierre año escolar, actos de graduación",
  enero:      "verano, vacaciones — no hay clases habituales",
  febrero:    "verano, preparación inicio año escolar",
}

// ─── Detectar si el mensaje pide OA específicos ───────────────────────────────
function extractOARequest(message: string): { oaNum: number | null; keywords: string[] } {
  const oaMatch = message.match(/\bOA\s*(\d+)\b/i)
  const numMatch = message.match(/\bobjetivo\s+(?:de\s+aprendizaje\s+)?(?:n[°º.]?\s*)?(\d+)\b/i)
  const num = oaMatch ? parseInt(oaMatch[1]) : numMatch ? parseInt(numMatch[1]) : null

  const keywords: string[] = []
  const kws = ["planificación", "planificacion", "unidad", "clase", "actividad", "rúbrica", "rubrica", "evaluación", "evaluacion", "proyecto", "estrategia"]
  kws.forEach(k => { if (message.toLowerCase().includes(k)) keywords.push(k) })

  return { oaNum: num, keywords }
}

// ─── Buscar OA con la API de Gemini cuando no está en la DB local ─────────────
async function searchOAWithAI(
  nivel: NivelKey, curso: string, asignatura: string,
  oaNum: number | null, query: string, apiKey: string
): Promise<string> {
  const prompt = `Eres un experto en las Bases Curriculares del MINEDUC Chile.
Necesito los Objetivos de Aprendizaje (OA) oficiales para:
- Nivel: ${nivel}
- Curso: ${curso}
- Asignatura: ${asignatura}
${oaNum ? `- OA específico: OA${oaNum}` : ""}
- Consulta del docente: "${query}"

Responde con los OA exactos tal como aparecen en las Bases Curriculares oficiales del MINEDUC.
Incluye el número de OA, el texto oficial completo y las habilidades involucradas.
Si no tienes certeza del texto exacto, indícalo claramente.
Responde en español, de forma concisa y estructurada.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return ""
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
  } catch {
    return ""
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message, history = [], config } = await req.json()
  const nivel:      NivelKey = config?.nivel      || "basica"
  const curso:      string   = config?.curso      || "3° Básico"
  const asignatura: string   = config?.asignatura || "Lenguaje y Comunicación"
  const contexto:   string   = config?.contexto   || ""
  const mes:        string   = config?.mes        || new Date().toLocaleString("es-CL", { month: "long" }).toLowerCase()

  const temporada  = SEASONS[mes] || ""
  const nivelCtx   = NIVEL_INFO[nivel]
  const GEMINI_KEY = process.env.GEMINI_API_KEY || ""

  // ── Obtener OA relevantes ──────────────────────────────────────────────────
  const { oaNum, keywords } = extractOARequest(message)

  // 1. Intentar desde la base de datos local
  let oaContext = buildOAContext(nivel, curso, asignatura, oaNum ?? undefined)

  // 2. Si no hay datos locales, consultar a Gemini con baja temperatura
  if (!oaContext && GEMINI_KEY) {
    const aiOA = await searchOAWithAI(nivel, curso, asignatura, oaNum, message, GEMINI_KEY)
    if (aiOA) {
      oaContext = `\nOBJETIVOS DE APRENDIZAJE (obtenidos desde bases curriculares):\n${aiOA}`
    }
  }

  // ── System prompt completo ─────────────────────────────────────────────────
  const systemPrompt = `Eres APl, el Agente Planificador Educativo de EduAI — experta pedagoga chilena con 20 años de experiencia en todos los niveles del sistema escolar chileno.

═══════════════════════════════════════════════
IDENTIDAD Y EXPERTISE
═══════════════════════════════════════════════
• Dominas las Bases Curriculares MINEDUC en todos los niveles (BCEP, Básica, Media).
• Conoces los OA oficiales, sus habilidades asociadas y los indicadores de evaluación.
• Diseñas planificaciones alineadas al currículum con actividades pedagógicamente sólidas.
• Adaptas para NEE (TEA, dislexia, TDAH, discapacidad visual/motora) e inclusión.
• Conoces el contexto escolar chileno: calendario, efemérides, clima cultural.
• Hablas con calidez profesional, precisión y entusiasmo por la educación.

═══════════════════════════════════════════════
CONTEXTO CURRICULAR ACTIVO
═══════════════════════════════════════════════
NIVEL: ${nivel.toUpperCase()} | CURSO: ${curso} | ASIGNATURA: ${asignatura}
${nivelCtx}
${oaContext ? oaContext : `\nNota: Para obtener los OA exactos de ${asignatura} en ${curso}, puedes consultarlos en curriculum.mineduc.cl`}

═══════════════════════════════════════════════
CONTEXTO TEMPORAL
═══════════════════════════════════════════════
Mes: ${mes.charAt(0).toUpperCase() + mes.slice(1)} — ${temporada}
${contexto ? `Información adicional del docente: ${contexto}` : ""}

═══════════════════════════════════════════════
CAPACIDADES PEDAGÓGICAS
═══════════════════════════════════════════════
1. Planificaciones completas alineadas al currículum con OA oficiales numerados
2. Unidades didácticas de 1-8 semanas con secuencia lógica
3. Actividades de inicio, desarrollo y cierre con estrategias variadas
4. Rúbricas e instrumentos de evaluación (listas de cotejo, escalas, portafolios)
5. Adaptaciones para NEE y atención a la diversidad
6. Proyectos interdisciplinarios y aprendizaje basado en proyectos (ABP)
7. Gestión de aula: ambientes, rutinas, clima escolar
8. Recursos digitales y tecnológicos integrados a la clase
9. Tareas y actividades para el trabajo en familia
10. Planificación de actos y efemérides escolares

═══════════════════════════════════════════════
FORMATO DE PLANIFICACIONES
═══════════════════════════════════════════════
Cuando generes una planificación, usa SIEMPRE esta estructura:

📚 **DATOS GENERALES**
> Nivel/Curso | Asignatura | Tiempo estimado | Fecha/Período

🎯 **OBJETIVO(S) DE APRENDIZAJE**
> OA[N]: [texto oficial completo]
> Indicadores de Evaluación:
> - [indicador 1]
> - [indicador 2]

⚡ **INICIO** (10-15 min)
> Activación conocimientos previos / Motivación
> [descripción de la actividad]

🔍 **DESARROLLO** (25-35 min)
> [actividades paso a paso, estrategias didácticas, agrupaciones]

🌟 **CIERRE** (10-15 min)
> Síntesis / Metacognición / Conexión con próxima clase

🛠️ **RECURSOS Y MATERIALES**
> [lista de recursos: físicos, digitales, humanos]

📊 **EVALUACIÓN**
> Tipo: [formativa/sumativa] | Instrumento: [rúbrica/lista de cotejo/etc.]

♿ **ADAPTACIONES SUGERIDAS**
> [para NEE o diversidad de aprendizajes]

💡 **SUGERENCIA VISUAL** para acompañar esta planificación: [mapa conceptual/infografía/etc.]

═══════════════════════════════════════════════
IMPORTANTE SOBRE LOS OA
═══════════════════════════════════════════════
- SIEMPRE cita los OA con su número oficial (OA1, OA2, etc.)
- Si el docente pide un OA específico, desarrolla la planificación centrada en ese OA
- Si necesitas OA que no tienes disponibles, indícalo y orienta al docente hacia curriculum.mineduc.cl
- Los OA son el eje articulador: toda actividad debe contribuir al logro del OA indicado`

  // ── Construir historial ────────────────────────────────────────────────────
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-12).map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ]

  try {
    // Usar Gemini para respuestas largas y de calidad pedagógica
    const result = await callAI(messages, {
      maxTokens:      4000,
      preferProvider: "gemini",
    })

    return NextResponse.json({
      text:     result.text,
      provider: result.provider,
      model:    result.model,
      oaFound:  !!oaContext,
      cursoKey: cursoToKey(curso),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
