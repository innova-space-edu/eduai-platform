import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callAI } from "@/lib/ai-router-v4"
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
  parvularia: `
EDUCACIÓN PARVULARIA — Bases Curriculares de la Educación Parvularia (BCEP)
Estructura curricular:
- Subnivel o tramo
- Ámbitos de experiencia
- Núcleos de aprendizaje
- Objetivos de Aprendizaje (OA)
- Objetivos de Aprendizaje Transversales (OAT)

Enfoque pedagógico:
- juego
- exploración
- vínculo afectivo
- experiencia de aprendizaje
- mediación pedagógica
- participación activa
- evaluación formativa y cualitativa

La respuesta debe usar lenguaje apropiado para el subnivel seleccionado. Debe diferenciar cuando se trata de sala cuna, nivel medio o transición.
`.trim(),

  basica: `
EDUCACIÓN BÁSICA — Bases Curriculares MINEDUC
Estructura curricular:
- curso
- asignatura
- unidad
- Objetivos de Aprendizaje (OA)
- indicadores de evaluación
- habilidades y actitudes cuando corresponda

La planificación debe mantener coherencia curricular, claridad metodológica, progresión didáctica y evaluación alineada al OA.
`.trim(),

  media: `
EDUCACIÓN MEDIA — Bases Curriculares MINEDUC
Estructura curricular:
- curso
- asignatura
- unidad o módulo
- Objetivos de Aprendizaje (OA)
- habilidades y actitudes cuando corresponda

La planificación debe ser académicamente rigurosa, clara, útil para aula chilena real y alineada con OA oficiales.
`.trim(),
}

const SEASONS: Record<string, string> = {
  marzo: "inicio del año escolar, diagnóstico, establecimiento de rutinas y normas",
  abril: "consolidación inicial, otoño, primeras evaluaciones formativas",
  mayo: "desarrollo de unidades, trabajo sistemático y seguimiento del progreso",
  junio: "cierre parcial de procesos, invierno, ajustes antes de vacaciones",
  julio: "retorno o vacaciones de invierno según calendario escolar",
  agosto: "inicio del segundo semestre, reorganización y profundización",
  septiembre: "Fiestas Patrias, primavera, actividades con contexto nacional y cultural",
  octubre: "mes con efemérides escolares, consolidación y proyectos",
  noviembre: "cierre de unidades, evaluaciones finales y síntesis",
  diciembre: "cierre del año escolar, integración, evidencias finales",
  enero: "receso escolar habitual",
  febrero: "preparación del nuevo año escolar",
}

