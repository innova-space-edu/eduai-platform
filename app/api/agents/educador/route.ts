import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callAI, getEducadorModelStrategy } from "@/lib/ai-router-v4"
import {
  buildOAContext,
  cursoToKey,
  getAvailableAsignaturas,
  type NivelKey,
} from "@/lib/mineduc-oa"
import {
  buildPlanningHorizonText,
  buildSelectedOAContext,
  getParvulariaAmbito,
  getParvulariaOAT,
  getPlannerOAOptions,
  getPlannerSummary,
  getPlannerUnits,
} from "@/lib/planificador-curriculum"

export const runtime = "nodejs"
export const maxDuration = 60

type TiempoPlanificacion = "diaria" | "semanal" | "mensual"

type ChatHistoryItem = {
  role: "user" | "assistant"
  content: string
}

interface EducadorConfig {
  mode?: "planificar" | "sugerir_parvularia"
  nivel?: NivelKey
  curso?: string
  asignatura?: string
  contexto?: string
  mes?: string
  unidadId?: string
  selectedOAIds?: string[]
  selectedOATIds?: string[]
  tiempoPlanificacion?: TiempoPlanificacion
  sesiones?: number
  duracionMinutos?: number
}

const NIVEL_INFO: Record<NivelKey, string> = {
  parvularia: `EDUCACION PARVULARIA - Bases Curriculares de la Educacion Parvularia (BCEP)
Estructura curricular: subnivel, ambitos de experiencia, nucleos de aprendizaje, OA, OAT
Enfoque: juego, exploracion, vinculo afectivo, mediacion pedagogica, evaluacion formativa y cualitativa
La respuesta debe usar lenguaje apropiado al subnivel. Diferencia claramente sala cuna, nivel medio y transicion.`,

  basica: `EDUCACION BASICA - Bases Curriculares MINEDUC
Estructura: curso, asignatura, unidad, OA, indicadores de evaluacion, objetivos de clase por sesion, habilidades y actitudes.
La planificacion mantiene coherencia curricular, claridad metodologica, progresion didactica y evaluacion alineada al OA.`,

  media: `EDUCACION MEDIA - Bases Curriculares MINEDUC
Estructura: curso, asignatura, unidad o modulo, OA, indicadores de evaluacion, objetivos de clase por sesion, habilidades y actitudes.
La planificacion es academicamente rigurosa, clara, util para el aula chilena real y alineada con OA oficiales.`,
}

const SEASONS: Record<string, string> = {
  marzo: "inicio del anio escolar, diagnostico, establecimiento de rutinas y normas",
  abril: "consolidacion inicial, otonio, primeras evaluaciones formativas",
  mayo: "desarrollo de unidades, trabajo sistematico y seguimiento del progreso",
  junio: "cierre parcial de procesos, invierno, ajustes antes de vacaciones",
  julio: "retorno o vacaciones de invierno segun calendario escolar",
  agosto: "inicio del segundo semestre, reorganizacion y profundizacion",
  septiembre: "Fiestas Patrias, primavera, actividades con contexto nacional y cultural",
  octubre: "mes con efemerides escolares, consolidacion y proyectos",
  noviembre: "cierre de unidades, evaluaciones finales y sintesis",
  diciembre: "cierre del anio escolar, integracion, evidencias finales",
  enero: "receso escolar habitual",
  febrero: "preparacion del nuevo anio escolar",
}

function normalizeMonth(input?: string) {
  const month = input || new Date().toLocaleString("es-CL", { month: "long" })
  return month.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
}

function extractOARequest(message: string): { oaNum: number | null } {
  const oaMatch = message.match(/\bOA\s*(\d+)\b/i)
  const numMatch = message.match(/\bobjetivo\s+(?:de\s+aprendizaje\s+)?(?:n[°º.]?\s*)?(\d+)\b/i)
  const num = oaMatch ? parseInt(oaMatch[1], 10) : numMatch ? parseInt(numMatch[1], 10) : null
  return { oaNum: Number.isFinite(num as number) ? num : null }
}

function ensureArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function buildLocalCoverageNotice(nivel: NivelKey, curso: string, asignatura: string): string {
  const available = getAvailableAsignaturas(nivel, curso)
  if (!available.length) return `No existe base curricular local para ${curso} en este nivel.`
  if (!available.includes(asignatura)) return `No existe base curricular local para ${asignatura} en ${curso}.`
  return `Base curricular local disponible para ${asignatura} en ${curso}.`
}

