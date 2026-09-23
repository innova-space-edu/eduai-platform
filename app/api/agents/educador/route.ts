import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callAI, getEducadorModelStrategy } from "@/lib/ai-router-v4"
import { runAIText as runAIGatewayText } from "@/lib/ai/gateway"
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
import { buildDesignPromptDirective, getDesignTemplateSummary } from "@/lib/design-templates/registry"
import {
  auditPlanningOutput,
  buildPlanningProfilePrompt,
  buildRepairInstruction,
  inferPlanningProfile,
  isPlanningProfileId,
  type PlanningProfile,
  type PlanningProfileId,
} from "@/lib/school-planning-profiles"
import { buildConnectedOAContext, resolveOAConnection } from "@/lib/planner-oa-bridge"
import { expectedSchoolWeekLabel, getSchoolPlanningPeriodLabel, normalizeSchoolWeekLabel, schoolPlanningMonthLabel, validateSchoolPlanningWeeks } from "@/lib/school-planning-template"
import { buildParvulariaDateLabel, buildParvulariaPeriodGuide, parseParvulariaPlanningDocument, parvulariaHorizonLabel, serializeParvulariaPlanningDocument } from "@/lib/parvularia-planning"
import bcepReference from "@/data/mineduc/parvularia/common/bcep_2018_reference.json"
import { buildParvulariaKnowledgeContext, evaluateParvulariaNovelty, rememberParvulariaGeneration } from "@/lib/parvularia-knowledge"

export const runtime = "nodejs"
export const maxDuration = 60

type TiempoPlanificacion = "diaria" | "semanal" | "quincenal" | "mensual" | "semestral" | "anual"

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
  designTemplateId?: string
  parvulariaHeterogenea?: boolean
  parvulariaSegundoCurso?: string
  parvulariaMotivoFusion?: string
  planningProfile?: PlanningProfileId
  profesor?: string
  horasSemanales?: string
  establecimiento?: string
  ciudad?: string
  periodoId?: string
  anioPlanificacion?: number
  weeklyOAPlan?: Array<{ key?: string; month?: string; week?: number; oaIds?: string[] }>
  parvulariaJourneyNucleos?: string[]
  parvulariaJourneyOAIds?: string[][]
  parvulariaJourneyOATIds?: string[][]
  educadoraParvularia?: string
  asistentesParvularia?: string
  fechaInicioParvularia?: string
  fechaFinParvularia?: string
}

function educadorDesignFormat(intent: string) {
  if (intent === "planificacion") return "planning"
  if (intent === "rubrica") return "exam"
  if (intent === "guia" || intent === "tarea") return "worksheet"
  if (intent === "indicadores") return "report"
  return "lessonplan"
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

function ensureParvulariaJourneyOAIds(value: unknown): string[][] {
  const raw = Array.isArray(value) ? value : []
  return [0, 1, 2].map((index) => ensureArray(raw[index]))
}

function ensureParvulariaJourneyOATIds(value: unknown): string[][] {
  const raw = Array.isArray(value) ? value : []
  return [0, 1, 2].map((index) => ensureArray(raw[index]))
}

function ensureParvulariaJourneyNucleos(value: unknown, fallback: string): string[] {
  const raw = Array.isArray(value) ? value : []
  return [0, 1, 2].map((index) => {
    const candidate = typeof raw[index] === "string" ? raw[index].trim() : ""
    return candidate || fallback
  })
}

type WeeklyOAConfig = { key: string; month: string; week: number; oaIds: string[] }

function ensureWeeklyOAPlan(value: unknown): WeeklyOAConfig[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): WeeklyOAConfig[] => {
    if (!item || typeof item !== "object") return []
    const raw = item as { key?: unknown; month?: unknown; week?: unknown; oaIds?: unknown }
    const month = typeof raw.month === "string" ? raw.month.trim().toLowerCase() : ""
    const week = Number(raw.week)
    const key = typeof raw.key === "string" && raw.key.trim() ? raw.key.trim() : month && Number.isInteger(week) ? `${month}-${week}` : ""
    if (!key || !month || !Number.isInteger(week) || week < 1 || week > 6) return []
    return [{ key, month, week, oaIds: ensureArray(raw.oaIds) }]
  })
}

function buildWeeklyOAContext(params: {
  nivel: NivelKey
  curso: string
  asignatura: string
  weeklyOAPlan: WeeklyOAConfig[]
}) {
  const allOA = getPlannerOAOptions({ nivel: params.nivel, curso: params.curso, asignatura: params.asignatura })
  const byId = new Map(allOA.map((oa) => [oa.id, oa]))
  return params.weeklyOAPlan.map((week) => {
    const assigned = week.oaIds.map((id) => byId.get(id)).filter((oa): oa is NonNullable<typeof oa> => Boolean(oa))
    const oaText = assigned.map((oa) => {
      const indicators = oa.indicadores?.length ? ` Indicadores curriculares disponibles: ${oa.indicadores.join(" / ")}` : ""
      return `${oa.codigoOficial || oa.id}: ${oa.texto}${indicators}`
    }).join(" || ")
    return `- ${schoolPlanningMonthLabel(week.month)} · semana ${week.week}: ${oaText || "SIN OA"}`
  }).join("\n")
}