function normalizeMonth(input?: string) {
  const month =
    input ||
    new Date().toLocaleString("es-CL", {
      month: "long",
    })

  return month
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function extractOARequest(message: string): { oaNum: number | null } {
  const oaMatch = message.match(/\bOA\s*(\d+)\b/i)
  const numMatch = message.match(
    /\bobjetivo\s+(?:de\s+aprendizaje\s+)?(?:n[°º.]?\s*)?(\d+)\b/i
  )

  const num = oaMatch
    ? parseInt(oaMatch[1], 10)
    : numMatch
      ? parseInt(numMatch[1], 10)
      : null

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

function buildLocalCoverageNotice(
  nivel: NivelKey,
  curso: string,
  asignatura: string
): string {
  const asignaturasDisponibles = getAvailableAsignaturas(nivel, curso)

  if (!asignaturasDisponibles.length) {
    return `No existe aún base curricular local cargada para ${curso} en este nivel.`
  }

  if (!asignaturasDisponibles.includes(asignatura)) {
    return `No existe aún base curricular local cargada para ${asignatura} en ${curso}.`
  }

  return `Existe base curricular local cargada o catalogada para ${asignatura} en ${curso}.`
}

function buildSelectedOATContext(
  curso: string,
  asignatura: string,
  selectedOATIds: string[]
): string {
  const allOAT = getParvulariaOAT(curso, asignatura)
  const picked = selectedOATIds.length
    ? allOAT.filter((item) => selectedOATIds.includes(item.id))
    : []

  if (!picked.length) return ""

  return [
    "OBJETIVOS DE APRENDIZAJE TRANSVERSALES SELECCIONADOS:",
    ...picked.map(
      (item) =>
        `- ${item.description || item.id}: ${item.label}`
    ),
  ].join("\n")
}

function buildUnitContext(
  nivel: NivelKey,
  curso: string,
  asignatura: string,
  unidadId?: string
): string {
  const units = getPlannerUnits({ nivel, curso, asignatura })
  if (!units.length || !unidadId) return ""

  const selected = units.find((unit) => unit.id === unidadId)
  if (!selected) return ""

  return [
    "UNIDAD O MÓDULO CURRICULAR SELECCIONADO:",
    `- ${selected.label}`,
    selected.oaIds.length
      ? `- OA vinculados en base local: ${selected.oaIds.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function inferParvulariaStage(curso: string): string {
  const c = curso.toLowerCase()

  if (c.includes("sala cuna menor")) {
    return "Subnivel: Sala Cuna Menor. Enfatiza vínculo, apego, exploración sensoriomotriz, bienestar, rutinas, interacción corporal y lenguaje emergente."
  }

  if (c.includes("sala cuna mayor")) {
    return "Subnivel: Sala Cuna Mayor. Enfatiza desplazamiento inicial, exploración activa, juego simple, comunicación emergente, rutinas y seguridad afectiva."
  }

  if (c.includes("medio menor")) {
    return "Subnivel: Medio Menor. Enfatiza lenguaje en expansión, juego activo, autonomía inicial, regulación progresiva, exploración y experiencias concretas."
  }

  if (c.includes("medio mayor")) {
    return "Subnivel: Medio Mayor. Enfatiza lenguaje, juego simbólico, interacción grupal, descubrimiento del entorno, progresión motriz y pensamiento inicial."
  }

  if (c.includes("nt1")) {
    return "Subnivel: NT1. Enfatiza experiencias de aprendizaje lúdicas con mayor desarrollo verbal, pensamiento matemático inicial, exploración, representación y trabajo grupal guiado."
  }

  if (c.includes("nt2")) {
    return "Subnivel: NT2. Enfatiza consolidación de aprendizajes del nivel transición, mayor autonomía, comunicación, representación, pensamiento y preparación pedagógica para enseñanza básica."
  }

  return "Subnivel de educación parvularia no identificado con precisión."
}

function buildPromptContext(params: {
  nivel: NivelKey
  curso: string
  asignatura: string
  contexto: string
  mes: string
  unidadId: string
  selectedOAIds: string[]
  selectedOATIds: string[]
  tiempoPlanificacion: TiempoPlanificacion
  sesiones: number
  duracionMinutos: number
  userMessage: string
}) {
  const {
    nivel,
    curso,
    asignatura,
    contexto,
    mes,
    unidadId,
    selectedOAIds,
    selectedOATIds,
    tiempoPlanificacion,
    sesiones,
    duracionMinutos,
    userMessage,
  } = params

  const summary = getPlannerSummary({ nivel, curso, asignatura })
  const seasonText = SEASONS[mes] || ""
  const horizonText = buildPlanningHorizonText(
    tiempoPlanificacion,
    sesiones,
    duracionMinutos
  )
  const { oaNum } = extractOARequest(userMessage)

  const selectedOAContext = selectedOAIds.length
    ? buildSelectedOAContext(
        { nivel, curso, asignatura },
        selectedOAIds,
        unidadId || undefined
      )
    : ""

  const fallbackOAContext =
    !selectedOAContext && oaNum
      ? buildOAContext(nivel, curso, asignatura, oaNum)
      : !selectedOAContext
        ? buildOAContext(nivel, curso, asignatura)
        : ""

  const oaContext = selectedOAContext || fallbackOAContext
  const unitContext = buildUnitContext(nivel, curso, asignatura, unidadId)
  const localCoverage = buildLocalCoverageNotice(nivel, curso, asignatura)

  const ambito =
    nivel === "parvularia" ? getParvulariaAmbito(curso, asignatura) : ""

  const oatContext =
    nivel === "parvularia"
      ? buildSelectedOATContext(curso, asignatura, selectedOATIds)
      : ""

  const stageContext =
    nivel === "parvularia" ? inferParvulariaStage(curso) : ""

  return {
    seasonText,
    horizonText,
    oaContext,
    unitContext,
    localCoverage,
    ambito,
    oatContext,
    stageContext,
    summary,
    selectedCount: selectedOAIds.length,
  }
}

function isChatHistoryItem(msg: unknown): msg is ChatHistoryItem {
  return (
    !!msg &&
    typeof msg === "object" &&
    "role" in msg &&
    "content" in msg &&
    ((msg as { role?: unknown }).role === "user" ||
      (msg as { role?: unknown }).role === "assistant") &&
    typeof (msg as { content?: unknown }).content === "string"
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Solicitud inválida" },
      { status: 400 }
    )
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : ""

  if (!message) {
    return NextResponse.json(
      { error: "Falta el mensaje del usuario" },
      { status: 400 }
    )
  }

  const history = Array.isArray(body.history) ? body.history : []
  const cfg: EducadorConfig = body.config || {}

  const nivel: NivelKey =
    cfg.nivel === "parvularia" || cfg.nivel === "basica" || cfg.nivel === "media"
      ? cfg.nivel
      : "parvularia"

  const curso =
    typeof cfg.curso === "string" && cfg.curso.trim()
      ? cfg.curso.trim()
      : nivel === "parvularia"
        ? "Sala Cuna Menor (0 a 1 año)"
        : nivel === "basica"
          ? "1° Básico"
          : "1° Medio"

  const asignatura =
    typeof cfg.asignatura === "string" && cfg.asignatura.trim()
      ? cfg.asignatura.trim()
      : nivel === "parvularia"
        ? "Lenguaje Verbal"
        : "Matemática"

  const contexto =
    typeof cfg.contexto === "string" ? cfg.contexto.trim() : ""

  const mes = normalizeMonth(cfg.mes)
  const unidadId =
    typeof cfg.unidadId === "string" ? cfg.unidadId.trim() : ""

  const selectedOAIds = ensureArray(cfg.selectedOAIds)
  const selectedOATIds = ensureArray(cfg.selectedOATIds)

  const tiempoPlanificacion: TiempoPlanificacion =
    cfg.tiempoPlanificacion === "diaria" ||
    cfg.tiempoPlanificacion === "semanal" ||
    cfg.tiempoPlanificacion === "mensual"
      ? cfg.tiempoPlanificacion
      : "diaria"

  const sesiones = clampNumber(cfg.sesiones, 1, 1, 40)
  const duracionMinutos = clampNumber(
    cfg.duracionMinutos,
    nivel === "parvularia" ? 30 : 90,
    15,
    300
  )

  const promptContext = buildPromptContext({
    nivel,
    curso,
    asignatura,
    contexto,
    mes,
    unidadId,
    selectedOAIds,
    selectedOATIds,
    tiempoPlanificacion,
    sesiones,
    duracionMinutos,
    userMessage: message,
  })

  const systemPrompt = `
Eres APl, el Agente Planificador Curricular de EduAI.

Tu función es ayudar a docentes de Chile a crear planificaciones rigurosas, útiles, claras y visualmente ordenadas, alineadas con el currículum oficial del MINEDUC.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS CRÍTICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NUNCA inventes Objetivos de Aprendizaje.
2. Usa SOLO los OA entregados en el contexto local de esta conversación.
3. Si faltan OA oficiales para una combinación curso/asignatura, debes decirlo claramente.
4. No completes vacíos curriculares “por intuición”.
5. Si el usuario seleccionó varios OA, debes articularlos explícitamente.
6. Si el usuario seleccionó una unidad o módulo, la planificación debe centrarse en ese marco curricular.
7. En Parvularia, integra subnivel, ámbito, núcleo, OA y OAT cuando estén disponibles.
8. La respuesta debe ser útil para copiar a un documento docente.
9. Debes escribir en español claro, formal y pedagógico.
10. Presenta el contenido de forma ordenada, bonita y entendible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO CURRICULAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nivel: ${nivel}
Curso/Subnivel: ${curso}
Asignatura/Núcleo: ${asignatura}

Referencia del nivel:
${NIVEL_INFO[nivel]}

${nivel === "parvularia" ? `Contexto del subnivel:\n${promptContext.stageContext}` : ""}

Cobertura curricular local:
${promptContext.localCoverage}

${promptContext.unitContext ? `${promptContext.unitContext}` : "No hay unidad o módulo local seleccionado."}

${
  promptContext.oaContext
    ? promptContext.oaContext
    : "No hay OA oficiales locales disponibles para esta combinación. Debes indicarlo claramente y evitar inventar OA."
}

${
  nivel === "parvularia" && promptContext.ambito
    ? `ÁMBITO DE EXPERIENCIA: ${promptContext.ambito}`
    : ""
}

${
  nivel === "parvularia" && promptContext.oatContext
    ? promptContext.oatContext
    : ""
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO TEMPORAL Y PEDAGÓGICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mes: ${mes}
Contexto temporal: ${promptContext.seasonText || "Sin referencia estacional específica"}
Horizonte de planificación: ${tiempoPlanificacion}
Sesiones estimadas: ${sesiones}
Minutos por sesión: ${duracionMinutos}

Interpretación del horizonte:
${promptContext.horizonText}

${
  contexto
    ? `Información adicional del docente:\n${contexto}`
    : "No hay contexto adicional aportado por el docente."
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COBERTURA LOCAL DETECTADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Unidades/Módulos/Bloques cargados localmente: ${promptContext.summary.units}
- OA cargados localmente: ${promptContext.summary.oas}
- OA seleccionados explícitamente: ${promptContext.selectedCount}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO OBLIGATORIO DE RESPUESTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando el usuario pida una planificación, responde usando esta estructura, salvo que pida otra cosa:

# Planificación

## 1. Datos generales
- Nivel / Curso o Subnivel:
- Asignatura o Núcleo:
- Unidad, módulo o bloque:
- Horizonte:
- Sesiones:
- Duración por sesión:

## 2. Objetivos de Aprendizaje
- Lista textual de OA oficiales disponibles y seleccionados
- Si es Parvularia, agrega también:
  - Subnivel
  - Ámbito
  - Núcleo
  - OAT seleccionados

## 3. Propósito de aprendizaje
- Redacta el propósito de forma pedagógica y comprensible

## 4. Secuencia didáctica
### Inicio
### Desarrollo
### Cierre

Si el horizonte es semanal o mensual:
- distribuye la secuencia por sesiones o semanas

## 5. Evaluación
- tipo
- instrumento
- evidencia esperada
- criterios o indicadores sugeridos

## 6. Recursos y materiales
- lista clara y pertinente

## 7. Adaptaciones y diversidad
- estrategias para distintos ritmos
- sugerencias para NEE
- inclusión y participación

## 8. Observaciones pedagógicas
- recomendaciones de implementación real

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITERIOS DE CALIDAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Debe haber coherencia entre OA, actividades y evaluación.
- Las actividades deben ser realistas para el tiempo disponible.
- Debe evitar relleno innecesario.
- Debe mantener un nivel académico sólido.
- Si no hay OA locales suficientes, dilo claramente antes de planificar.
- En Parvularia, prioriza experiencias de aprendizaje, juego, vínculo, mediación pedagógica, seguridad, bienestar y lenguaje apropiado a la etapa.
- Si el subnivel es Sala Cuna, evita estructuras escolarizadas y prioriza experiencias breves, sensoriales, corporales, afectivas y situadas.
`.trim()

  const aiMessages = [
    {
      role: "system" as const,
      content: systemPrompt,
    },
    ...history
      .slice(-10)
      .filter(isChatHistoryItem)
      .map((msg: ChatHistoryItem) => ({
        role: msg.role,
        content: msg.content,
      })),
    {
      role: "user" as const,
      content: message,
    },
  ]

  try {
    const result = await callAI(aiMessages, {
      maxTokens: 5000,
      preferProvider: "gemini",
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
    const errorMessage =
      error instanceof Error
        ? error.message
        : "No fue posible generar la planificación"

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