function buildSelectedOATContext(curso: string, asignatura: string, selectedOATIds: string[]): string {
  const allOAT = getParvulariaOAT(curso, asignatura)
  const picked = selectedOATIds.length ? allOAT.filter((item) => selectedOATIds.includes(item.id)) : []
  if (!picked.length) return ""
  return ["OAT SELECCIONADOS:", ...picked.map((item) => `- ${item.description || item.id}: ${item.label}`)].join("\n")
}

function buildUnitContext(nivel: NivelKey, curso: string, asignatura: string, unidadId?: string): string {
  const units = getPlannerUnits({ nivel, curso, asignatura })
  if (!units.length || !unidadId) return ""
  const selected = units.find((unit) => unit.id === unidadId)
  if (!selected) return ""
  return [
    "UNIDAD O MODULO SELECCIONADO:",
    `- ${selected.label}`,
    selected.oaIds.length ? `- OA vinculados: ${selected.oaIds.join(", ")}` : "",
  ].filter(Boolean).join("\n")
}

function inferParvulariaStage(curso: string): string {
  const c = curso.toLowerCase()
  if (c.includes("sala cuna menor")) return "Sala Cuna Menor: vinculo, apego, exploracion sensoriomotriz, bienestar, rutinas, lenguaje emergente."
  if (c.includes("sala cuna mayor")) return "Sala Cuna Mayor: desplazamiento, exploracion activa, juego simple, comunicacion emergente, seguridad afectiva."
  if (c.includes("medio menor")) return "Medio Menor: lenguaje en expansion, juego activo, autonomia inicial, exploracion y experiencias concretas."
  if (c.includes("medio mayor")) return "Medio Mayor: lenguaje, juego simbolico, interaccion grupal, descubrimiento del entorno, pensamiento inicial."
  if (c.includes("nt1")) return "NT1: experiencias ludicas, desarrollo verbal, pensamiento matematico inicial, exploracion, representacion, trabajo grupal guiado."
  if (c.includes("nt2")) return "NT2: consolidacion, mayor autonomia, comunicacion, representacion, preparacion para ensenanza basica."
  return "Subnivel de parvularia no identificado con precision."
}

function buildSessionBlocks(sesiones: number, duracionMinutos: number): string {
  const inicio = Math.round(duracionMinutos * 0.2)
  const desarrollo = Math.round(duracionMinutos * 0.6)
  const cierre = duracionMinutos - inicio - desarrollo
  const maxSes = Math.min(sesiones, 4)

  if (sesiones === 1) {
    return `### Sesion unica - ${duracionMinutos} min

**Inicio (${inicio} min)**
- (actividad de apertura: pregunta motivadora, recurso, dinamica de activacion de conocimientos previos)
- (como conecta con la experiencia o contexto del estudiante)

**Desarrollo (${desarrollo} min)**
- (actividad principal - describir el procedimiento paso a paso)
- (materiales que se usaran y como)
- (tipo de agrupacion: individual / parejas / grupos - con descripcion del rol de cada uno)
- (mediacion docente: que preguntas hara, como modelara, como acompanara)

**Cierre (${cierre} min)**
- (actividad de sintesis: mapa mental, ticket de salida, pregunta de metacognicion, plenario)
- (como el docente verifica el logro de los objetivos de clase)`
  }

  return Array.from({ length: maxSes }, (_, i) => {
    const n = i + 1
    return `### Sesion ${n} de ${sesiones} - ${duracionMinutos} min

**Inicio (${inicio} min)**
- (actividad de inicio sesion ${n}${n > 1 ? " - conexion o recuperacion de lo trabajado en sesion anterior" : ""})
- (recurso o elemento motivador)

**Desarrollo (${desarrollo} min)**
- (actividad principal sesion ${n} - con pasos detallados y descripcion de procedimiento)
- (agrupacion de trabajo y rol del estudiante y del docente)
- (material o recurso especifico de esta sesion)

**Cierre (${cierre} min)**
- (evaluacion formativa o sintesis de la sesion ${n})
${n < maxSes ? "- (proyeccion: que se trabajara en la proxima sesion)" : ""}`
  }).join("\n\n") + (sesiones > 4 ? `\n\n> **Nota:** Las sesiones 5 a ${sesiones} siguen la misma estructura progresando en complejidad y profundidad del contenido.` : "")
}