function inspectInstitutionalTable(text: string, expectedWeeks: WeeklyOAConfig[]) {
  const lines = String(text || "").replace(/\r/g, "").split("\n")
  const headerIndex = lines.findIndex((line) => {
    const upper = line.toUpperCase()
    return line.trim().startsWith("|") && upper.includes("SEMANA") && upper.includes("INDICADORES") && upper.includes("OBJETIVO")
  })
  if (headerIndex < 0) return { rows: 0, valid: false, error: "No se encontró la tabla institucional." }

  const weekCells: string[] = []
  let started = false
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line.startsWith("|")) {
      if (started && line) break
      continue
    }
    if (/^\|?\s*:?-{2,}/.test(line)) continue
    const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|")
    if (cells.length !== 4) return { rows: weekCells.length, valid: false, error: "La tabla debe tener exactamente cuatro columnas." }
    weekCells.push(cells[0].trim())
    started = true
  }

  if (weekCells.length !== expectedWeeks.length) {
    return { rows: weekCells.length, valid: false, error: `Se esperaban ${expectedWeeks.length} filas y se recibieron ${weekCells.length}.` }
  }

  for (let index = 0; index < expectedWeeks.length; index += 1) {
    const expected = normalizeSchoolWeekLabel(expectedSchoolWeekLabel(expectedWeeks[index].month, expectedWeeks[index].week))
    const actual = normalizeSchoolWeekLabel(weekCells[index])
    if (actual !== expected) {
      return { rows: weekCells.length, valid: false, error: `La fila ${index + 1} no corresponde a ${expectedWeeks[index].key}.` }
    }
  }

  return { rows: weekCells.length, valid: weekCells.length > 0, error: "" }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function findShortParvulariaActivities(experience: string): string[] {
  const source = String(experience || "").replace(/\r/g, "")
  const match = source.match(/desarrollo\s*:\s*([\s\S]*?)(?=\n?\s*finalizaci[oó]n\s*:|$)/i)
  const development = match?.[1]?.trim() || ""
  if (!development) return ["Desarrollo sin contenido"]

  const lines = development
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const candidates = lines.length ? lines : [development]
  return candidates.flatMap((line) => {
    const withoutBullet = line.replace(/^[•·*Ø\-–—]+\s*/, "").trim()
    if (!withoutBullet) return []

    // Los subtítulos de edad/tramo pueden ser breves; la actividad que los sigue no.
    if (/^(?:edades?.*|sala cuna (?:menor|mayor)|nivel (?:medio|transici[oó]n))\s*:?\s*$/i.test(withoutBullet)) return []
    if (/^(?:semana|mes|tramo)\s+\d+\s*:?\s*$/i.test(withoutBullet)) return []

    const activityText = withoutBullet
      .replace(/^(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d{1,2}(?:\s+de\s+[\p{L}]+|[-/]?[\p{L}\d-]+)?\s*[:\-–—]?\s*/iu, "")
      .replace(/^(?:semana|mes|tramo)\s+\d+\s*[:\-–—]\s*/i, "")
      .trim()

    // Umbral deliberadamente moderado: evita títulos telegráficos sin convertir
    // cada experiencia en un párrafo largo. El prompt apunta a ~100-180 caracteres.
    return activityText.length > 0 && activityText.length < 95 ? [activityText] : []
  })
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

function getParvulariaAgeHeading(curso: string): string {
  const c = curso.toLowerCase()
  if (c.includes("sala cuna menor")) return "Edades 06 meses a 12 meses"
  if (c.includes("sala cuna mayor")) return "Edades 1 año a 2 años"
  if (c.includes("medio menor")) return "Edades 2 a 3 años"
  if (c.includes("medio mayor")) return "Edades 3 a 4 años"
  if (c.includes("nt1")) return "Edades 4 a 5 años"
  if (c.includes("nt2")) return "Edades 5 a 6 años"
  return `Nivel ${curso}`
}

function normalizeParvulariaComparisonText(value: string): string {
  return value
    .toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function inspectHeterogeneousDevelopment(
  experience: string,
  ageHeadings: string[],
  requiredDateLabels: string[],
): string[] {
  const source = String(experience || "").replace(/\r/g, "")
  const match = source.match(/desarrollo\s*:\s*([\s\S]*?)(?=\n?\s*finalizaci[oó]n\s*:|$)/i)
  const development = match?.[1]?.trim() || ""
  if (!development) return ["Desarrollo sin contenido para diferenciar por nivel."]

  const normalized = normalizeParvulariaComparisonText(development)
  const normalizedHeadings = ageHeadings.map(normalizeParvulariaComparisonText)
  const positions = normalizedHeadings.map((heading) => normalized.indexOf(heading))
  const issues: string[] = []

  positions.forEach((position, index) => {
    if (position < 0) issues.push(`Falta el bloque "${ageHeadings[index]}".`)
  })
  if (issues.length) return issues

  positions.forEach((position, index) => {
    const nextPositions = positions.filter((candidate) => candidate > position)
    const end = nextPositions.length ? Math.min(...nextPositions) : normalized.length
    const section = normalized.slice(position, end)
    const activityContent = section.replace(normalizedHeadings[index], "").trim()

    if (activityContent.length < 90) {
      issues.push(`El bloque "${ageHeadings[index]}" no contiene actividades suficientemente desarrolladas.`)
    }

    for (const dateLabel of requiredDateLabels) {
      const normalizedDate = normalizeParvulariaComparisonText(dateLabel)
      if (normalizedDate && !section.includes(normalizedDate)) {
        issues.push(`En "${ageHeadings[index]}" falta la actividad correspondiente a ${dateLabel}.`)
      }
    }
  })

  return issues
}

function buildFallbackParvulariaActivity(params: {
  curso: string
  journeyIndex: number
  nucleo: string
  sequence: number
  variationSeed?: number
}): string {
  const c = params.curso.toLowerCase()
  const variation = (params.sequence + (params.variationSeed || 0)) % 4
  const suffixes = [
    ` vinculada con ${params.nucleo}, con mediación ajustada a la edad y registro de respuestas observables.`,
    ` vinculada con ${params.nucleo}, favoreciendo elección, exploración autónoma y documentación breve de la respuesta infantil.`,
    ` vinculada con ${params.nucleo}, alternando exploración libre y una provocación breve del adulto para observar avances concretos.`,
    ` vinculada con ${params.nucleo}, cambiando espacio, disposición y forma de interacción para evitar repetir la misma mecánica.`,
  ]
  const suffix = suffixes[variation]

  if (params.journeyIndex === 2) {
    if (c.includes("sala cuna menor")) {
      const options = [
        "Los párvulos observarán objetos reales y fotografías contrastadas, escucharán palabras breves y responderán con mirada, balbuceo, gestos o movimientos",
        "Los párvulos explorarán una bolsa sonora con objetos conocidos mientras el adulto nombra cada hallazgo, espera turnos de respuesta y amplía vocalizaciones",
        "Los párvulos participarán en un relato de objetos concretos, tocando y mirando cada elemento mientras el adulto acompaña con sonidos, pausas y gestos repetibles",
        "Los párvulos elegirán entre dos estímulos visuales o sonoros y comunicarán preferencia mediante mirada, alcance, sonrisa o vocalización acompañada por el adulto",
      ]
      return `${options[variation]}${suffix}`
    }
    if (c.includes("sala cuna mayor")) {
      const options = [
        "Los niños y niñas señalarán, imitarán sonidos, elegirán imágenes u objetos y participarán en canciones o relatos breves con palabras y gestos",
        "Los niños y niñas buscarán objetos nombrados en distintos puntos del espacio, los mostrarán al grupo y acompañarán la acción con palabras, sonidos o gestos",
        "Los niños y niñas completarán secuencias breves de un cuento con objetos reales, anticipando acciones mediante gestos, palabras emergentes y elección de imágenes",
        "Los niños y niñas participarán en un juego de turnos con títeres u objetos sonoros, respondiendo preguntas simples y proponiendo sonidos o palabras conocidas",
      ]
      return `${options[variation]}${suffix}`
    }
    if (c.includes("medio menor")) return `Los niños y niñas nombrarán objetos, responderán preguntas simples y reconstruirán partes de un relato mediante imágenes, gestos y frases breves${suffix}`
    if (c.includes("medio mayor")) return `Los niños y niñas describirán, compararán y relatarán situaciones breves, ampliando vocabulario y turnos de conversación con apoyos visuales${suffix}`
    return `Los párvulos participarán en conversación, relato o lectura compartida, formulando ideas y respuestas acordes a su subnivel${suffix}`
  }

  if (params.journeyIndex === 1) {
    if (c.includes("sala cuna menor")) {
      const options = [
        "Los párvulos tocarán, observarán y moverán materiales artísticos o sensoriales seguros, reaccionando a colores, texturas, sonidos y movimientos con apoyo cercano",
        "Los párvulos explorarán telas, papeles translúcidos y objetos sonoros desde distintas posturas, siguiendo cambios de luz, textura y sonido con mediación afectiva",
        "Los párvulos producirán huellas y movimientos sobre una superficie protegida con materiales lavables, observando marcas y cambios mediante manos o pies",
        "Los párvulos descubrirán sonidos suaves al agitar, rozar o golpear materiales seguros, mientras el adulto acompaña ritmos y observa preferencias sensoriales",
      ]
      return `${options[variation]}${suffix}`
    }
    if (c.includes("sala cuna mayor")) {
      const options = [
        "Los niños y niñas trasladarán, golpearán, agitarán y combinarán materiales de color, textura o sonido, explorando movimientos con mayor autonomía",
        "Los niños y niñas crearán recorridos de color y textura con telas, papeles y recipientes, eligiendo materiales y comparando efectos mediante movimiento libre",
        "Los niños y niñas experimentarán con instrumentos simples y objetos cotidianos, alternando intensidad y ritmo mientras imitan y proponen movimientos corporales",
        "Los niños y niñas combinarán materiales lavables para dejar marcas, estampar o arrastrar, observando transformaciones y comunicando preferencias al equipo",
      ]
      return `${options[variation]}${suffix}`
    }
    if (c.includes("medio menor")) return `Los niños y niñas elegirán materiales, producirán trazos, sonidos o movimientos y combinarán texturas y colores mediante juego expresivo${suffix}`
    if (c.includes("medio mayor")) return `Los niños y niñas crearán composiciones simples, compararán efectos de color, sonido o textura y comunicarán preferencias durante la experiencia${suffix}`
    return `Los párvulos planificarán y realizarán una producción artística o sensorial, tomando decisiones y explicando parte de su proceso${suffix}`
  }

  if (c.includes("sala cuna menor")) {
    const options = [
      "Los párvulos tocarán, observarán, alcanzarán o recorrerán materiales seguros mediante manos, pies o gateo, con acompañamiento corporal y verbal cercano",
      "Los párvulos explorarán una ruta breve con objetos de distintas texturas y alturas seguras, alcanzando, empujando o siguiendo estímulos desde su postura disponible",
      "Los párvulos investigarán recipientes amplios con objetos seguros, sacando, tocando, soltando y volviendo a buscar elementos mientras el adulto describe sus acciones",
      "Los párvulos explorarán elementos naturales seguros dispuestos en bandejas o telas, acercando manos, pies y mirada mientras el adulto acompaña sin sobreintervenir",
    ]
    return `${options[variation]}${suffix}`
  }
  if (c.includes("sala cuna mayor")) {
    const options = [
      "Los niños y niñas se desplazarán, trasladarán, introducirán, sacarán o combinarán materiales, explorando relaciones simples mediante acción autónoma guiada",
      "Los niños y niñas recorrerán pequeñas estaciones de exploración, transportando objetos y resolviendo cómo alcanzar, encajar, vaciar o agrupar materiales seguros",
      "Los niños y niñas experimentarán con recipientes, tubos y objetos de distinto tamaño, probando introducir, sacar, apilar y trasladar mientras comparan resultados",
      "Los niños y niñas explorarán materiales naturales o cotidianos distribuidos en el espacio, eligiendo rutas, reuniendo elementos y comunicando hallazgos al adulto",
    ]
    return `${options[variation]}${suffix}`
  }
  if (c.includes("medio menor")) return `Los niños y niñas escogerán, agruparán, trasladarán y compararán materiales concretos, nombrando acciones o propiedades durante el juego exploratorio${suffix}`
  if (c.includes("medio mayor")) return `Los niños y niñas compararán, clasificarán, transformarán o construirán con materiales, explicando hallazgos y tomando decisiones durante la exploración${suffix}`
  return variation === 0
    ? `Los párvulos investigarán materiales o situaciones, anticiparán resultados, probarán alternativas y comunicarán hallazgos de acuerdo con su subnivel${suffix}`
    : `Los párvulos resolverán un desafío de exploración con materiales concretos, comparando resultados y explicando decisiones según sus posibilidades${suffix}`
}

function buildParvulariaSessionBlocks(sesiones: number, duracionMinutos: number, heterogenea = false): string {
  const acogida = Math.max(3, Math.round(duracionMinutos * 0.18))
  const exploracion = Math.max(8, Math.round(duracionMinutos * 0.54))
  const cierre = Math.max(4, duracionMinutos - acogida - exploracion)
  const maxSes = Math.min(sesiones, 5)
  const adecuacion = heterogenea
    ? `

**Adecuación por edad dentro de la misma experiencia**
- Rango menor: participación breve, sensorial, vínculo afectivo, exploración asistida y respuesta corporal/gestual.
- Rango mayor: mayor autonomía, elección de materiales, imitación, lenguaje emergente, desplazamiento y colaboración simple.
- Mantener el mismo ambiente y propósito, variando complejidad, tiempo de atención, material y mediación.`
    : ""

  return Array.from({ length: maxSes }, (_, i) => {
    const n = i + 1
    return `### Experiencia ${n} de ${sesiones} - ${duracionMinutos} min

**Acogida y vínculo (${acogida} min)**
- Recibir a los párvulos con tono cercano, contacto visual, canción breve, objeto motivador o rutina conocida.
- Observar disposición emocional, señales de cansancio, apego, interés y necesidad de contención.

**Exploración lúdica y sensorial (${exploracion} min)**
- Presentar una provocación concreta: objeto, sonido, textura, imagen, elemento natural, mini estación o juego guiado.
- Permitir exploración libre y segura, con mediación verbal breve, preguntas simples, modelamiento y acompañamiento corporal.
- Registrar evidencias observables: mirada, gestos, vocalizaciones, desplazamiento, manipulación, imitación, elección o interacción.${adecuacion}

**Cierre afectivo y registro (${cierre} min)**
- Reunir al grupo con canción, gesto de cierre o verbalización breve de lo vivido.
- Nombrar emociones, acciones y descubrimientos observados.
- Registrar 2 a 3 evidencias para retroalimentar a familia/equipo y ajustar la próxima experiencia.`
  }).join("\n\n") + (sesiones > 5 ? `\n\n> **Continuidad:** Las experiencias 6 a ${sesiones} mantienen la misma estructura, aumentando progresivamente exploración, participación, lenguaje, autonomía y complejidad del material.` : "")
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
  parvulariaHeterogenea?: boolean
  parvulariaSegundoCurso?: string
  parvulariaMotivoFusion?: string
  planningProfile?: PlanningProfileId
}) {
  const { nivel, curso, asignatura, mes, unidadId, selectedOAIds, selectedOATIds, tiempoPlanificacion, sesiones, duracionMinutos, userMessage, parvulariaHeterogenea, parvulariaSegundoCurso, parvulariaMotivoFusion } = params
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
  const secondStageContext = nivel === "parvularia" && parvulariaHeterogenea && parvulariaSegundoCurso
    ? inferParvulariaStage(parvulariaSegundoCurso)
    : ""
  const heteroContext = nivel === "parvularia" && parvulariaHeterogenea
    ? [
        "PLANIFICACIÓN PARVULARIA HETEROGÉNEA / NIVELES UNIDOS:",
        `- Nivel base: ${curso}`,
        parvulariaSegundoCurso ? `- Segundo rango/subnivel integrado: ${parvulariaSegundoCurso}` : "",
        secondStageContext ? `- Caracterización segundo rango: ${secondStageContext}` : "",
        parvulariaMotivoFusion ? `- Motivo/contexto de unión: ${parvulariaMotivoFusion}` : "",
        "- En Desarrollo separar explícitamente las actividades por subnivel/edad. Cada rango debe tener su propio bloque completo de actividades; no usar una experiencia común seguida de adaptaciones breves.",
      ].filter(Boolean).join("\n")
    : ""

  return { seasonText, horizonText, oaContext, unitContext, localCoverage, ambito, oatContext, stageContext, secondStageContext, heteroContext, summary, selectedCount: selectedOAIds.length }
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


type EducadorOutputIntent =
  | "planificacion"
  | "rubrica"
  | "indicadores"
  | "tarea"
  | "guia"
  | "carta"
  | "adaptacion"
  | "interdisciplinario"
  | "actividad"
  | "secuencia"
  | "efemeride"

function truncateForPrompt(text: string, max = 2600): string {
  if (!text) return ""
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n...[texto resumido por longitud para evitar errores de límite]`
}

function getSelectedOASummary(oaContext: string): string {
  const clean = oaContext.trim()
  if (!clean) return "Sin OA locales seleccionados o disponibles."
  return truncateForPrompt(clean, 2200)
}

function getOutputIntent(params: {
  wantsRubrica: boolean
  wantsIndicadores: boolean
  wantsTarea: boolean
  wantsGuia: boolean
  wantsCarta: boolean
  wantsAdaptacion: boolean
  wantsInter: boolean
  wantsActividad: boolean
  wantsEfemeride: boolean
  wantsSecuencia: boolean
}): EducadorOutputIntent {
  if (params.wantsRubrica) return "rubrica"
  if (params.wantsIndicadores) return "indicadores"
  if (params.wantsTarea) return "tarea"
  if (params.wantsGuia) return "guia"
  if (params.wantsCarta) return "carta"
  if (params.wantsAdaptacion) return "adaptacion"
  if (params.wantsInter) return "interdisciplinario"
  if (params.wantsSecuencia) return "secuencia"
  if (params.wantsEfemeride) return "efemeride"
  if (params.wantsActividad) return "actividad"
  return "planificacion"
}

function buildCompactEducadorSystemPrompt(params: {
  intent: EducadorOutputIntent
  nivel: NivelKey
  curso: string
  asignatura: string
  mes: string
  contexto: string
  unidadLabel: string
  tiempoPlanificacion: TiempoPlanificacion
  sesiones: number
  duracionMinutos: number
  promptContext: ReturnType<typeof buildPromptContext>
}): string {
  const {
    intent,
    nivel,
    curso,
    asignatura,
    mes,
    contexto,
    unidadLabel,
    tiempoPlanificacion,
    sesiones,
    duracionMinutos,
    promptContext,
  } = params

  const base = `Eres APl, Agente Planificador Curricular de EduAI para el curriculum chileno.\n\nCONTEXTO ACTIVO:\n- Nivel: ${nivel}\n- Curso/Subnivel: ${curso}\n- Asignatura/Núcleo: ${asignatura}\n- Unidad/Bloque: ${unidadLabel || "Sin unidad local seleccionada"}\n- Mes: ${mes}\n- Horizonte: ${tiempoPlanificacion}; ${sesiones} sesión(es); ${duracionMinutos} minutos por sesión\n- Contexto o idea del docente: ${truncateForPrompt(contexto || "El docente entregará la solicitud en el mensaje.", 1600)}\n${nivel === "parvularia" && promptContext.ambito ? `- Ámbito de experiencia: ${promptContext.ambito}\n` : ""}${nivel === "parvularia" && promptContext.stageContext ? `- Caracterización del subnivel: ${promptContext.stageContext}\n` : ""}\nMARCO CURRICULAR DISPONIBLE:\n${getSelectedOASummary(promptContext.oaContext)}\n${promptContext.oatContext ? `\n${truncateForPrompt(promptContext.oatContext, 1200)}\n` : ""}\nREGLAS GENERALES:\n1. Responde en español claro, formal y pedagógico.\n2. Usa el mensaje del docente como eje principal.\n3. No inventes OA oficiales si no aparecen en el marco curricular; si faltan, trabaja con criterios pedagógicos generales.\n4. Mantén la respuesta completa, útil y directamente aplicable en aula chilena.`

  if (intent === "rubrica") {
    return `${base}\n\nTAREA ESPECÍFICA:\nGenera SOLO una RÚBRICA ANALÍTICA COMPLETA. No generes una planificación completa.\nLa rúbrica debe evaluar exactamente la solicitud del docente.\n\nFORMATO OBLIGATORIO:\n# Rúbrica de evaluación\n\n## Datos generales\n| Campo | Detalle |\n|---|---|\n| Curso(s) | ... |\n| Tema | ... |\n| Producto evaluado | ... |\n| Duración mínima de presentación | ... |\n| Duración mínima de actividad/intervención | ... |\n| Puntaje sugerido | 100 puntos |\n\n## Criterios y niveles de logro\nCrea una tabla con 6 a 8 criterios. Debe tener estas columnas:\n| Criterio | Excelente 4 pts | Bueno 3 pts | Básico 2 pts | Inicial 1 pt | Ponderación |\n\nIncluye criterios sobre dominio del contenido, explicación del problema ambiental, propuesta/intervención, actividad práctica, manejo de preguntas, comunicación oral, uso de evidencias/recursos, conciencia y promoción del cuidado del entorno.\n\n## Escala sugerida\nIncluye una tabla para convertir puntaje a nivel de logro.\n\n## Observaciones para el docente\nAgrega recomendaciones breves para aplicar la rúbrica en cursos desde básica a media.`
  }

  if (intent === "indicadores") {
    return `${base}\n\nTAREA ESPECÍFICA:\nGenera indicadores de evaluación observables y graduados. No hagas una planificación completa.\n\nFORMATO:\n# Indicadores de evaluación\n\n| N° | Indicador observable | Evidencia esperada | Nivel básico | Nivel intermedio | Nivel avanzado |\n|---|---|---|---|---|---|\n\nAgrega al final orientaciones de uso para el docente.`
  }

  if (intent === "guia") {
    return `${base}\n\nTAREA ESPECÍFICA:\nCrea una guía de estudio para estudiantes. No hagas una planificación completa.\n\nFORMATO:\n# Guía de estudio\n## Propósito\n## Conceptos clave\n## Actividades paso a paso\n## Preguntas de reflexión\n## Evaluación rápida\n## Recomendaciones finales`
  }

  if (intent === "tarea") {
    return `${base}\n\nTAREA ESPECÍFICA:\nDiseña una tarea para casa clara, realizable y alineada al contexto. No hagas una planificación completa.\n\nFORMATO:\n# Tarea para casa\n## Objetivo\n## Instrucciones para el estudiante\n## Materiales\n## Producto a entregar\n## Criterios de evaluación\n## Orientaciones para la familia`
  }

  if (intent === "carta") {
    return `${base}\n\nTAREA ESPECÍFICA:\nRedacta una carta o comunicado formal y cálido para apoderados.\n\nFORMATO:\n# Comunicado a apoderados\nIncluye saludo, propósito, actividad, apoyo esperado en casa, fechas/tiempos si corresponde y cierre.`
  }

  if (intent === "adaptacion") {
    return `${base}\n\nTAREA ESPECÍFICA:\nGenera adaptaciones concretas para diversidad, NEE, ritmos distintos y estudiantes aventajados.\n\nFORMATO:\n# Adaptaciones y diversificación\n## Barreras posibles\n## Apoyos visuales y concretos\n## Ajustes de instrucciones\n## Evaluación diferenciada\n## Desafíos para estudiantes aventajados`
  }

  if (intent === "interdisciplinario") {
    return `${base}\n\nTAREA ESPECÍFICA:\nDiseña una actividad o proyecto interdisciplinario.\n\nFORMATO:\n# Proyecto interdisciplinario\n## Propósito\n## Asignaturas integradas\n## Producto final\n## Etapas de trabajo\n## Evaluación\n## Recursos`
  }

  return `${base}\n\nTAREA ESPECÍFICA:\nResponde exactamente lo pedido por el docente con una propuesta pedagógica concreta y completa. Ajusta el formato al tipo de solicitud. Evita extenderte con bloques innecesarios.`
}

function buildLocalRubricFallback(params: {
  curso: string
  asignatura: string
  contexto: string
  message: string
  duracionMinutos: number
}): string {
  const tema = params.contexto || params.message
  return `# Rúbrica de evaluación — Actividad escolar

> EduAI activó un respaldo local editable para que puedas continuar trabajando sin perder tu solicitud.

## Datos generales

| Campo | Detalle |
|---|---|
| Curso | ${params.curso} |
| Asignatura / Núcleo | ${params.asignatura} |
| Tema o actividad | ${truncateForPrompt(tema, 350)} |
| Producto evaluado | Evidencia, producto, presentación o desempeño definido por el docente |
| Puntaje sugerido | 100 puntos |

## Criterios y niveles de logro

| Criterio | Excelente — 4 pts | Logrado — 3 pts | En desarrollo — 2 pts | Inicial — 1 pt | Ponderación |
|---|---|---|---|---|---|
| Comprensión del tema | Explica y aplica el contenido con profundidad y precisión. | Explica adecuadamente los aspectos centrales. | Presenta comprensión parcial o con vacíos. | Requiere apoyo para reconocer los elementos esenciales. | 20% |
| Calidad del producto o evidencia | Entrega un producto completo, pertinente, claro y bien desarrollado. | Cumple el propósito con detalles menores por mejorar. | Cumple parcialmente o presenta desarrollo insuficiente. | El producto es incompleto o no responde al propósito. | 20% |
| Proceso de trabajo | Planifica, registra avances y mejora a partir de retroalimentación. | Organiza el trabajo y registra los avances principales. | Requiere apoyo frecuente para organizarse. | Presenta escasa organización o evidencia del proceso. | 15% |
| Comunicación | Comunica ideas con claridad, argumentos y recursos pertinentes. | Comunica las ideas principales de forma comprensible. | La comunicación es parcial o poco organizada. | La comunicación no permite comprender el trabajo. | 15% |
| Colaboración y responsabilidad | Cumple su rol, coopera y aporta soluciones al equipo. | Participa responsablemente en la mayoría de las tareas. | Participa de manera irregular o necesita recordatorios. | No cumple su rol o dificulta el trabajo colaborativo. | 15% |
| Uso de recursos y seguridad | Usa materiales responsablemente y aplica medidas de seguridad. | Usa los recursos de forma adecuada con pocas observaciones. | Requiere apoyo para cuidar materiales o cumplir medidas. | Usa recursos de forma insegura o poco responsable. | 15% |

## Escala sugerida

| Puntaje total | Nivel de logro |
|---|---|
| 86 a 100 | Excelente |
| 70 a 85 | Logrado |
| 50 a 69 | En desarrollo |
| 0 a 49 | Inicial |

## Orientaciones

- Ajusta la profundidad esperada según nivel, edad y contexto.
- Comparte la rúbrica antes de comenzar para orientar el proceso.
- Complementa con autoevaluación y retroalimentación breve.
- Personaliza los criterios específicos cuando la actividad sea una feria, campaña, taller, salida o evento.`
}

function buildLocalEducadorFallback(params: {
  intent: EducadorOutputIntent
  curso: string
  asignatura: string
  contexto: string
  message: string
  tiempoPlanificacion: TiempoPlanificacion
  sesiones: number
  duracionMinutos: number
  errorMessage: string
  planningProfile?: PlanningProfile
}): string {
  if (params.intent === "rubrica") {
    return buildLocalRubricFallback(params)
  }

  const tema = params.contexto || params.message
  return `# Propuesta pedagógica — Respaldo local EduAI\n\n> EduAI activó un respaldo local editable para que puedas continuar trabajando sin perder tu solicitud.\n\n## Datos generales\n\n| Campo | Detalle |\n|---|---|\n| Curso | ${params.curso} |\n| Asignatura / Núcleo | ${params.asignatura} |\n| Horizonte | ${params.tiempoPlanificacion} |\n| Sesiones | ${params.sesiones} |\n| Duración | ${params.duracionMinutos} minutos por sesión |\n| Solicitud docente | ${truncateForPrompt(tema, 500)} |
| Tipo de planificación | ${params.planningProfile ? `${params.planningProfile.icon} ${params.planningProfile.label}` : "Propuesta pedagógica"} |\n\n## Objetivo de trabajo\n\nDesarrollar una experiencia pedagógica centrada en la solicitud del docente, promoviendo participación activa, comprensión del contenido, comunicación clara y evidencias observables de aprendizaje.\n\n## Secuencia sugerida\n\n| Momento | Acción docente | Acción de estudiantes | Evidencia |\n|---|---|---|---|\n| Inicio | Presenta el propósito, activa conocimientos previos y explica criterios de logro. | Responden preguntas iniciales y organizan roles. | Preguntas o lluvia de ideas. |\n| Desarrollo | Guía la investigación, construcción o actividad principal con apoyo y retroalimentación. | Elaboran el producto, practican, dialogan y registran evidencias. | Producto parcial, notas, recursos o presentación. |\n| Cierre | Facilita síntesis, reflexión y evaluación formativa. | Presentan avances, responden preguntas y proponen mejoras. | Ticket de salida, autoevaluación o pauta. |\n\n## Evaluación sugerida\n\n- Claridad del contenido trabajado.\n- Participación y colaboración.\n- Uso de evidencias o recursos.\n- Comunicación oral o escrita.\n- Reflexión final sobre lo aprendido.\n\n## Recomendación\n\nVuelve a presionar “Regenerar” cuando el proveedor de IA esté disponible para obtener una versión más extensa y personalizada.`
}


// ── Web search for topic ideas ────────────────────────────────────────────────
async function searchTopicIdeas(nivel: NivelKey, curso: string, asignatura: string, mes: string): Promise<string> {
  const gKey = process.env.GEMINI_API_KEY
  if (!gKey) return ""

  const nivelCtx = nivel === "parvularia"
    ? "JUNJI educacion parvularia Chile bases curriculares BCEP"
    : nivel === "media"
      ? `MINEDUC enseñanza media Chile ${curso} plan de estudios 2024 2025`
      : `MINEDUC educacion basica Chile ${curso}`

  const searchQuery = `Busca ideas y temas concretos y actuales para clases de ${asignatura} en ${curso} (${nivelCtx}) durante ${mes} en Chile.
Incluye:
- Temas del programa oficial MINEDUC${nivel === "parvularia" ? "/JUNJI" : ""}
- Efemérides y fechas relevantes del calendario escolar chileno en ${mes}
- Contexto cultural, social o medioambiental chileno actual
- Iniciativas o lineamientos educativos recientes en Chile
- Ideas de actividades prácticas y realizables en aula
Sé específico, nombra contenidos concretos del currículum y da al menos 7 ideas distintas.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tools: [{ google_search: {} }],
          contents: [{ parts: [{ text: searchQuery }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!res.ok) return ""
    const data = await res.json()
    const text = Array.isArray(data.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts
          .map((part: unknown) => typeof part === "object" && part !== null && "text" in part ? String((part as { text?: unknown }).text || "") : "")
          .join("")
      : ""
    return text.slice(0, 1800)
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
  const rawDesignTemplateId = typeof body.designTemplateId === "string" ? body.designTemplateId : cfg.designTemplateId
  const designTemplateId = typeof rawDesignTemplateId === "string" && rawDesignTemplateId.trim() ? rawDesignTemplateId.trim() : undefined
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
  let selectedOAIds = ensureArray(cfg.selectedOAIds)
  let selectedOATIds = ensureArray(cfg.selectedOATIds)
  const hasExplicitParvulariaJourneyNucleos = Array.isArray(cfg.parvulariaJourneyNucleos)
  const hasExplicitParvulariaJourneyOATIds = Array.isArray(cfg.parvulariaJourneyOATIds)
  let parvulariaJourneyNucleos = ensureParvulariaJourneyNucleos(cfg.parvulariaJourneyNucleos, asignatura)
  let parvulariaJourneyOAIds = ensureParvulariaJourneyOAIds(cfg.parvulariaJourneyOAIds)
  let parvulariaJourneyOATIds = ensureParvulariaJourneyOATIds(cfg.parvulariaJourneyOATIds)

  // ── Detect intent from message ────────────────────────────────────────────
  const messageLC = message.toLowerCase()

  // What kind of output does the docente want?
  const wantsRubrica   = messageLC.includes("rúbrica") || messageLC.includes("rubrica")
  const wantsIndicadores = messageLC.includes("indicador")
  const wantsTarea     = messageLC.includes("tarea") && (messageLC.includes("casa") || messageLC.includes("hogar"))
  const wantsGuia      = messageLC.includes("guía") || messageLC.includes("guia de estudio")
  const wantsCarta     = messageLC.includes("carta") || messageLC.includes("apoderado") || messageLC.includes("comunicado")
  const wantsAdaptacion = messageLC.includes("nee") || messageLC.includes("adaptaci")
  const wantsInter     = messageLC.includes("interdiscipli") || messageLC.includes("transversal")
  const wantsActividad = messageLC.includes("actividad") && !messageLC.includes("planif")
  const wantsEfemeride = messageLC.includes("efeméride") || messageLC.includes("fecha") || messageLC.includes("mes")
  const wantsSecuencia = messageLC.includes("secuencia") || messageLC.includes("distribuye") || messageLC.includes("semana")

  const outputIntent = getOutputIntent({
    wantsRubrica,
    wantsIndicadores,
    wantsTarea,
    wantsGuia,
    wantsCarta,
    wantsAdaptacion,
    wantsInter,
    wantsActividad,
    wantsEfemeride,
    wantsSecuencia,
  })
  const designFormat = educadorDesignFormat(outputIntent)
  const designDirective = buildDesignPromptDirective(designTemplateId, designFormat)
  const designSummary = getDesignTemplateSummary(designTemplateId, designFormat)
  const parvulariaHeterogenea = nivel === "parvularia" && cfg.parvulariaHeterogenea === true
  const parvulariaSegundoCurso = typeof cfg.parvulariaSegundoCurso === "string" && cfg.parvulariaSegundoCurso.trim()
    ? cfg.parvulariaSegundoCurso.trim()
    : ""
  const parvulariaMotivoFusion = typeof cfg.parvulariaMotivoFusion === "string" ? cfg.parvulariaMotivoFusion.trim() : ""

  const wantsIdeas = !contexto && (
    messageLC.includes("idea") || messageLC.includes("suger") ||
    messageLC.includes("qué puedo") || messageLC.includes("que puedo") ||
    messageLC.includes("no tengo tema") || messageLC.includes("no sé qué") ||
    messageLC.includes("no se que") || message.length < 45
  )
  const hasExplicitTopic = contexto.length > 15 || message.length > 50

  // Specific output instruction based on intent
  const intentInstruction = wantsRubrica
    ? "INSTRUCCIÓN: El docente pide una RÚBRICA. Genera exclusivamente una rúbrica analítica completa con criterios, descriptores y niveles de logro."
    : wantsIndicadores
      ? "INSTRUCCIÓN: El docente pide INDICADORES. Genera indicadores de evaluación detallados, observables y graduados por nivel de logro para cada OA."
      : wantsTarea
        ? "INSTRUCCIÓN: El docente pide una TAREA PARA LA CASA. Diseña una tarea significativa con instrucciones claras para el estudiante y orientaciones para el apoderado."
      : wantsGuia
        ? "INSTRUCCIÓN: El docente pide una GUÍA DE ESTUDIO. Crea una guía completa con resumen, actividades de práctica, preguntas de reflexión y recursos."
        : wantsCarta
          ? "INSTRUCCIÓN: El docente pide una CARTA A APODERADOS. Redacta una comunicación formal y cálida explicando objetivos, actividades y cómo apoyar en casa."
          : wantsAdaptacion
            ? "INSTRUCCIÓN: El docente pide ADAPTACIONES. Genera estrategias específicas para NEE, ritmos distintos y estudiantes aventajados."
            : wantsInter
              ? "INSTRUCCIÓN: El docente pide una ACTIVIDAD INTERDISCIPLINARIA. Diseña una actividad que integre esta asignatura con al menos otra área curricular."
              : ""

  // If user wants ideas → search the web for real topics
  let webTopicIdeas = ""
  if (wantsIdeas || (wantsActividad && !hasExplicitTopic)) {
    webTopicIdeas = await searchTopicIdeas(nivel, curso, asignatura, mes)
  }

  // Topic priority instruction for system prompt
  const topicInstruction = intentInstruction
    ? intentInstruction
    : hasExplicitTopic
      ? `══ EL PROYECTO O IDEA DEL DOCENTE ES EL EJE ABSOLUTO DE ESTA PLANIFICACIÓN ══

El docente describió lo que quiere trabajar:
"${contexto || message}"

CÓMO DEBES CONSTRUIR ESTA PLANIFICACIÓN:
1. EMPIEZA desde la idea/proyecto del docente — no desde el OA
2. Las actividades, metodología, tiempos y recursos deben estar diseñados para ESA idea concreta
3. Si es un proyecto STEAM, PBL, ABP o similar: la planificación SIGUE LA LÓGICA DE ESA METODOLOGÍA
4. El OA aparece como "respaldo curricular" — es el paraguas legal/formal, no la guía de las actividades
5. Los indicadores deben evaluar SI LOS ESTUDIANTES LOGRARON EL PROYECTO, no solo si "saben el OA"
6. El propósito de aprendizaje debe explicar el proyecto en sus propias palabras, su impacto, su lógica
7. Las sesiones deben mostrar el desarrollo REAL del proyecto: investigación, diseño, construcción, presentación
8. NUNCA simplifiques el proyecto a "una actividad más" — desarrolla toda su profundidad
9. Si el docente dice "STEAM + cambio climático + intervención en el colegio", la planificación debe tener exactamente eso: diseño de espacios, investigación de datos reales, impacto local/global, presentación a la comunidad
10. El OA aparece una vez en la sección de OA, y luego se menciona puntualmente — no domina el resto`
      : wantsIdeas && webTopicIdeas
        ? `El docente no tiene tema definido. Propón 6-8 temas concretos y actuales basados en esta búsqueda web:\n${webTopicIdeas}\n\nPreséntalos numerados con una breve descripción de cada uno y pregunta cuál prefiere desarrollar.`
        : webTopicIdeas
          ? `El docente pide actividades. Aquí hay ideas actuales del contexto chileno:\n${webTopicIdeas}\n\nDesarrolla la más adecuada o pregunta cuál prefiere.`
          : `El docente no indicó un tema específico. Propón 5 temas relevantes para ${asignatura} en ${curso} durante ${mes} en el contexto escolar chileno y pregunta cuál desarrollar.`


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
    cfg.tiempoPlanificacion === "diaria" ||
    cfg.tiempoPlanificacion === "semanal" ||
    cfg.tiempoPlanificacion === "quincenal" ||
    cfg.tiempoPlanificacion === "mensual" ||
    cfg.tiempoPlanificacion === "semestral" ||
    cfg.tiempoPlanificacion === "anual"
      ? cfg.tiempoPlanificacion : "diaria"

  const sesiones = clampNumber(cfg.sesiones, 1, 1, 120)
  const duracionMinutos = clampNumber(cfg.duracionMinutos, nivel === "parvularia" ? 30 : 90, 15, 300)
  const isBasicaMedia = nivel === "basica" || nivel === "media"
  const isInstitutionalMacro = isBasicaMedia && (tiempoPlanificacion === "mensual" || tiempoPlanificacion === "semestral" || tiempoPlanificacion === "anual")
  const profesor = typeof cfg.profesor === "string" ? cfg.profesor.trim() : ""
  const horasSemanales = typeof cfg.horasSemanales === "string" ? cfg.horasSemanales.trim() : ""
  const establecimiento = typeof cfg.establecimiento === "string" && cfg.establecimiento.trim() ? cfg.establecimiento.trim() : "Colegio Providencia"
  const ciudad = typeof cfg.ciudad === "string" && cfg.ciudad.trim() ? cfg.ciudad.trim() : "ANTOFAGASTA"
  const periodoId = typeof cfg.periodoId === "string" && cfg.periodoId.trim() ? cfg.periodoId.trim() : mes
  const anioPlanificacion = clampNumber(cfg.anioPlanificacion, new Date().getFullYear(), 2020, 2100)
  const weeklyOAPlan = ensureWeeklyOAPlan(cfg.weeklyOAPlan)
  const periodLabel = getSchoolPlanningPeriodLabel(tiempoPlanificacion, periodoId, mes)
  const isStructuredParvularia = nivel === "parvularia" && mode === "planificar"
  const educadoraParvularia = typeof cfg.educadoraParvularia === "string" ? cfg.educadoraParvularia.trim() : ""
  const asistentesParvularia = typeof cfg.asistentesParvularia === "string" ? cfg.asistentesParvularia.trim() : ""
  const fechaInicioParvularia = typeof cfg.fechaInicioParvularia === "string" ? cfg.fechaInicioParvularia.trim() : ""
  const fechaFinParvularia = typeof cfg.fechaFinParvularia === "string" ? cfg.fechaFinParvularia.trim() : ""
  const parvulariaFechas = buildParvulariaDateLabel(fechaInicioParvularia, fechaFinParvularia || fechaInicioParvularia)
  const parvulariaPeriodGuide = isStructuredParvularia && tiempoPlanificacion !== "anual"
    ? buildParvulariaPeriodGuide(
        fechaInicioParvularia,
        fechaFinParvularia || fechaInicioParvularia,
        tiempoPlanificacion as "diaria" | "semanal" | "quincenal" | "mensual" | "semestral"
      )
    : ""

  if (isStructuredParvularia) {
    if (!educadoraParvularia || !asistentesParvularia || !fechaInicioParvularia) {
      return NextResponse.json(
        { error: "Completa educadora de párvulos, asistentes y fecha de inicio para generar la planificación parvularia." },
        { status: 400 }
      )
    }
    if (tiempoPlanificacion !== "diaria" && !fechaFinParvularia) {
      return NextResponse.json({ error: "Completa la fecha de término del período de planificación." }, { status: 400 })
    }

    const availableNuclei = getAvailableAsignaturas("parvularia", curso)
    const availableNucleiSet = new Set(availableNuclei)
    const invalidNuclei = parvulariaJourneyNucleos.filter((nucleo) => !availableNucleiSet.has(nucleo))

    if (invalidNuclei.length) {
      return NextResponse.json(
        { error: `Hay núcleos no válidos para ${curso}: ${[...new Set(invalidNuclei)].join(", ")}.` },
        { status: 400 }
      )
    }

    parvulariaJourneyNucleos = parvulariaJourneyNucleos.slice(0, 3)
    parvulariaJourneyOAIds = parvulariaJourneyNucleos.map((nucleo, index) => {
      const available = getPlannerOAOptions({ nivel: "parvularia", curso, asignatura: nucleo })
      const validIds = new Set(available.map((item) => item.id))
      const requested = [...new Set((parvulariaJourneyOAIds[index] || []).filter((id) => validIds.has(id)))]

      if (requested.length) return requested

      // Compatibilidad con planificaciones creadas antes de incorporar núcleo por jornada.
      if (!hasExplicitParvulariaJourneyNucleos) {
        const legacy = [...new Set(selectedOAIds.filter((id) => validIds.has(id)))]
        if (legacy.length) return legacy
      }

      return []
    })

    const incompleteJourney = parvulariaJourneyOAIds.findIndex((ids) => ids.length === 0)
    if (incompleteJourney >= 0) {
      return NextResponse.json(
        { error: `Selecciona un núcleo y al menos un OA oficial para la Jornada ${incompleteJourney + 1}.` },
        { status: 400 }
      )
    }

    selectedOAIds = [...new Set(parvulariaJourneyOAIds.flat())]

    parvulariaJourneyOATIds = parvulariaJourneyNucleos.map((nucleo, index) => {
      const available = getParvulariaOAT(curso, nucleo)
      const validIds = new Set(available.map((item) => item.id))
      const requested = [...new Set((parvulariaJourneyOATIds[index] || []).filter((id) => validIds.has(id)))]

      if (hasExplicitParvulariaJourneyOATIds) return requested

      // Compatibilidad con la selección global de OAT usada antes de separar por jornada.
      return [...new Set(selectedOATIds.filter((id) => validIds.has(id)))]
    })
    selectedOATIds = [...new Set(parvulariaJourneyOATIds.flat())]
  }

  if (isInstitutionalMacro) {
    if (!profesor || !horasSemanales) {
      return NextResponse.json({ error: "Completa profesor/a y horas semanales para generar el cronograma institucional." }, { status: 400 })
    }

    const scheduleValidation = validateSchoolPlanningWeeks(weeklyOAPlan, tiempoPlanificacion, periodoId, mes)
    if (!scheduleValidation.valid) {
      return NextResponse.json({ error: scheduleValidation.error || "La distribución semanal no corresponde al período solicitado." }, { status: 400 })
    }

    const availableOA = getPlannerOAOptions({ nivel, curso, asignatura })
    const validOAIds = new Set(availableOA.map((oa) => oa.id))
    const invalidWeek = weeklyOAPlan.find((week) => !week.oaIds.length || week.oaIds.some((id) => !validOAIds.has(id)))
    if (invalidWeek) {
      return NextResponse.json({ error: `La semana ${invalidWeek.key} tiene OA vacíos o no válidos para ${curso} · ${asignatura}.` }, { status: 400 })
    }

    selectedOAIds = [...new Set([...selectedOAIds, ...weeklyOAPlan.flatMap((week) => week.oaIds)])]
  }

  const requestedPlanningProfile: PlanningProfileId = isPlanningProfileId(cfg.planningProfile) ? cfg.planningProfile : "auto"
  const planningProfile = inferPlanningProfile(`${contexto}\n${message}`, nivel, requestedPlanningProfile)
  const oaConnection = resolveOAConnection({
    state: { nivel, curso, asignatura },
    unidadId: isInstitutionalMacro ? "" : unidadId,
    selectedOAIds,
    userText: `${contexto}\n${message}`,
  })
  if (!selectedOAIds.length && oaConnection.resolvedOAIds.length) selectedOAIds = oaConnection.resolvedOAIds
  const connectedOAContext = buildConnectedOAContext(oaConnection)

  const promptContext = buildPromptContext({
    nivel, curso, asignatura, contexto, mes, unidadId,
    selectedOAIds, selectedOATIds, tiempoPlanificacion,
    sesiones, duracionMinutos, userMessage: message,
    parvulariaHeterogenea, parvulariaSegundoCurso, parvulariaMotivoFusion,
  })

  const isParv = nivel === "parvularia"
  const sessionWord = sesiones === 1 ? "1 sesion" : `${sesiones} sesiones`
  const sessionBlocks = isParv
    ? buildParvulariaSessionBlocks(sesiones, duracionMinutos, parvulariaHeterogenea)
    : buildSessionBlocks(sesiones, duracionMinutos)
  const claseObjectives = isBasicaMedia ? buildClaseObjectives(sesiones) : ""
  const weeklyOAContext = isInstitutionalMacro ? buildWeeklyOAContext({ nivel, curso, asignatura, weeklyOAPlan }) : ""

  const parvulariaKnowledge = isStructuredParvularia
    ? await buildParvulariaKnowledgeContext({
        supabase,
        userId: user.id,
        course: curso,
        topic: contexto || message,
        message,
        journeyNuclei: parvulariaJourneyNucleos,
        selectedOAIds,
        selectedOATIds,
        candidateLimit: tiempoPlanificacion === "diaria" ? 9 : 15,
      }).catch(() => null)
    : null

  const systemPrompt = `Eres APl, el Agente Planificador Curricular de EduAI, especializado en el curriculum oficial chileno del MINEDUC.

Tu mision: generar planificaciones docentes completas, rigurosas, detalladas y directamente usables en el aula chilena real.

${topicInstruction}
${buildPlanningProfilePrompt(planningProfile)}
REGLAS DE PLANIFICACION:
1. Los OA son MARCO CURRICULAR de referencia — el docente puede ir más allá si su contexto lo requiere.
2. Si el docente entregó un contexto rico (proyecto, idea, metodología), ESO es el eje. Los OA lo respaldan.
3. Si el docente NO entregó contexto propio, los OA son el eje principal.
4. Si hay OA seleccionados, menciónales en la planificación — no los ignores, pero tampoco los conviertas en una jaula.
5. En Parvularia integra siempre: subnivel, ámbito, núcleo, OA y OAT disponibles.
6. En Parvularia evita una estructura escolarizada: prioriza juego, exploración, vínculo, rutinas, bienestar, mediación breve, observación y registro cualitativo.
7. Si es grupo heterogéneo o niveles unidos, separa el Desarrollo en bloques completos por edad/subnivel, con actividades distintas, materiales, complejidad, lenguaje esperado, rol adulto, apoyos NEE, seguridad y evidencias diferenciadas.
8. NUNCA cortes la respuesta. SIEMPRE completa TODOS los bloques del formato.
7. Los indicadores deben reflejar tanto el OA como el contexto real descrito por el docente.
8. Los objetivos de clase deben ser concretos, útiles en el aula real y coherentes con la propuesta del docente.
9. Escribe en español formal, claro y pedagógico.
10. La planificación debe poder usarse directamente en el aula — que sea práctica, no solo teórica.
11. Si el docente describe un proyecto o metodología específica (STEAM, PBL, ABP, etc.), adáptala — no la ignores.

${contexto ? `═══════════════════════════════════════════════
PROYECTO / CONTEXTO DEL DOCENTE — LEER PRIMERO
═══════════════════════════════════════════════
${contexto}
═══════════════════════════════════════════════
` : ""}

CONTEXTO CURRICULAR (MARCO DE REFERENCIA):
Nivel: ${nivel}
Curso/Subnivel: ${curso}
Asignatura/Nucleo: ${asignatura}
${isParv ? `Contexto del subnivel: ${promptContext.stageContext}` : ""}
${isParv && promptContext.heteroContext ? promptContext.heteroContext : ""}
Referencia curricular: ${NIVEL_INFO[nivel]}
Cobertura local: ${promptContext.localCoverage}
${promptContext.unitContext || "Sin unidad o modulo local seleccionado."}
OA como referencia curricular (no como restricción):
${promptContext.oaContext || "Sin OA locales — planifica centrado en el contexto del docente."}

${connectedOAContext}
${isParv && promptContext.ambito ? `Ambito de experiencia: ${promptContext.ambito}` : ""}
${isParv && promptContext.oatContext ? promptContext.oatContext : ""}

CONTEXTO TEMPORAL:
Mes: ${mes} - ${promptContext.seasonText || "sin referencia estacional especifica"}
Horizonte: ${tiempoPlanificacion} - ${sessionWord} - ${duracionMinutos} min c/u
${promptContext.horizonText}
Cobertura detectada: ${promptContext.summary.units} unidades - ${promptContext.summary.oas} OA locales - ${promptContext.selectedCount} OA seleccionados

FORMATO OBLIGATORIO - COMPLETAR TODOS LOS BLOQUES SIN EXCEPCION:

${(contexto && contexto.length > 40) ? `NOTA ESPECIAL PARA EL FORMATO:
Como el docente entregó un contexto propio rico, ajusta el formato así:
- En "Datos generales": incluye una fila "Proyecto / Metodología" con el nombre del proyecto
- En "Propósito": explica el PROYECTO en profundidad (qué es, para qué, impacto esperado), luego menciona los OA como respaldo
- En "Planificación de clases": las actividades siguen la lógica del proyecto, no la lógica del OA
- En "Evaluación": los criterios evalúan el resultado del proyecto, no solo el conocimiento declarativo
- En "Observaciones": incluye recomendaciones específicas para implementar ESE proyecto en el aula real
` : ""}

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
| Tipo de planificación | ${planningProfile.icon} ${planningProfile.label} |

---

## Objetivo(s) de Aprendizaje

${isParv ? `**Subnivel base:** ${curso}
${parvulariaHeterogenea && parvulariaSegundoCurso ? `**Subnivel/rango integrado:** ${parvulariaSegundoCurso}` : ""}
**Ámbito:** (según contexto curricular)
**Núcleo:** ${asignatura}
**OA oficial:** (texto oficial completo del OA o de cada OA seleccionado)
**OAT seleccionados:** (listar OAT o indicar "Sin OAT seleccionado")` : `- **OA [codigo]:** (texto oficial completo)
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

${isParv ? `---

## Organización del ambiente y rol del equipo

| Elemento | Orientación concreta |
|---|---|
| Ambiente | (espacios, estaciones, seguridad, tránsito, materiales al alcance) |
| Rol educadora | (mediación, preguntas breves, observación, contención, lenguaje) |
| Rol técnico/asistente | (apoyo individual, seguridad, registro, preparación de materiales) |
| Participación familiar | (sugerencia breve para continuidad en hogar) |

${parvulariaHeterogenea ? `---

## Adecuación para grupo heterogéneo

| Dimensión | ${curso} | ${parvulariaSegundoCurso || "Segundo rango"} |
|---|---|---|
| Participación esperada | (observable según edad) | (observable según edad) |
| Materiales | (materiales seguros y simples) | (materiales con mayor complejidad) |
| Mediación adulta | (apoyo más cercano) | (mayor autonomía guiada) |
| Tiempo de atención | (micro momentos) | (bloques un poco más extensos) |
| Evidencia de aprendizaje | (gestos, mirada, vocalización, exploración) | (acciones, palabras, imitación, elección, interacción) |
| Apoyos NEE | (ajuste concreto) | (ajuste concreto) |` : ""}
` : ""}
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
- Sala Cuna: sin estructuras escolarizadas, experiencias sensoriales, breves y centradas en vínculo
- Parvularia heterogénea: siempre incluye adecuaciones por edad/rango, seguridad, materiales diferenciados y registro cualitativo`.trim()

  const parvulariaOAByJourney = isStructuredParvularia
    ? parvulariaJourneyNucleos.map((nucleo, index) => {
        const ids = new Set(parvulariaJourneyOAIds[index] || [])
        return getPlannerOAOptions({ nivel: "parvularia", curso, asignatura: nucleo })
          .filter((oa) => ids.has(oa.id))
      })
    : [[], [], []]
  const parvulariaOATByJourney = isStructuredParvularia
    ? parvulariaJourneyNucleos.map((nucleo, index) => {
        const ids = new Set(parvulariaJourneyOATIds[index] || [])
        return getParvulariaOAT(curso, nucleo).filter((oat) => ids.has(oat.id))
      })
    : [[], [], []]
  const parvulariaSelectedOA = isStructuredParvularia
    ? [...new Map(parvulariaOAByJourney.flat().map((oa) => [oa.id, oa])).values()]
    : []
  const parvulariaSelectedOAT = isStructuredParvularia
    ? [...new Map(parvulariaOATByJourney.flat().map((oat) => [oat.id, oat])).values()]
    : []
  const parvulariaJourneyOAContext = isStructuredParvularia
    ? parvulariaOAByJourney.map((oas, index) => {
        const label = [
          "Jornada 1 · Exploración y experiencia principal",
          "Jornada 2 · Expresión artística y sensorial",
          "Jornada 3 · Lenguaje verbal, lectura y comunicación",
        ][index]
        const nucleo = parvulariaJourneyNucleos[index] || asignatura
        const ambito = getParvulariaAmbito(curso, nucleo) || "Ámbito no informado"
        const oats = parvulariaOATByJourney[index] || []
        const oatGroups = [...new Set(oats.map((oat) => oat.nucleo || "Núcleo transversal"))]
        return [
          label,
          `- Ámbito: ${ambito}`,
          `- Núcleo principal: ${nucleo}`,
          ...oas.map((oa) => `- OA: ${oa.codigoOficial || oa.id}: ${oa.texto}`),
          ...oatGroups.flatMap((oatNucleo) => [
            `- OAT · Núcleo transversal: ${oatNucleo}`,
            ...oats.filter((oat) => (oat.nucleo || "Núcleo transversal") === oatNucleo)
              .map((oat) => `  - ${oat.description || oat.id}: ${oat.label}`),
          ]),
        ].join("\n")
      }).join("\n\n")
    : ""
  const parvulariaCurriculumContext = isStructuredParvularia
    ? [
        ...parvulariaSelectedOA.map((oa) =>
          `${oa.codigoOficial || oa.id}: ${oa.texto} | Objetivo principal | Ámbito: ${oa.ambito || "No informado"} | Núcleo: ${oa.nucleo || "No informado"}`
        ),
        ...parvulariaSelectedOAT.map((oat) => `${oat.description || oat.id}: ${oat.label} | OAT complementario | Ámbito: ${oat.ambito || "Desarrollo personal y social"} | Núcleo: ${oat.nucleo || "No informado"}`),
      ].join("\n")
    : ""

  const parvulariaRequiredDateLabels = (tiempoPlanificacion === "semanal" || tiempoPlanificacion === "quincenal")
    ? parvulariaPeriodGuide
        .split("\n")
        .filter((line) => /^\d+\.\s/.test(line))
        .map((line) => line.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean)
    : []

  const parvulariaAgeGroups = isStructuredParvularia && parvulariaHeterogenea && parvulariaSegundoCurso
    ? [
        { curso, heading: getParvulariaAgeHeading(curso), stage: inferParvulariaStage(curso) },
        { curso: parvulariaSegundoCurso, heading: getParvulariaAgeHeading(parvulariaSegundoCurso), stage: inferParvulariaStage(parvulariaSegundoCurso) },
      ]
    : []
  const parvulariaHeterogeneousDevelopmentContext = parvulariaAgeGroups.length === 2
    ? [
        "DESARROLLO HETEROGÉNEO OBLIGATORIO — REPRODUCIR LA LÓGICA DEL FORMATO INSTITUCIONAL:",
        ...parvulariaAgeGroups.map((group, index) => `- Bloque ${index + 1}: "${group.heading}" (${group.curso}). ${group.stage}`),
        "- Dentro de CADA jornada, después de Desarrollo:, escribe primero el bloque completo del primer rango y luego el bloque completo del segundo rango.",
        "- En semanal y quincenal, TODAS las fechas hábiles deben aparecer dentro de CADA bloque de edad; la misma fecha tiene una actividad diferente para cada rango.",
        "- No escribas una actividad común seguida de 'adaptación para menores/mayores'. Son dos secuencias de actividades diferenciadas.",
        "- Diferencia acción, autonomía, desplazamiento, lenguaje, complejidad del material, mediación adulta y evidencia observable según desarrollo.",
        "- Inicio y Finalización pueden ser comunes a ambos grupos; la diferenciación obligatoria ocurre dentro de Desarrollo.",
      ].join("\n")
    : ""

  const parvulariaSystemPrompt = isStructuredParvularia ? `Eres APl, Agente Planificador Curricular de EduAI especializado en Educación Parvularia de Chile.

Debes generar una planificación que replique la organización de la plantilla institucional de referencia, SIN logos ni marca de agua. La planificación no se organiza por horas pedagógicas ni por minutos: en Educación Parvularia las experiencias se distribuyen según la jornada, el ritmo del grupo y el horizonte elegido.

DATOS FIJOS DEL DOCUMENTO:
- Título: Planificación ${parvulariaHorizonLabel(tiempoPlanificacion as "diaria" | "semanal" | "quincenal" | "mensual" | "semestral")} ${anioPlanificacion}
- Nivel Educativo: ${parvulariaHeterogenea ? `${curso} y ${parvulariaSegundoCurso}` : curso}
- Fechas: ${parvulariaFechas}
- Educadora de Párvulos: ${educadoraParvularia}
- Asistentes de Párvulos: ${asistentesParvularia}
- Horizonte: ${tiempoPlanificacion}
- Núcleos seleccionados por jornada: ${parvulariaJourneyNucleos.map((nucleo, index) => `J${index + 1}: ${nucleo}`).join(" | ")}
- Ámbitos por jornada: ${parvulariaJourneyNucleos.map((nucleo, index) => `J${index + 1}: ${getParvulariaAmbito(curso, nucleo) || "Determinar desde las BCEP"}`).join(" | ")}
- Contexto entregado por el usuario: ${contexto || "Sin contexto adicional"}

BASE CURRICULAR SELECCIONADA. USA ESTOS OA/OAT Y NO INVENTES CÓDIGOS:
${parvulariaCurriculumContext || "No se recuperó contexto curricular; mantén estrictamente los objetivos incluidos en la solicitud del usuario."}

ASIGNACIÓN OBLIGATORIA DE ÁMBITO, NÚCLEO, OA Y OAT POR JORNADA:
${parvulariaJourneyOAContext || "Cada jornada usa el ámbito, núcleo, OA y OAT seleccionados."}

REGLA DE ASIGNACIÓN:
- En "ambitoNucleo" de cada fila escribe el ÁMBITO y NÚCLEO principal exactos asignados a esa jornada y, debajo, los núcleos transversales de los OAT elegidos para ESA jornada.
- En "objetivosAprendizajes" de cada fila escribe SOLO los OA y OAT asignados a esa jornada.
- Los OAT deben mantenerse separados por su núcleo transversal; no los presentes como si pertenecieran al núcleo principal.
- No copies automáticamente el mismo núcleo, OA u OAT en las tres filas.
- Un núcleo, OA u OAT puede repetirse en más de una jornada únicamente si el docente lo asignó expresamente.
- Respeta esta distribución en diaria, semanal, quincenal, mensual y semestral.

DISTRIBUCIÓN TEMPORAL OBLIGATORIA:
${parvulariaPeriodGuide || "Desarrolla experiencias coherentes con el período seleccionado."}

${parvulariaHeterogeneousDevelopmentContext ? `${parvulariaHeterogeneousDevelopmentContext}\n` : ""}

${parvulariaKnowledge?.prompt || ""}

CRITERIOS BCEP 2018 OFICIALES PARA CONSTRUIR LA EXPERIENCIA:
${JSON.stringify({
  principios: bcepReference.principios_pedagogicos,
  planificacion: bcepReference.planificacion,
  evaluacion: bcepReference.evaluacion,
  ambientesAprendizaje: bcepReference.ambientes_aprendizaje,
  familiaComunidad: bcepReference.familia_y_comunidad,
})}

Aplica estos criterios como fundamento pedagógico. No los copies como secciones nuevas: deben verse reflejados en las actividades, orientaciones, roles, recursos y evaluación.

REFERENCIA INSTITUCIONAL QUE DEBES REPLICAR EN CONTENIDO Y ORGANIZACIÓN:
- El encabezado debe quedar completamente rellenado.
- El bloque inicial contiene exactamente: Objetivo de aprendizaje; Principio de Juego; Principio de actividad; Foco de experiencia.
- La tabla principal contiene exactamente siete columnas: Ámbito/Núcleo; Objetivos de Aprendizajes; Experiencia de aprendizaje; Orientaciones Relevantes; Rol del equipo pedagógico y rol de la familia; Recursos; Evaluación.
- El archivo de referencia desarrolla Experiencia de aprendizaje con Inicio, Desarrollo, experiencias concretas por fecha/rango y Finalización.
- Cuando hay dos niveles/subniveles unidos, el Desarrollo se divide en DOS bloques explícitos por edad/subnivel. Para Sala Cuna usa "Edades 06 meses a 12 meses" y "Edades 1 año a 2 años" cuando corresponda; para otros niveles usa el rango de edad respectivo.
- Inicio debe reunir/motivar al grupo, presentar recursos y activar exploración o juego.
- Desarrollo debe contener ACTIVIDADES REALES, distintas, detalladas y ejecutables: qué harán los párvulos, qué manipularán/observarán/escucharán, cómo interviene el adulto y qué se espera observar. No escribas solo títulos.
- ESTÁNDAR DE PROFUNDIDAD PARA CADA ACTIVIDAD, EN TODOS LOS HORIZONTES: cada actividad diaria, semanal, quincenal, mensual o semestral debe redactarse como una oración pedagógica completa y breve, no como un nombre de actividad. Apunta a aproximadamente 100-180 caracteres de contenido por actividad, sin contar fecha, viñeta o rótulo de semana.
- Cada actividad debe combinar al menos: acción concreta de los párvulos + material/estímulo/espacio + forma de exploración, interacción o mediación + habilidad, respuesta observable o propósito inmediato. No es necesario convertirla en un párrafo.
- Si hay dos niveles/subniveles, NO redactes una única experiencia central con adecuaciones breves. Cada bloque de edad debe contener sus propias actividades completas por fecha o tramo, con diferencias reales de complejidad y mediación.
- Finalización debe considerar ordenar/guardar materiales, socializar mediante lenguaje, gestos, sonidos o producciones, y reforzar positivamente la participación.
- Orientaciones Relevantes debe incluir, según pertinencia: preparar material con anticipación; ambiente fresco e iluminado; uso de distintos espacios educativos; vestimenta cómoda; material suficiente para libre exploración; tiempo flexible; seguridad y bienestar.
- Rol del equipo pedagógico debe permitir libre acercamiento y desplazamiento, mediar cuando el párvulo lo requiere y evitar sobreintervenir, respetando interés, curiosidad y exploración.
- Rol de la familia debe indicar apoyo con materiales/continuidad del aprendizaje y comunicación con el equipo.
- Recursos debe separar "RECURSOS TANGIBLES" y "RECURSOS INTANGIBLES"; incluye voz del equipo y expresión gestual cuando corresponda.
- Evaluación debe quedar completa: "Instrumento: Escala de apreciación", Logrado: 3, Medianamente logrado: 2, Por lograr: 1, No observado: 0; Registro de Observación; registro fotográfico cuando sea pertinente; e Indicadores observables alineados a cada objetivo.
- Usa la referencia como estándar de profundidad: una planificación semanal o quincenal no puede devolver una tabla vacía ni una frase genérica por columna.
- El archivo de referencia contiene DOS bloques completos de planificación dentro de la misma tabla: uno centrado en Exploración del Entorno Natural + Corporalidad y Movimiento, y otro en Lenguajes Artísticos + Identidad y Autonomía. En EduAI se amplía deliberadamente a TRES jornadas pedagógicas diarias manteniendo la misma estructura de siete columnas.
- Debes generar EXACTAMENTE TRES filas/jornadas:
  1) "Jornada 1 · Exploración y experiencia principal": experiencia activa, corporal, natural, científica o manipulativa, siempre alineada a los OA seleccionados.
  2) "Jornada 2 · Expresión artística y sensorial": experiencia de expresión, arte, música, movimiento, color, textura o creación, integrada a los OA seleccionados.
  3) "Jornada 3 · Lenguaje verbal, lectura y comunicación": experiencia de oralidad, conversación, relato, lectura compartida/dialogada, canciones, vocabulario, gestos comunicativos o escucha, adaptada al nivel y alineada a los OA seleccionados.
- Las tres jornadas son planificaciones distintas dentro del mismo documento. No las mezcles en una sola fila.
- No inventes un OA de Lenguaje Verbal solo por el nombre de la tercera jornada: si ese núcleo no fue seleccionado, utiliza estrategias de lenguaje y comunicación como mediación pedagógica manteniendo los OA oficiales elegidos.

ESTRUCTURA PEDAGÓGICA OBLIGATORIA:
1. Debes completar los cuatro campos iniciales: objetivo de aprendizaje integrado, principio de juego, principio de actividad y foco de experiencia.
2. Después debes construir la tabla institucional de SIETE columnas: Ámbito/Núcleo; Objetivos de Aprendizajes; Experiencia de aprendizaje; Orientaciones Relevantes; Rol del equipo pedagógico y rol de la familia; Recursos; Evaluación.
3. En Ámbito/Núcleo identifica explícitamente AMBITO y NUCLEO. Si corresponde, incorpora además el ámbito/núcleo transversal asociado al OAT.
4. En Objetivos de Aprendizajes copia el código y texto de cada OA seleccionado y los OAT seleccionados. No reformules el texto oficial como si fuera literal.
5. En Experiencia de aprendizaje usa Inicio, Desarrollo y Finalización. Dentro del desarrollo organiza experiencias concretas según el período. Incluye fechas o tramos del período cuando corresponda.
6. Para niveles heterogéneos, el Desarrollo debe contener dos bloques separados por edad/subnivel. Cada bloque debe tener actividades completas y distintas. En semanal/quincenal, cada bloque repite todas las fechas hábiles con una actividad específica para ese rango.
7. Orientaciones Relevantes debe cubrir preparación, ambiente, seguridad, vestimenta, disponibilidad de materiales, tiempos flexibles, espacios educativos y observación del bienestar.
8. Rol del equipo pedagógico y rol de la familia debe distinguir ambos roles explícitamente.
9. Recursos debe distinguir RECURSOS TANGIBLES y RECURSOS INTANGIBLES.
10. Evaluación debe incluir instrumento, escala o criterios cuando sean pertinentes, registros de observación, registro fotográfico si aplica e indicadores observables alineados a los OA.
11. Mantén lenguaje lúdico, experiencial, afectivo, no escolarizado y coherente con BCEP.
12. No uses horas pedagógicas, minutos por sesión, cronogramas por bloques horarios ni cantidad de clases.
13. Para horizonte diaria genera la experiencia del día; semanal organiza la semana; quincenal organiza dos semanas; mensual organiza por semanas del mes; semestral organiza progresión mensual/semanal sin intentar detallar cada minuto de cada jornada.
14. La planificación debe ser utilizable directamente y suficientemente detallada, sin texto genérico de relleno.
15. LA CALIDAD DE REDACCIÓN SE APLICA A TODAS LAS ACTIVIDADES, SIN EXCEPCIÓN POR HORIZONTE. Cada actividad del Desarrollo debe ser una frase completa, concreta y ejecutable de aproximadamente 100-180 caracteres de contenido. Evita frases nominales como "Circuito de cojines para gateo", "Exploración de texturas" o "Lectura de cuento" sin explicar qué harán los párvulos, con qué y para qué.
16. En diaria debes entregar tres experiencias distintas para el mismo día, una por jornada. En semanal y quincenal, CADA una de las tres jornadas debe contener una actividad diferente para CADA día hábil indicado en la guía temporal. Esto significa 3 actividades por día. En mensual, conserva las tres jornadas y organiza semanas con experiencias concretas; en semestral, conserva las tres jornadas con progresión mensual/semanal.
17. "Experiencia de aprendizaje" debe contener obligatoriamente los literales Inicio:, Desarrollo: y Finalización: en cada una de las tres jornadas.
18. Nunca devuelvas campos vacíos. Si falta una idea del docente, CONSTRÚYELA a partir de los objetivos oficiales seleccionados, la edad, el núcleo y el contexto.
19. No copies actividades del archivo de referencia como plantilla fija: construye nuevas actividades coherentes con los OA/OAT seleccionados, manteniendo su nivel de detalle y su organización.
20. Las tres jornadas no pueden repetir la misma actividad cambiando solo palabras: deben diferenciar propósito inmediato, recursos, mediación y acciones de los párvulos.
21. La Jornada 3 debe incluir una mediación explícita de lenguaje/comunicación apropiada al nivel (oralidad, relato, lectura compartida, canciones, vocabulario, balbuceo/gestos o conversación), sin escolarizar la experiencia.
22. Respeta estrictamente la ASIGNACIÓN OBLIGATORIA DE ÁMBITO, NÚCLEO, OA Y OAT POR JORNADA. Cada fila debe usar su ámbito/núcleo principal exacto, separar los núcleos transversales de sus OAT y contener únicamente los OA/OAT asignados a esa jornada.
23. Si parvulariaHeterogenea está activa, las TRES jornadas deben contener ambos bloques de edad/subnivel dentro de Desarrollo. No basta con mencionar los niveles en el encabezado ni con una adaptación al final.

SALIDA OBLIGATORIA:
Responde SOLO JSON válido, sin markdown, sin comentarios y sin texto antes o después. Usa exactamente esta forma:
{
  "version": 1,
  "tipo": "parvularia_institucional",
  "titulo": "Planificación ...",
  "nivelEducativo": "...",
  "fechas": "...",
  "educadoraParvulos": "...",
  "asistentesParvulos": "...",
  "objetivoAprendizaje": "...",
  "principioJuego": "...",
  "principioActividad": "...",
  "focoExperiencia": "...",
  "horizonte": "${tiempoPlanificacion}",
  "filas": [
    {
      "jornada": "Jornada 1 · Exploración y experiencia principal",
      "ambitoNucleo": "...",
      "objetivosAprendizajes": "...",
      "experienciaAprendizaje": "...",
      "orientacionesRelevantes": "...",
      "rolEquipoFamilia": "...",
      "recursos": "...",
      "evaluacion": "..."
    },
    {
      "jornada": "Jornada 2 · Expresión artística y sensorial",
      "ambitoNucleo": "...",
      "objetivosAprendizajes": "...",
      "experienciaAprendizaje": "...",
      "orientacionesRelevantes": "...",
      "rolEquipoFamilia": "...",
      "recursos": "...",
      "evaluacion": "..."
    },
    {
      "jornada": "Jornada 3 · Lenguaje verbal, lectura y comunicación",
      "ambitoNucleo": "...",
      "objetivosAprendizajes": "...",
      "experienciaAprendizaje": "...",
      "orientacionesRelevantes": "...",
      "rolEquipoFamilia": "...",
      "recursos": "...",
      "evaluacion": "..."
    }
  ]
}

Usa saltos de línea dentro de los strings para separar subtítulos y listas. Debes generar EXACTAMENTE tres filas, en este orden, una por cada jornada pedagógica diaria. Todo el texto que aparezca en la plantilla debe quedar dentro de estos campos para que luego pueda editarse celda por celda.` : ""

  const institutionalSystemPrompt = isInstitutionalMacro ? `Eres APl, Agente Planificador Curricular de EduAI para Educación Básica y Media de Chile.

Debes generar UN CRONOGRAMA INSTITUCIONAL que replique el formato entregado por el Colegio Providencia.

DATOS FIJOS:
- Establecimiento: ${establecimiento}
- Ciudad: ${ciudad}
- Año: ${anioPlanificacion}
- Periodo: ${periodLabel}
- Profesor/a: ${profesor}
- Asignatura: ${asignatura}
- Curso: ${curso}
- Horas semanales: ${horasSemanales}
- Tipo de planificación seleccionado: ${planningProfile.label}
- Contexto adicional del docente: ${contexto || "Sin contexto adicional"}

ENFOQUE PEDAGÓGICO SELECCIONADO:
${planningProfile.directive}
Integra este enfoque dentro de la progresión semanal, especialmente en "OBJETIVO DE LA CLASE", sin crear secciones adicionales fuera de la tabla institucional.

DISTRIBUCIÓN SEMANAL OBLIGATORIA DE OA:
${weeklyOAContext}

REGLAS CURRICULARES:
1. Usa exclusivamente los OA de la distribución semanal. No inventes códigos ni cambies el texto oficial.
2. Cada semana debe contener TODOS los OA que el docente asignó a esa semana.
3. Si el OA trae indicadores curriculares en el contexto, priorízalos. Si no los trae, redacta indicadores pedagógicos observables y medibles, alineados estrictamente al OA; no los presentes como citas oficiales de MINEDUC.
4. Redacta entre 3 y 6 indicadores útiles por semana, según la complejidad de los OA.
5. En "OBJETIVO DE LA CLASE" redacta objetivos concretos y las actividades centrales que permiten lograr esos OA, como en el formato institucional de referencia. Usa entre 2 y 5 acciones por semana.
6. Mantén progresión pedagógica entre semanas y evita repetir literalmente indicadores u objetivos si la progresión exige profundización.
7. Respeta el tipo de planificación seleccionado (clase, ABP/STEAM, feria, taller, campaña, salida, etc.) y distribuye sus etapas o hitos en las semanas pertinentes, siempre dentro de las cuatro columnas institucionales.
8. No uses estructura inicio-desarrollo-cierre, minutos, rúbricas, recursos, adaptaciones, conclusiones ni secciones adicionales.
9. No agregues ni quites semanas. Respeta exactamente el orden de la distribución entregada.
10. No uses el carácter "|" dentro de una celda. Separa elementos internos únicamente con <br>.
11. Entrega la respuesta completa aunque sea extensa.

FORMATO DE SALIDA OBLIGATORIO:
# CRONOGRAMA ${anioPlanificacion}
## ${periodLabel}

| SEMANA / FECHA | OA | INDICADORES DE EVALUACIÓN | OBJETIVO DE LA CLASE |
|---|---|---|---|
[una fila por cada semana de la distribución, en el mismo orden]

REGLAS DE LAS CELDAS:
- SEMANA / FECHA: escribe "Marzo<br>1" en la primera semana del mes y solo "2", "3", "4" en las siguientes semanas del mismo mes.
- OA: código oficial + texto completo del OA. Si hay más de uno, sepáralos con <br><br>.
- INDICADORES DE EVALUACIÓN: cada indicador inicia con "• " y se separa con <br>.
- OBJETIVO DE LA CLASE: cada objetivo o actividad inicia con "• " y se separa con <br>.
- Después de la tabla escribe una sola línea: "Base curricular utilizada: ${asignatura} ${curso}, Currículum Nacional MINEDUC. Planificación organizada para ${periodLabel.toLowerCase()} con los OA seleccionados."
- No escribas texto antes del título ni después de la línea de base curricular.` : ""

  const useCompactResourcePrompt = outputIntent !== "planificacion"
  const selectedUnitForPrompt = getPlannerUnits({ nivel, curso, asignatura })
    .find((unit) => unit.id === unidadId)

  const activeSystemPromptBase = isStructuredParvularia
    ? parvulariaSystemPrompt
    : isInstitutionalMacro
      ? institutionalSystemPrompt
      : useCompactResourcePrompt
      ? buildCompactEducadorSystemPrompt({
        intent: outputIntent,
        nivel,
        curso,
        asignatura,
        mes,
        contexto: contexto || message,
        unidadLabel: selectedUnitForPrompt?.label || "",
        tiempoPlanificacion,
        sesiones,
        duracionMinutos,
        promptContext,
      })
      : systemPrompt

  const activeSystemPrompt = isStructuredParvularia || isInstitutionalMacro
    ? activeSystemPromptBase
    : useCompactResourcePrompt
      ? `${activeSystemPromptBase}${buildPlanningProfilePrompt(planningProfile)}\n${connectedOAContext}${designDirective}`
      : `${activeSystemPromptBase}${designDirective}`

  const historyLimit = useCompactResourcePrompt || message.length > 700 ? 2 : 8
  const aiMessages = [
    { role: "system" as const, content: activeSystemPrompt },
    ...history.slice(-historyLimit).filter(isChatHistoryItem).map((msg: ChatHistoryItem) => ({
      role: msg.role,
      content: truncateForPrompt(msg.content, msg.role === "assistant" ? 1200 : 1600),
    })),
    { role: "user" as const, content: message },
  ]

  try {
    const basePlanningStrategy = getEducadorModelStrategy(
      sesiones > 1 || selectedOAIds.length > 1 || isInstitutionalMacro
        ? "planning_full"
        : "planning_short"
    )
    const strategy = isStructuredParvularia
      ? {
          ...basePlanningStrategy,
          maxTokens: tiempoPlanificacion === "semestral" ? 16000 : tiempoPlanificacion === "mensual" ? 16000 : tiempoPlanificacion === "quincenal" ? 14000 : tiempoPlanificacion === "semanal" ? 10000 : 7000,
        }
      : isInstitutionalMacro
      ? {
          ...basePlanningStrategy,
          maxTokens: tiempoPlanificacion === "anual" ? 15000 : tiempoPlanificacion === "semestral" ? 12000 : 8000,
        }
      : useCompactResourcePrompt
        ? {
            maxTokens: outputIntent === "rubrica" ? 4200 : 3400,
            preferProvider: "groq" as const,
            openrouterModel: "openai/gpt-4o-mini",
          }
        : basePlanningStrategy

    let result = await callAI(aiMessages, {
      maxTokens: strategy.maxTokens,
      preferProvider: strategy.preferProvider,
      openrouterModel: strategy.openrouterModel,
    })

    let noveltyAudit: ReturnType<typeof evaluateParvulariaNovelty> | null = null

    if (isStructuredParvularia) {
      const canonicalize = (rawText: string) => {
        const parsed = parseParvulariaPlanningDocument(rawText)
        const fixed = {
          ...parsed,
          titulo: `Planificación ${parvulariaHorizonLabel(tiempoPlanificacion as "diaria" | "semanal" | "quincenal" | "mensual" | "semestral")} ${anioPlanificacion}`,
          nivelEducativo: parvulariaHeterogenea ? `${curso} y ${parvulariaSegundoCurso}` : curso,
          fechas: parvulariaFechas,
          educadoraParvulos: educadoraParvularia,
          asistentesParvulos: asistentesParvularia,
          horizonte: tiempoPlanificacion as "diaria" | "semanal" | "quincenal" | "mensual" | "semestral",
          filas: parsed.filas.map((row, index) => {
            const nucleo = parvulariaJourneyNucleos[index] || asignatura
            const ambito = getParvulariaAmbito(curso, nucleo) || "Ámbito no informado"
            const complementaryScope = (parvulariaOATByJourney[index] || []).map((oat) =>
              `OAT COMPLEMENTARIO · AMBITO: ${oat.ambito || "Desarrollo personal y social"} · NUCLEO: ${oat.nucleo || "No informado"}`
            )
            return {
              ...row,
              jornada: [
                "Jornada 1 · Exploración y experiencia principal",
                "Jornada 2 · Expresión artística y sensorial",
                "Jornada 3 · Lenguaje verbal, lectura y comunicación",
              ][index] || row.jornada || `Jornada ${index + 1}`,
              ambitoNucleo: [
                `AMBITO: ${ambito}`,
                `NUCLEO: ${nucleo}`,
                ...complementaryScope,
              ].join("\n"),
            }
          }),
        }
        const oaBody = fixed.filas.map((row) => row.objetivosAprendizajes).join("\n").toLowerCase()
        const missingOA = parvulariaSelectedOA.filter((oa) => {
          const code = (oa.codigoOficial || oa.id).toLowerCase()
          return code && !oaBody.includes(code)
        })
        const journeyOAIssues = fixed.filas.flatMap((row, index) => {
          const rowBody = row.objetivosAprendizajes.toLowerCase()
          const assigned = parvulariaOAByJourney[index] || []
          const assignedIds = new Set(assigned.map((oa) => oa.id))
          const missing = assigned
            .filter((oa) => {
              const code = (oa.codigoOficial || oa.id).toLowerCase()
              return code && !rowBody.includes(code)
            })
            .map((oa) => `Jornada ${index + 1}: falta ${oa.codigoOficial || oa.id}`)
          const unexpected = parvulariaSelectedOA
            .filter((oa) => !assignedIds.has(oa.id))
            .filter((oa) => {
              const code = (oa.codigoOficial || oa.id).toLowerCase()
              return code && rowBody.includes(code)
            })
            .map((oa) => `Jornada ${index + 1}: OA no asignado ${oa.codigoOficial || oa.id}`)
          return [...missing, ...unexpected]
        })
        const journeyOATIssues = fixed.filas.flatMap((row, index) => {
          const rowBody = row.objetivosAprendizajes.toLowerCase()
          const assigned = parvulariaOATByJourney[index] || []
          const assignedIds = new Set(assigned.map((oat) => oat.id))
          const missing = assigned
            .filter((oat) => {
              const code = (oat.description || oat.id).toLowerCase()
              return code && !rowBody.includes(code)
            })
            .map((oat) => `Jornada ${index + 1}: falta OAT ${oat.description || oat.id}`)
          const unexpected = parvulariaSelectedOAT
            .filter((oat) => !assignedIds.has(oat.id))
            .filter((oat) => {
              const code = (oat.description || oat.id).toLowerCase()
              return code && rowBody.includes(code)
            })
            .map((oat) => `Jornada ${index + 1}: OAT no asignado ${oat.description || oat.id}`)
          return [...missing, ...unexpected]
        })
        const incompleteRow = fixed.filas.find((row) =>
          !row.jornada.trim() ||
          !row.ambitoNucleo.trim() ||
          !row.objetivosAprendizajes.trim() ||
          !row.experienciaAprendizaje.trim() ||
          !row.orientacionesRelevantes.trim() ||
          !row.rolEquipoFamilia.trim() ||
          !row.recursos.trim() ||
          !row.evaluacion.trim() ||
          !/inicio\s*:/i.test(row.experienciaAprendizaje) ||
          !/desarrollo\s*:/i.test(row.experienciaAprendizaje) ||
          !/finalizaci[oó]n\s*:/i.test(row.experienciaAprendizaje) ||
          !/recursos tangibles/i.test(row.recursos) ||
          !/recursos intangibles/i.test(row.recursos) ||
          !/rol de la familia|familia\s*:/i.test(row.rolEquipoFamilia) ||
          !/instrumento\s*:\s*escala de apreciaci[oó]n/i.test(row.evaluacion) ||
          !/logrado\s*:\s*3/i.test(row.evaluacion) ||
          !/medianamente logrado\s*:\s*2/i.test(row.evaluacion) ||
          !/por lograr\s*:\s*1/i.test(row.evaluacion) ||
          !/no observado\s*:\s*0/i.test(row.evaluacion) ||
          !/registro de observaci[oó]n/i.test(row.evaluacion) ||
          !/indicadores?/i.test(row.evaluacion)
        )
        const missingActivityDatesByJourney = fixed.filas.flatMap((row) => {
          const experienceBody = row.experienciaAprendizaje.toLocaleLowerCase("es-CL")
          return parvulariaRequiredDateLabels
            .filter((label) => !experienceBody.includes(label.toLocaleLowerCase("es-CL")))
            .map((label) => `${row.jornada}: ${label}`)
        })
        const shortActivitiesByJourney = fixed.filas.flatMap((row) =>
          findShortParvulariaActivities(row.experienciaAprendizaje)
            .map((activity) => `${row.jornada}: ${activity}`)
        )
        const heterogeneousDevelopmentIssues = parvulariaAgeGroups.length === 2
          ? fixed.filas.flatMap((row) =>
              inspectHeterogeneousDevelopment(
                row.experienciaAprendizaje,
                parvulariaAgeGroups.map((group) => group.heading),
                parvulariaRequiredDateLabels,
              ).map((issue) => `${row.jornada}: ${issue}`)
            )
          : []
        const languageJourney = fixed.filas[2]
        const languageJourneyMissing = !languageJourney || !/(lenguaje|lectura|relato|cuento|oral|vocabulario|canci[oó]n|conversaci[oó]n|balbuceo|gestos comunicativos)/i.test(languageJourney.experienciaAprendizaje)
        if (!fixed.objetivoAprendizaje.trim() || !fixed.principioJuego.trim() || !fixed.principioActividad.trim() || !fixed.focoExperiencia.trim() || fixed.filas.length !== 3 || incompleteRow || missingOA.length || journeyOAIssues.length || journeyOATIssues.length || missingActivityDatesByJourney.length || heterogeneousDevelopmentIssues.length || shortActivitiesByJourney.length || languageJourneyMissing) {
          throw new Error(
            journeyOAIssues.length
              ? `La asignación de núcleo/OA por jornada no fue respetada: ${journeyOAIssues.join(" | ")}.`
              : journeyOATIssues.length
                ? `La asignación de OAT por jornada no fue respetada: ${journeyOATIssues.join(" | ")}.`
              : missingOA.length
                ? `Faltan objetivos seleccionados en la tabla: ${missingOA.map((oa) => oa.codigoOficial || oa.id).join(", ")}.`
              : fixed.filas.length !== 3
                ? `La planificación debe contener exactamente 3 jornadas y se recibieron ${fixed.filas.length}.`
                : missingActivityDatesByJourney.length
                  ? `Faltan actividades por jornada para estas fechas: ${missingActivityDatesByJourney.join(", ")}.`
                  : heterogeneousDevelopmentIssues.length
                    ? `El Desarrollo heterogéneo no respeta los bloques por edad/subnivel: ${heterogeneousDevelopmentIssues.join(" | ")}.`
                  : shortActivitiesByJourney.length
                    ? `Hay actividades demasiado breves o redactadas como títulos. Amplía cada actividad a una frase pedagógica completa y concreta (aprox. 100-180 caracteres): ${shortActivitiesByJourney.slice(0, 6).join(" | ")}.`
                    : languageJourneyMissing
                      ? "La Jornada 3 debe contener una experiencia explícita de lenguaje, lectura, relato, oralidad o comunicación apropiada al nivel."
                      : incompleteRow
                        ? "Hay una jornada incompleta: debe incluir Inicio, Desarrollo, Finalización, roles, recursos tangibles/intangibles y la escala/indicadores de evaluación."
                        : "Faltan campos obligatorios de la plantilla."
          )
        }
        return serializeParvulariaPlanningDocument(fixed)
      }

      try {
        result = { ...result, text: canonicalize(result.text) }
      } catch (firstError) {
        const repaired = await callAI([
          ...aiMessages,
          { role: "assistant" as const, content: truncateForPrompt(result.text, 4500) },
          {
            role: "user" as const,
            content: `La salida anterior no cumple el JSON institucional de Educación Parvularia. Regenera desde cero SOLO como JSON válido. Debe contener EXACTAMENTE TRES jornadas en filas: 1) Exploración y experiencia principal, 2) Expresión artística y sensorial, 3) Lenguaje verbal, lectura y comunicación. Cada jornada debe completar las siete columnas, incluir Inicio/Desarrollo/Finalización y, en semanal/quincenal, una actividad para cada fecha hábil. EN TODOS LOS HORIZONTES, cada actividad del Desarrollo debe ser una oración pedagógica completa y breve de aproximadamente 100-180 caracteres de contenido: acción de los párvulos + material/estímulo/espacio + forma de exploración o mediación + propósito o respuesta observable. No uses títulos telegráficos. Respeta esta asignación de ÁMBITO, NÚCLEO, OA Y OAT por jornada:\n${parvulariaJourneyOAContext}\nCada ambitoNucleo debe usar exactamente el ámbito/núcleo principal y los núcleos transversales OAT asignados a su fila. Cada objetivosAprendizajes debe usar solo los OA y OAT asignados a su fila. ${parvulariaHeterogeneousDevelopmentContext ? `Además, corrige obligatoriamente la diferenciación por edad/subnivel dentro de Desarrollo:\n${parvulariaHeterogeneousDevelopmentContext}\n` : ""}No uses markdown, horas ni minutos. Error detectado: ${firstError instanceof Error ? firstError.message : "formato inválido"}`,
          },
        ], {
          maxTokens: strategy.maxTokens,
          preferProvider: strategy.preferProvider,
          openrouterModel: strategy.openrouterModel,
        })
        result = { ...repaired, text: canonicalize(repaired.text) }
      }

      if (parvulariaKnowledge) {
        noveltyAudit = evaluateParvulariaNovelty(
          result.text,
          parvulariaKnowledge.recentContentSamples,
        )

        if (!noveltyAudit.passed) {
          const diversifiedAI = await runAIGatewayText({
            messages: [
              ...aiMessages,
              { role: "assistant" as const, content: truncateForPrompt(result.text, 4200) },
              {
                role: "user" as const,
                content: `La planificación anterior repite demasiado actividades ya utilizadas (similitud máxima ${noveltyAudit.maxSimilarity}). Mantén exactamente los mismos ÁMBITOS, NÚCLEOS, OA, OAT, fechas y estructura institucional, pero REEMPLAZA las actividades de Desarrollo por experiencias sustantivamente diferentes. Cambia acción infantil, materiales, organización del espacio, mediación adulta y evidencia observable; no basta cambiar colores, nombres o personajes. Usa la biblioteca pedagógica solo como inspiración y no copies literalmente planificaciones anteriores.`,
              },
            ],
            capability: "long_context",
            maxOutputTokens: strategy.maxTokens,
            context: {
              userId: user.id,
              module: "educador-parvularia-diversify",
              reusePolicy: "exact_private",
              visibility: "private",
            },
            supabase,
          })
          const diversified = {
            text: diversifiedAI.data,
            provider: diversifiedAI.provider,
            model: diversifiedAI.model,
            reused: diversifiedAI.reused,
          }

          try {
            const diversifiedText = canonicalize(diversified.text)
            const diversifiedAudit = evaluateParvulariaNovelty(
              diversifiedText,
              parvulariaKnowledge.recentContentSamples,
            )

            if (diversifiedAudit.maxSimilarity <= noveltyAudit.maxSimilarity) {
              result = { ...diversified, text: diversifiedText }
              noveltyAudit = diversifiedAudit
            }
          } catch {
            // Conserva la versión institucional ya validada si la diversificación rompe el formato.
          }
        }
      }
    }

    if (isInstitutionalMacro) {
      let tableCheck = inspectInstitutionalTable(result.text, weeklyOAPlan)
      if (!tableCheck.valid) {
        const repaired = await callAI([
          ...aiMessages,
          {
            role: "user" as const,
            content: `La salida anterior no cumplió la tabla institucional. Regenera desde cero. Debe existir una sola tabla Markdown de 4 columnas y EXACTAMENTE ${weeklyOAPlan.length} filas de semanas, una por cada entrada de la distribución, sin omitir ninguna. Mantén todos los OA asignados y no agregues secciones.`,
          },
        ], {
          maxTokens: strategy.maxTokens,
          preferProvider: strategy.preferProvider,
          openrouterModel: strategy.openrouterModel,
        })
        tableCheck = inspectInstitutionalTable(repaired.text, weeklyOAPlan)
        if (!tableCheck.valid) {
          throw new Error(`La IA no completó correctamente el cronograma institucional: ${tableCheck.error || `se esperaban ${weeklyOAPlan.length} semanas y se recibieron ${tableCheck.rows}`}. Intenta generar nuevamente.`)
        }
        result = repaired
      }
    }

    let qualityAudit = outputIntent === "planificacion" && !isInstitutionalMacro && !isStructuredParvularia ? auditPlanningOutput(result.text, planningProfile) : null
    if (qualityAudit && !qualityAudit.passed) {
      const repaired = await callAI([
        ...aiMessages,
        { role: "assistant" as const, content: truncateForPrompt(result.text, 2400) },
        { role: "user" as const, content: buildRepairInstruction(planningProfile, qualityAudit) },
      ], {
        maxTokens: strategy.maxTokens,
        preferProvider: strategy.preferProvider,
        openrouterModel: strategy.openrouterModel,
      })
      const repairedAudit = auditPlanningOutput(repaired.text, planningProfile)
      if (repairedAudit.score >= qualityAudit.score) {
        result = repaired
        qualityAudit = repairedAudit
      }
    }

    if (isStructuredParvularia) {
      await rememberParvulariaGeneration({
        supabase,
        userId: user.id,
        course: curso,
        topic: contexto || message,
        selectedOAIds,
        selectedOATIds,
        candidateActivityIds: parvulariaKnowledge?.candidateIds || [],
        generatedContent: result.text,
        metadata: {
          tiempoPlanificacion,
          journeyNuclei: parvulariaJourneyNucleos,
          knowledgeSource: parvulariaKnowledge?.source || "none",
          noveltyAudit,
        },
      })
    }

    return NextResponse.json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      cursoKey: cursoToKey(curso),
      localCoverage: promptContext.summary,
      hasLocalCurriculum: promptContext.summary.oas > 0,
      selectedOAIds,
      oaConnection: { autoSelected: oaConnection.autoSelected, manuallySelected: oaConnection.manuallySelected, resolvedOAIds: oaConnection.resolvedOAIds },
      planningProfile: planningProfile.id,
      planningProfileLabel: planningProfile.label,
      qualityAudit,
      selectedOATIds,
      unidadId,
      parvulariaHeterogenea,
      parvulariaSegundoCurso,
      parvulariaMotivoFusion,
      outputIntent,
      institutionalPlanning: isInstitutionalMacro,
      parvulariaInstitutionalPlanning: isStructuredParvularia,
      periodLabel,
      weeklyOAPlan: isInstitutionalMacro ? weeklyOAPlan : undefined,
      parvulariaJourneyNucleos: isStructuredParvularia ? parvulariaJourneyNucleos : undefined,
      parvulariaJourneyOAIds: isStructuredParvularia ? parvulariaJourneyOAIds : undefined,
      parvulariaJourneyOATIds: isStructuredParvularia ? parvulariaJourneyOATIds : undefined,
      parvulariaKnowledge: isStructuredParvularia ? {
        source: parvulariaKnowledge?.source || "none",
        referenceCount: parvulariaKnowledge?.candidateIds.length || 0,
        savedPlanningCount: parvulariaKnowledge?.savedPlanningCount || 0,
        generationHistoryCount: parvulariaKnowledge?.generationHistoryCount || 0,
        noveltyAudit,
      } : undefined,
      compactPrompt: useCompactResourcePrompt,
      _design: designSummary,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "No fue posible generar la planificacion"
    if (isInstitutionalMacro) {
      console.error("[Educador AI]", errorMessage)
      const gatewayUnavailable =
        errorMessage.includes("EduAI AI Gateway: todos los proveedores fallaron") ||
        errorMessage.includes("EduAI Structured Gateway: todos los proveedores fallaron")

      return NextResponse.json(
        gatewayUnavailable
          ? {
              error: "Los modelos de IA están temporalmente ocupados o no disponibles. EduAI intentó proveedores alternativos. Vuelve a intentar en unos segundos.",
              code: "AI_PROVIDERS_UNAVAILABLE",
              retryable: true,
            }
          : { error: errorMessage },
        { status: 503 },
      )
    }
    if (isStructuredParvularia) {
      const primaryObjectiveLines = parvulariaSelectedOA.map((oa) =>
        `${oa.codigoOficial || oa.id}: ${oa.texto}`
      )
      const complementaryObjectiveLines = parvulariaSelectedOAT.map((oat) =>
        `${oat.description || oat.id}: ${oat.label}`
      )
      const objectiveLines = [...primaryObjectiveLines, ...complementaryObjectiveLines]
      const journeyScopeTexts = parvulariaJourneyNucleos.map((nucleo, index) => {
        const ambito = getParvulariaAmbito(curso, nucleo) || "Ámbito por confirmar"
        return [
          `AMBITO: ${ambito}`,
          `NUCLEO: ${nucleo}`,
          ...(parvulariaOATByJourney[index] || []).map((oat) => `OAT COMPLEMENTARIO · AMBITO: ${oat.ambito || "Desarrollo Personal y Social"} · NUCLEO: ${oat.nucleo || "No informado"}`),
        ].join("\n")
      })
      const journeyObjectiveTexts = parvulariaOAByJourney.map((oas, index) => {
        const primary = oas.map((oa) => `${oa.codigoOficial || oa.id}: ${oa.texto}`)
        const complementary = (parvulariaOATByJourney[index] || []).map((oat) => `${oat.description || oat.id}: ${oat.label}`)
        const combined = [...primary, ...complementary]
        return combined.length
          ? combined.join("\n\n")
          : `Objetivos oficiales seleccionados del núcleo ${parvulariaJourneyNucleos[index] || asignatura}.`
      })
      const dateLabels = parvulariaRequiredDateLabels.length
        ? parvulariaRequiredDateLabels
        : [parvulariaFechas || "Jornada seleccionada"]

      const datedDevelopment = (activity: (dateLabel: string, index: number) => string) =>
        dateLabels.map((dateLabel, index) => `${dateLabel}: ${activity(dateLabel, index)}`).join("\n\n")

      const fallbackDevelopment = (journeyIndex: number, nucleo: string) => {
        if (parvulariaAgeGroups.length === 2) {
          return parvulariaAgeGroups.map((group) => [
            group.heading,
            datedDevelopment((_dateLabel, index) =>
              buildFallbackParvulariaActivity({
                curso: group.curso,
                journeyIndex,
                nucleo,
                sequence: index,
                variationSeed: Date.now() + journeyIndex,
              })
            ),
          ].join("\n")).join("\n\n")
        }

        return datedDevelopment((_dateLabel, index) =>
          buildFallbackParvulariaActivity({
            curso,
            journeyIndex,
            nucleo,
            sequence: index,
            variationSeed: Date.now() + journeyIndex,
          })
        )
      }

      const commonOrientations = [
        "Preparar los materiales y el espacio con anticipación.",
        "Disponer un ambiente seguro, acogedor, ventilado e iluminado, con materiales accesibles.",
        "Permitir tiempos flexibles de exploración y respetar ritmos, señales de bienestar e intereses individuales.",
        "Favorecer distintos espacios educativos y libre desplazamiento cuando sea seguro.",
        "Observar permanentemente para ajustar la mediación, los apoyos y la complejidad de la experiencia.",
      ].join("\n- ")

      const commonRole = [
        "Rol del equipo pedagógico:",
        "- Presentar el ambiente y los recursos sin sustituir el protagonismo de los párvulos.",
        "- Mediar con lenguaje, gestos, preguntas, modelado y apoyo afectivo según la edad.",
        "- Observar, registrar y ajustar la experiencia de acuerdo con intereses, respuestas y necesidades.",
        "",
        "Rol de la familia:",
        "- Apoyar con materiales simples o antecedentes del niño o niña cuando corresponda.",
        "- Dar continuidad en el hogar mediante conversación, exploración, relatos o juegos relacionados.",
        "- Mantener comunicación con el equipo respecto de intereses, avances y necesidades.",
      ].join("\n")

      const evaluationText = [
        "Instrumento: Escala de apreciación.",
        "Logrado: 3",
        "Medianamente logrado: 2",
        "Por lograr: 1",
        "No observado: 0",
        "",
        "Registro de Observación.",
        "Registro fotográfico cuando sea pertinente y autorizado.",
        "",
        "Indicadores:",
        "1. Participa activamente en la experiencia de acuerdo con sus posibilidades y nivel de desarrollo.",
        "2. Manifiesta interés, curiosidad o intención comunicativa frente a los materiales, acciones o interacciones propuestas.",
        "3. Evidencia avances vinculados con los OA/OAT seleccionados mediante acciones, gestos, sonidos, palabras, movimientos o producciones.",
      ].join("\n")

      const filas = [
        {
          jornada: "Jornada 1 · Exploración y experiencia principal",
          ambitoNucleo: journeyScopeTexts[0] || "",
          objetivosAprendizajes: journeyObjectiveTexts[0] || objectiveLines.join("\n\n"),
          experienciaAprendizaje: [
            "Inicio:",
            "El equipo reúne al grupo, presenta de manera atractiva los materiales y anticipa la experiencia mediante gestos, palabras, objetos concretos o una breve canción de inicio.",
            "",
            "Desarrollo:",
            fallbackDevelopment(0, parvulariaJourneyNucleos[0] || asignatura),
            "",
            "Finalización:",
            "Invitar a guardar u ordenar los materiales junto al equipo, recuperar lo vivido mediante gestos, sonidos, palabras u observación compartida y reforzar positivamente la participación.",
          ].join("\n"),
          orientacionesRelevantes: `- ${commonOrientations}`,
          rolEquipoFamilia: commonRole,
          recursos: [
            "RECURSOS TANGIBLES",
            "- Materiales concretos, naturales o manipulativos seguros y pertinentes al núcleo.",
            "- Recipientes, bandejas, telas, elementos de apoyo y espacio preparado según la experiencia.",
            "",
            "RECURSOS INTANGIBLES",
            "- Voz de la educadora y asistentes.",
            "- Expresión gestual y corporal.",
            "- Mediación afectiva, observación y lenguaje contextualizado.",
          ].join("\n"),
          evaluacion: evaluationText,
        },
        {
          jornada: "Jornada 2 · Expresión artística y sensorial",
          ambitoNucleo: journeyScopeTexts[1] || "",
          objetivosAprendizajes: journeyObjectiveTexts[1] || objectiveLines.join("\n\n"),
          experienciaAprendizaje: [
            "Inicio:",
            "Presentar un ambiente sensorial y expresivo con música suave, sonidos, colores, texturas o movimiento, vinculándolo con los OA/OAT seleccionados.",
            "",
            "Desarrollo:",
            fallbackDevelopment(1, parvulariaJourneyNucleos[1] || asignatura),
            "",
            "Finalización:",
            "Cerrar con una breve socialización sensorial o expresiva, observando producciones, movimientos, gestos o sonidos y guardando los materiales con apoyo del equipo.",
          ].join("\n"),
          orientacionesRelevantes: `- ${commonOrientations}`,
          rolEquipoFamilia: commonRole,
          recursos: [
            "RECURSOS TANGIBLES",
            "- Telas, papeles, materiales de distintas texturas, objetos sonoros e instrumentos seguros.",
            "- Luces suaves, imágenes, recipientes, elementos artísticos lavables y materiales adecuados a la edad.",
            "",
            "RECURSOS INTANGIBLES",
            "- Música, ritmo y voz del equipo.",
            "- Expresión gestual, corporal y emocional.",
            "- Mediación sensible y observación pedagógica.",
          ].join("\n"),
          evaluacion: evaluationText,
        },
        {
          jornada: "Jornada 3 · Lenguaje verbal, lectura y comunicación",
          ambitoNucleo: journeyScopeTexts[2] || "",
          objetivosAprendizajes: journeyObjectiveTexts[2] || objectiveLines.join("\n\n"),
          experienciaAprendizaje: [
            "Inicio:",
            "Generar un momento de encuentro comunicativo mediante saludo, canción, objeto significativo, imagen, libro o relato breve, adecuando el lenguaje a la edad.",
            "",
            "Desarrollo:",
            fallbackDevelopment(2, parvulariaJourneyNucleos[2] || asignatura),
            "",
            "Finalización:",
            "Retomar palabras, sonidos, gestos o ideas destacadas; permitir que los párvulos comuniquen lo que llamó su atención y cerrar con una canción, gesto o breve recapitulación compartida.",
          ].join("\n"),
          orientacionesRelevantes: `- ${commonOrientations}`,
          rolEquipoFamilia: commonRole,
          recursos: [
            "RECURSOS TANGIBLES",
            "- Libros resistentes o álbumes ilustrados, láminas, fotografías, títeres u objetos concretos.",
            "- Elementos sonoros, canciones y apoyos visuales pertinentes a la edad.",
            "",
            "RECURSOS INTANGIBLES",
            "- Voz de la educadora y asistentes.",
            "- Entonación, pausas, expresión facial y gestual.",
            "- Escucha activa, turnos comunicativos y ampliación natural del lenguaje.",
          ].join("\n"),
          evaluacion: evaluationText,
        },
      ]

      const fallbackText = serializeParvulariaPlanningDocument({
        version: 1,
        tipo: "parvularia_institucional",
        titulo: `Planificación ${parvulariaHorizonLabel(tiempoPlanificacion as "diaria" | "semanal" | "quincenal" | "mensual" | "semestral")} ${anioPlanificacion}`,
        nivelEducativo: parvulariaHeterogenea ? `${curso} y ${parvulariaSegundoCurso}` : curso,
        fechas: parvulariaFechas,
        educadoraParvulos: educadoraParvularia,
        asistentesParvulos: asistentesParvularia,
        objetivoAprendizaje: objectiveLines.length
          ? `Favorecer experiencias integradas orientadas a los objetivos seleccionados: ${objectiveLines.join(" | ")}`
          : `Favorecer experiencias integradas pertinentes al núcleo ${asignatura}.`,
        principioJuego: "El juego se incorpora como estrategia pedagógica privilegiada para explorar, expresarse, relacionarse y construir aprendizajes de manera flexible y significativa.",
        principioActividad: "Los párvulos son protagonistas de sus aprendizajes mediante la exploración, la acción, la comunicación, la creación y la interacción con personas, objetos y ambientes.",
        focoExperiencia: `Desarrollar tres jornadas pedagógicas complementarias —exploración, expresión artístico-sensorial y lenguaje/comunicación— articuladas con los núcleos ${parvulariaJourneyNucleos.join(", ")} y los objetivos seleccionados.`,
        horizonte: tiempoPlanificacion as "diaria" | "semanal" | "quincenal" | "mensual" | "semestral",
        filas,
      })

      console.error("[Educador AI · Parvularia]", errorMessage)
      return NextResponse.json({
        text: fallbackText,
        provider: "EduAI respaldo local estructurado",
        model: "parvularia-structured-fallback",
        cursoKey: cursoToKey(curso),
        localCoverage: promptContext.summary,
        hasLocalCurriculum: promptContext.summary.oas > 0,
        selectedOAIds,
        oaConnection: { autoSelected: oaConnection.autoSelected, manuallySelected: oaConnection.manuallySelected, resolvedOAIds: oaConnection.resolvedOAIds },
        planningProfile: planningProfile.id,
        planningProfileLabel: planningProfile.label,
        selectedOATIds,
        unidadId,
        parvulariaHeterogenea,
        parvulariaSegundoCurso,
        parvulariaMotivoFusion,
        parvulariaJourneyNucleos,
        parvulariaJourneyOAIds,
        parvulariaJourneyOATIds,
        outputIntent,
        parvulariaInstitutionalPlanning: true,
        aiFallback: true,
        structuredFallback: true,
        _design: designSummary,
      })
    }

    const fallbackText = buildLocalEducadorFallback({
      intent: outputIntent,
      curso,
      asignatura,
      contexto,
      message,
      tiempoPlanificacion,
      sesiones,
      duracionMinutos,
      errorMessage,
      planningProfile,
    })

    return NextResponse.json({
      text: fallbackText,
      provider: "EduAI respaldo local",
      model: "fallback-template",
      cursoKey: cursoToKey(curso),
      localCoverage: promptContext.summary,
      hasLocalCurriculum: promptContext.summary.oas > 0,
      selectedOAIds,
      oaConnection: { autoSelected: oaConnection.autoSelected, manuallySelected: oaConnection.manuallySelected, resolvedOAIds: oaConnection.resolvedOAIds },
      planningProfile: planningProfile.id,
      planningProfileLabel: planningProfile.label,
      selectedOATIds,
      unidadId,
      parvulariaHeterogenea,
      parvulariaSegundoCurso,
      parvulariaMotivoFusion,
      outputIntent,
      aiFallback: true,
      _design: designSummary,
    })
  }
}