function buildClaseObjectives(sesiones: number): string {
  if (sesiones === 1) {
    return `**Sesion unica:**
Al finalizar la clase, el/la estudiante sera capaz de:
- (objetivo 1 - concreto, observable y medible)
- (objetivo 2 - habilidad o contenido especifico de la sesion)
- (objetivo 3 - actitud o proceso esperado si aplica)`
  }
  return Array.from({ length: Math.min(sesiones, 4) }, (_, i) => {
    const n = i + 1
    return `**Sesion ${n}:**
Al finalizar esta sesion, el/la estudiante sera capaz de:
- (objetivo concreto sesion ${n} - observable y medible)
- (habilidad o contenido que se espera lograr en esta sesion especifica)`
  }).join("\n\n") + (sesiones > 4 ? `\n\n> Las sesiones 5 a ${sesiones} tienen objetivos de profundizacion progresiva sobre los mismos OA.` : "")
}

function buildPromptContext(params: {
  nivel: NivelKey; curso: string; asignatura: string; contexto: string
  mes: string; unidadId: string; selectedOAIds: string[]; selectedOATIds: string[]
  tiempoPlanificacion: TiempoPlanificacion; sesiones: number; duracionMinutos: number
  userMessage: string
}) {
  const { nivel, curso, asignatura, mes, unidadId, selectedOAIds, selectedOATIds, tiempoPlanificacion, sesiones, duracionMinutos, userMessage } = params
  const summary = getPlannerSummary({ nivel, curso, asignatura })
  const seasonText = SEASONS[mes] || ""
  const horizonText = buildPlanningHorizonText(tiempoPlanificacion, sesiones, duracionMinutos)
  const { oaNum } = extractOARequest(userMessage)

  const selectedOAContext = selectedOAIds.length
    ? buildSelectedOAContext({ nivel, curso, asignatura }, selectedOAIds, unidadId || undefined)
    : ""

  const fallbackOAContext = !selectedOAContext && oaNum
    ? buildOAContext(nivel, curso, asignatura, oaNum)
    : !selectedOAContext ? buildOAContext(nivel, curso, asignatura) : ""

  const oaContext = selectedOAContext || fallbackOAContext
  const unitContext = buildUnitContext(nivel, curso, asignatura, unidadId)
  const localCoverage = buildLocalCoverageNotice(nivel, curso, asignatura)
  const ambito = nivel === "parvularia" ? getParvulariaAmbito(curso, asignatura) : ""
  const oatContext = nivel === "parvularia" ? buildSelectedOATContext(curso, asignatura, selectedOATIds) : ""
  const stageContext = nivel === "parvularia" ? inferParvulariaStage(curso) : ""

  return { seasonText, horizonText, oaContext, unitContext, localCoverage, ambito, oatContext, stageContext, summary, selectedCount: selectedOAIds.length }
}



type SuggestionOAHit = {
  id: string
  label: string
  texto: string
  asignatura: string
  ambito?: string
  nucleo?: string
  score: number
  reason: string
}

type SuggestionOATHit = {
  id: string
  label: string
  description?: string
  asignatura: string
  score: number
  reason: string
}

type SuggestionContext = {
  temaUsuario: string
  curso: string
  tokens: string[]
  oaSugeridos: SuggestionOAHit[]
  oatSugeridos: SuggestionOATHit[]
  ambitosSugeridos: Array<{ ambito: string; score: number }>
  nucleosSugeridos: Array<{ nucleo: string; score: number }>
  resumenCurricular: string
}

function normalizeSuggestionText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenizeSuggestionText(text: string): string[] {
  const stopwords = new Set([
    "para", "como", "con", "una", "unos", "unas", "del", "las", "los", "que",
    "quiero", "hacer", "actividad", "trabajar", "sobre", "desde", "este", "esta",
    "estos", "estas", "seria", "podria", "puedo", "tema", "ideas", "idea", "usar",
    "objetivo", "objetivos", "parvulos", "parvulas", "ninos", "ninas", "nivel",
  ])

  return normalizeSuggestionText(text)
    .split(" ")
    .filter(Boolean)
    .filter((token) => token.length >= 3 && !stopwords.has(token))
}

function countSuggestionMatches(target: string, tokens: string[]): number {
  const normalizedTarget = normalizeSuggestionText(target)
  let score = 0

  for (const token of tokens) {
    if (normalizedTarget.includes(token)) {
      score += token.length >= 7 ? 4 : 2
    }
  }

  return score
}

function buildSuggestionReason(kind: "OA" | "OAT", temaUsuario: string, score: number): string {
  if (score >= 10) return `${kind} muy relacionado con el tema "${temaUsuario}".`
  if (score >= 6) return `${kind} relacionado de forma clara con el tema "${temaUsuario}".`
  return `${kind} con relacion parcial al tema "${temaUsuario}".`
}

function dedupeById<T extends { id: string; score: number }>(items: T[]): T[] {
  const map = new Map<string, T>()

  for (const item of items) {
    const prev = map.get(item.id)
    if (!prev || item.score > prev.score) {
      map.set(item.id, item)
    }
  }

  return [...map.values()]
}

function dedupeByKey<T extends { score: number }>(
  items: T[],
  getKey: (item: T) => string
): T[] {
  const map = new Map<string, T>()

  for (const item of items) {
    const key = getKey(item)
    const prev = map.get(key)
    if (!prev || item.score > prev.score) {
      map.set(key, item)
    }
  }

  return [...map.values()]
}

function suggestParvulariaFromTopic(curso: string, temaUsuario: string): SuggestionContext {
  const tokens = tokenizeSuggestionText(temaUsuario)
  const asignaturas = getAvailableAsignaturas("parvularia", curso)

  const oaHits: SuggestionOAHit[] = []
  const oatHits: SuggestionOATHit[] = []
  const ambitoHits: Array<{ ambito: string; score: number }> = []
  const nucleoHits: Array<{ nucleo: string; score: number }> = []

  for (const asignatura of asignaturas) {
    const oaOptions = getPlannerOAOptions({ nivel: "parvularia", curso, asignatura })

    for (const oa of oaOptions) {
      const textBase = [
        oa.id,
        oa.codigoOficial || "",
        oa.texto,
        oa.ambito || "",
        oa.nucleo || "",
        asignatura,
      ].join(" ")

      const score = countSuggestionMatches(textBase, tokens)
      if (score <= 0) continue

      oaHits.push({
        id: oa.id,
        label: oa.codigoOficial ? `${oa.codigoOficial} — ${oa.texto}` : `${oa.id} — ${oa.texto}`,
        texto: oa.texto,
        asignatura,
        ambito: oa.ambito,
        nucleo: oa.nucleo,
        score,
        reason: buildSuggestionReason("OA", temaUsuario, score),
      })

      if (oa.ambito) ambitoHits.push({ ambito: oa.ambito, score })
      if (oa.nucleo) nucleoHits.push({ nucleo: oa.nucleo, score })
    }

    const oatOptions = getParvulariaOAT(curso, asignatura)
    for (const oat of oatOptions) {
      const textBase = [oat.id, oat.label, oat.description || "", asignatura].join(" ")
      const score = countSuggestionMatches(textBase, tokens)
      if (score <= 0) continue

      oatHits.push({
        id: oat.id,
        label: oat.label,
        description: oat.description,
        asignatura,
        score,
        reason: buildSuggestionReason("OAT", temaUsuario, score),
      })
    }

    const ambito = getParvulariaAmbito(curso, asignatura)
    const ambitoScore = countSuggestionMatches(`${ambito} ${asignatura}`, tokens)
    if (ambito && ambitoScore > 0) {
      ambitoHits.push({ ambito, score: ambitoScore })
    }
  }

  const oaSugeridos = dedupeById(oaHits)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  const oatSugeridos = dedupeById(oatHits)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const ambitosSugeridos = dedupeByKey(ambitoHits, (item) => item.ambito)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  const nucleosSugeridos = dedupeByKey(nucleoHits, (item) => item.nucleo)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  const resumenCurricular = [
    `Curso/Subnivel: ${curso}`,
    `Tema del docente: ${temaUsuario}`,
    tokens.length ? `Palabras clave detectadas: ${tokens.join(", ")}` : "Palabras clave detectadas: sin coincidencias fuertes",
    ambitosSugeridos.length
      ? `Ambitos sugeridos: ${ambitosSugeridos.map((item) => item.ambito).join(" | ")}`
      : "Ambitos sugeridos: sin coincidencias claras",
    nucleosSugeridos.length
      ? `Nucleos sugeridos: ${nucleosSugeridos.map((item) => item.nucleo).join(" | ")}`
      : "Nucleos sugeridos: sin coincidencias claras",
    oaSugeridos.length
      ? `OA sugeridos: ${oaSugeridos.map((item) => item.id).join(", ")}`
      : "OA sugeridos: sin coincidencias claras",
    oatSugeridos.length
      ? `OAT sugeridos: ${oatSugeridos.map((item) => item.id).join(", ")}`
      : "OAT sugeridos: sin coincidencias claras",
  ].join("\n")

  return {
    temaUsuario,
    curso,
    tokens,
    oaSugeridos,
    oatSugeridos,
    ambitosSugeridos,
    nucleosSugeridos,
    resumenCurricular,
  }
}

function buildParvulariaSuggestionJsonPrompt(ctx: SuggestionContext): string {
  return `
CURSO/SUBNIVEL:
${ctx.curso}

TEMA DEL DOCENTE:
${ctx.temaUsuario}

RESUMEN CURRICULAR LOCAL:
${ctx.resumenCurricular}

OA SUGERIDOS:
${JSON.stringify(ctx.oaSugeridos, null, 2)}

OAT SUGERIDOS:
${JSON.stringify(ctx.oatSugeridos, null, 2)}

Debes responder SOLO JSON válido con esta estructura:
{
  "ambitosSugeridos": [
    { "ambito": "string", "score": 0 }
  ],
  "nucleosSugeridos": [
    { "nucleo": "string", "score": 0 }
  ],
  "oaSugeridos": [
    {
      "id": "string",
      "label": "string",
      "asignatura": "string",
      "ambito": "string",
      "nucleo": "string",
      "score": 0,
      "reason": "string"
    }
  ],
  "oatSugeridos": [
    {
      "id": "string",
      "label": "string",
      "asignatura": "string",
      "score": 0,
      "reason": "string"
    }
  ],
  "actividades": [
    {
      "titulo": "string",
      "objetivoBreve": "string",
      "inicio": "string",
      "desarrollo": "string",
      "cierre": "string",
      "materiales": ["string"],
      "evaluacion": "string",
      "adaptaciones": ["string"]
    }
  ],
  "sugerenciaDocente": "string"
}
`.trim()
}

function safeJsonParse<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    const match = raw.match(/\{[\s\S]*\}$|\[[\s\S]*\]$/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as T
    } catch {
      return null
    }
  }
}

function isChatHistoryItem(msg: unknown): msg is ChatHistoryItem {
  return (
    !!msg && typeof msg === "object" && "role" in msg && "content" in msg &&
    ((msg as { role?: unknown }).role === "user" || (msg as { role?: unknown }).role === "assistant") &&
    typeof (msg as { content?: unknown }).content === "string"
  )
}


// ── Web search for topic ideas ────────────────────────────────────────────────
async function searchTopicIdeas(nivel: NivelKey, curso: string, asignatura: string, mes: string): Promise<string> {
  const gKey = process.env.GEMINI_API_KEY
  if (!gKey) return ""

  const query = `ideas temas actividades ${nivel === "parvularia" ? "JUNJI parvularia" : "MINEDUC"} ${asignatura} ${curso} ${mes} Chile 2024 2025`

  try {
    // Use Gemini with web grounding to get real topic ideas
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tools: [{ google_search: {} }],
          contents: [{ parts: [{ text: `Busca y lista 6-8 temas concretos y actuales para trabajar en clases de ${asignatura} para ${curso} en ${mes} en Chile. Incluye temas relevantes del contexto chileno actual, efemérides, noticias educativas o iniciativas MINEDUC/JUNJI vigentes. Sé específico y práctico.` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
        signal: AbortSignal.timeout(12000),
      }
    )
    if (!res.ok) return ""
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""
    return text.slice(0, 1200)
  } catch {
    return ""
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud invalida" }, { status: 400 })

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message) return NextResponse.json({ error: "Falta el mensaje del usuario" }, { status: 400 })

  const history = Array.isArray(body.history) ? body.history : []
  const cfg: EducadorConfig = body.config || {}
  const mode = cfg.mode === "sugerir_parvularia" ? "sugerir_parvularia" : "planificar"

  const nivel: NivelKey = cfg.nivel === "parvularia" || cfg.nivel === "basica" || cfg.nivel === "media"
    ? cfg.nivel : "parvularia"

  const curso = typeof cfg.curso === "string" && cfg.curso.trim() ? cfg.curso.trim()
    : nivel === "parvularia" ? "Sala Cuna Menor (0 a 1 anio)" : nivel === "basica" ? "1 Basico" : "1 Medio"

  const asignatura = typeof cfg.asignatura === "string" && cfg.asignatura.trim() ? cfg.asignatura.trim()
    : nivel === "parvularia" ? "Lenguaje Verbal" : "Matematica"

  const contexto = typeof cfg.contexto === "string" ? cfg.contexto.trim() : ""
  const mes = normalizeMonth(cfg.mes)
  const unidadId = typeof cfg.unidadId === "string" ? cfg.unidadId.trim() : ""
  const selectedOAIds = ensureArray(cfg.selectedOAIds)
  const selectedOATIds = ensureArray(cfg.selectedOATIds)

  // ── Detect if user provided a specific topic or wants ideas ──────────────
  const messageLC = message.toLowerCase()
  const wantsIdeas = !contexto && (
    messageLC.includes("idea") || messageLC.includes("suger") ||
    messageLC.includes("qué puedo") || messageLC.includes("que puedo") ||
    messageLC.includes("tema") || messageLC.includes("no sé") ||
    messageLC.includes("no se") || messageLC.includes("ayuda") ||
    message.length < 40
  )
  const hasExplicitTopic = contexto.length > 20 || message.length > 60

  // If user wants ideas → search the web for real topics
  let webTopicIdeas = ""
  if (wantsIdeas) {
    webTopicIdeas = await searchTopicIdeas(nivel, curso, asignatura, mes)
  }

  // Topic priority instruction for system prompt
  const topicInstruction = hasExplicitTopic
    ? `PRIORIDAD MÁXIMA: El docente ya definió el tema/actividad: "${contexto || message}". Úsalo como eje central de toda la planificación. No propongas temas alternativos — desarrolla exactamente este.`
    : wantsIdeas && webTopicIdeas
      ? `El docente no tiene tema definido. Propón 5-7 temas concretos y actuales basados en esta búsqueda web:\n${webTopicIdeas}\n\nLuego pregunta cuál prefiere desarrollar.`
      : `El docente no indicó un tema específico. Propón 4-5 temas relevantes para ${asignatura} en ${curso} durante ${mes} en el contexto escolar chileno y pregunta cuál desarrollar.`

  if (mode === "sugerir_parvularia") {
    if (nivel !== "parvularia") {
      return NextResponse.json(
        { error: "El modo sugerir_parvularia solo aplica para Educacion Parvularia" },
        { status: 400 }
      )
    }

    const temaUsuario = (contexto || message).trim()
    if (!temaUsuario) {
      return NextResponse.json(
        { error: "Falta el tema o descripcion para sugerir OA, OAT y actividades" },
        { status: 400 }
      )
    }

    const localSuggestion = suggestParvulariaFromTopic(curso, temaUsuario)
    const strategy = getEducadorModelStrategy("parvularia_suggestion")

  const systemPrompt = `Eres APl, el Agente Planificador Curricular de EduAI, especializado en Educacion Parvularia de Chile.
Trabajas con las BCEP.
Tu tarea es sugerir experiencias de aprendizaje a partir de un tema dado por el docente.
REGLAS:
1. Usa primero el contexto curricular local entregado.
2. No inventes OA u OAT fuera del contexto si ya hay coincidencias locales.
3. Prioriza juego, exploracion, mediacion, lenguaje apropiado al subnivel y evaluacion formativa.
4. Devuelve SOLO JSON valido.
5. Si no hay coincidencias perfectas, propone las mas cercanas y explicalo en "sugerenciaDocente".`

    const userPrompt = buildParvulariaSuggestionJsonPrompt(localSuggestion)

    try {
      const result = await callAI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          maxTokens: strategy.maxTokens,
          preferProvider: strategy.preferProvider,
          openrouterModel: strategy.openrouterModel,
        }
      )

      return NextResponse.json({
        success: true,
        mode,
        provider: result.provider,
        model: result.model,
        temaUsuario,
        cursoKey: cursoToKey(curso),
        localSuggestion,
        suggestion: safeJsonParse(result.text),
        raw: result.text,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No fue posible sugerir actividades de parvularia"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  }


  const tiempoPlanificacion: TiempoPlanificacion =
    cfg.tiempoPlanificacion === "diaria" || cfg.tiempoPlanificacion === "semanal" || cfg.tiempoPlanificacion === "mensual"
      ? cfg.tiempoPlanificacion : "diaria"

  const sesiones = clampNumber(cfg.sesiones, 1, 1, 40)
  const duracionMinutos = clampNumber(cfg.duracionMinutos, nivel === "parvularia" ? 30 : 90, 15, 300)

  const promptContext = buildPromptContext({
    nivel, curso, asignatura, contexto, mes, unidadId,
    selectedOAIds, selectedOATIds, tiempoPlanificacion,
    sesiones, duracionMinutos, userMessage: message,
  })

  const isBasicaMedia = nivel === "basica" || nivel === "media"
  const isParv = nivel === "parvularia"
  const sessionWord = sesiones === 1 ? "1 sesion" : `${sesiones} sesiones`
  const sessionBlocks = buildSessionBlocks(sesiones, duracionMinutos)
  const claseObjectives = isBasicaMedia ? buildClaseObjectives(sesiones) : ""


  const systemPrompt = `Eres APl, el Agente Planificador Curricular de EduAI, especializado en el curriculum oficial chileno del MINEDUC.

Tu mision: generar planificaciones docentes completas, rigurosas, detalladas y directamente usables en el aula chilena real.

${topicInstruction}

REGLAS CRITICAS - NUNCA VIOLAR:
1. NUNCA inventes OA. Usa SOLO los OA entregados en el contexto.
2. Si no hay OA oficiales para la combinacion, indicalo antes de planificar.
3. Si hay varios OA seleccionados, articulalos en toda la planificacion.
4. Si hay unidad o modulo seleccionado, la planificacion se centra en ese marco.
5. En Parvularia integra siempre: subnivel, ambito, nucleo, OA y OAT disponibles.
6. NUNCA cortes la respuesta. SIEMPRE completa TODOS los bloques del formato.
7. Los indicadores de evaluacion deben ser observables y derivarse directamente del OA.
8. Los objetivos de clase deben ser concretos y en lenguaje docente real.
9. Escribe en espanol formal, claro y pedagogico.
10. El resultado debe poder copiarse directamente a un documento docente.

CONTEXTO CURRICULAR:
Nivel: ${nivel}
Curso/Subnivel: ${curso}
Asignatura/Nucleo: ${asignatura}
${isParv ? `Contexto del subnivel: ${promptContext.stageContext}` : ""}
Referencia curricular: ${NIVEL_INFO[nivel]}
Cobertura local: ${promptContext.localCoverage}
${promptContext.unitContext || "Sin unidad o modulo local seleccionado."}
${promptContext.oaContext || "ADVERTENCIA: No hay OA oficiales locales para esta combinacion. Indicalo claramente antes de planificar."}
${isParv && promptContext.ambito ? `Ambito de experiencia: ${promptContext.ambito}` : ""}
${isParv && promptContext.oatContext ? promptContext.oatContext : ""}

CONTEXTO TEMPORAL:
Mes: ${mes} - ${promptContext.seasonText || "sin referencia estacional especifica"}
Horizonte: ${tiempoPlanificacion} - ${sessionWord} - ${duracionMinutos} min c/u
${promptContext.horizonText}
${contexto ? `Contexto adicional del docente: ${contexto}` : ""}
Cobertura detectada: ${promptContext.summary.units} unidades - ${promptContext.summary.oas} OA locales - ${promptContext.selectedCount} OA seleccionados

FORMATO OBLIGATORIO - COMPLETAR TODOS LOS BLOQUES SIN EXCEPCION:

---

# Planificacion Docente

## Datos generales

| Campo | Detalle |
|---|---|
| Nivel / Curso | ${curso} |
| Asignatura / Nucleo | ${asignatura} |
| Unidad / Modulo / Bloque | (completar segun contexto) |
| Horizonte | ${tiempoPlanificacion} |
| Sesiones | ${sesiones} |
| Duracion por sesion | ${duracionMinutos} min |
| Mes | ${mes} |

---

## Objetivo(s) de Aprendizaje

${isParv ? `**Subnivel:** (segun configuracion)
**Ambito:** (segun contexto)
**Nucleo:** ${asignatura}
**OA oficial:** (texto oficial completo del OA o de cada OA seleccionado)
**OAT seleccionados:** (listar OAT o indicar "Sin OAT seleccionados")` : `- **OA [codigo]:** (texto oficial completo)
- **OA [codigo]:** (si hay mas de uno, continuar - uno por linea)`}

---

## Indicadores de evaluacion

${isBasicaMedia ? `| N | Indicador | Nivel de logro esperado |
|---|---|---|
| 1 | El/la estudiante es capaz de... | Basico |
| 2 | Identifica / Explica / Aplica / Analiza... | Intermedio |
| 3 | Demuestra comprension de... | Intermedio |
| 4 | Produce / Crea / Formula... | Avanzado |
| 5 | Reflexiona sobre / Evalua... | Avanzado |
| 6 | Colabora / Participa / Comunica... | (cualitativo) |` : `- El/la parvula demuestra... (observable 1)
- El/la parvula es capaz de... (observable 2)
- Se observa en el/la parvula... (observable 3)
- El/la parvula participa / explora / expresa... (observable 4)`}

---

${isBasicaMedia ? `## Objetivos de clase

${claseObjectives}

---

` : ""}## Proposito de aprendizaje

(Redactar 2-3 parrafos: que aprendera el estudiante, por que es relevante para su vida o contexto, como se articula con el curriculum del nivel.)

---

## Planificacion de clase(s)

${sessionBlocks}

---

## Evaluacion

| Aspecto | Detalle |
|---|---|
| Tipo | Formativa / Sumativa / Diagnostica |
| Momento | Inicio / Durante el proceso / Cierre |
| Instrumento | (lista de cotejo / rubrica / observacion directa / prueba / portfolio / autoevaluacion) |
| Evidencia esperada | (que debe producir, demostrar o comunicar el estudiante) |
| Criterios de logro | (condiciones para considerar el OA logrado) |

---

## Recursos y materiales

- (recurso 1 - tipo, nombre y como se usa)
- (recurso 2 - material manipulativo o fungible si aplica)
- (recurso digital o audiovisual si aplica)
- (texto o imagen de apoyo si aplica)

---

## Adaptaciones y diversidad

**Estudiantes con ritmo mas lento o dificultades:**
- (estrategia: simplificacion, apoyo visual, scaffolding, tiempo extra)

**Estudiantes aventajados:**
- (desafio adicional, rol de tutor, proyecto ampliado)

**NEE y diversidad:**
- (ajuste especifico segun contexto disponible)

---

## Observaciones pedagogicas

- (recomendacion 1 para implementacion real en aula chilena)
- (recomendacion 2 - consideracion del mes o periodo escolar)
- (recomendacion 3 - continuidad para proximas sesiones)
- (recomendacion 4 - dificultades anticipadas y como manejarlas)

---

CRITERIOS DE CALIDAD - VERIFICAR ANTES DE RESPONDER:
- OA usados son SOLO los entregados en el contexto (nunca inventados)
- Indicadores son observables y se derivan directamente del OA
- Objetivos de clase (basica/media) son concretos y medibles, uno o dos por sesion
- Planificacion de clase tiene timing explicito con minutos por etapa
- Evaluacion esta alineada con OA e indicadores declarados
- Recursos son realistas para el aula chilena
- Adaptaciones son concretas, no frases genericas
- Respuesta COMPLETA - sin cortar ningun bloque bajo ninguna circunstancia
- Parvularia: lenguaje ludico, experiencial, afectivo y apropiado al subnivel
- Sala Cuna: sin estructuras escolarizadas, experiencias sensoriales y breves`.trim()

  const aiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-8).filter(isChatHistoryItem).map((msg: ChatHistoryItem) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: "user" as const, content: message },
  ]

  try {
    const strategy = getEducadorModelStrategy(
      sesiones > 1 || selectedOAIds.length > 1 || message.length > 500
        ? "planning_full"
        : "planning_short"
    )

    const result = await callAI(aiMessages, {
      maxTokens: strategy.maxTokens,
      preferProvider: strategy.preferProvider,
      openrouterModel: strategy.openrouterModel,
    })

    return NextResponse.json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      cursoKey: cursoToKey(curso),
      localCoverage: promptContext.summary,
      hasLocalCurriculum: promptContext.summary.oas > 0,
      selectedOAIds,
      selectedOATIds,
      unidadId,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "No fue posible generar la planificacion"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
