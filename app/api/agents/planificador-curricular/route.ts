import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callAI, getEducadorModelStrategy } from "@/lib/ai-router-v4"
import { cursoToKey, type NivelKey } from "@/lib/mineduc-oa"
import {
  buildPlanningHorizonText,
  buildSelectedOAContext,
  getPlannerSummary,
  getPlannerUnits,
  getPlanningHorizonConfig,
  isTiempoPlanificacion,
  type TiempoPlanificacion,
} from "@/lib/planificador-curriculum"

export const runtime = "nodejs"
export const maxDuration = 60

type ChatHistoryItem = {
  role: "user" | "assistant"
  content: string
}

interface PlanificadorCurricularConfig {
  nivel?: NivelKey
  curso?: string
  asignatura?: string
  unidadId?: string
  selectedOAIds?: string[]
  tiempoPlanificacion?: TiempoPlanificacion
  periodoId?: string
  periodoLabel?: string
  sesiones?: number
  duracionMinutos?: number
  actividadGeneral?: string
  unidadesDeclaradas?: string
  evaluacion?: string
  incluirPIE?: boolean
  formatoInstitucional?: boolean
  generarAgenteDia?: boolean
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

function normalizeNivel(value: unknown): NivelKey {
  return value === "parvularia" || value === "basica" || value === "media" ? value : "media"
}

function truncate(text: string, max = 2400) {
  if (!text) return ""
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n...[texto acotado para mantener estabilidad del agente]`
}

function isChatHistoryItem(msg: unknown): msg is ChatHistoryItem {
  return (
    !!msg &&
    typeof msg === "object" &&
    "role" in msg &&
    "content" in msg &&
    ((msg as { role?: unknown }).role === "user" || (msg as { role?: unknown }).role === "assistant") &&
    typeof (msg as { content?: unknown }).content === "string"
  )
}

function buildFormatInstruction(tiempo: TiempoPlanificacion, generarAgenteDia: boolean) {
  if (tiempo === "diaria") {
    return `# Planificación diaria

## Datos generales
## OA oficiales utilizados
## Objetivo de la clase
## Indicadores de logro
## Inicio
## Desarrollo
## Cierre
## Evaluación
## Recursos y materiales
## Adecuaciones PIE / diversidad
## Ticket de salida
## Próxima clase sugerida`
  }

  if (tiempo === "semanal") {
    return `# Planificación semanal

## Datos generales
## OA oficiales utilizados
## Propósito de la semana
## Secuencia por sesiones
Usa una tabla con columnas: Sesión, foco, objetivo, inicio, desarrollo, cierre, evidencia, evaluación.
## Recursos de la semana
## Evaluación formativa
## Adecuaciones PIE / diversidad
${generarAgenteDia ? "## Insumos para agente día\nIncluye instrucciones breves para convertir cada sesión en una clase diaria." : ""}`
  }

  if (tiempo === "mensual") {
    return `# Planificación mensual

## Datos generales
## OA oficiales utilizados
## Propósito del mes
## Distribución por semanas
Usa una tabla con columnas: Semana, OA/foco, actividad general, sesiones sugeridas, evidencia, evaluación.
## Producto o evidencia final
## Recursos principales
## Evaluaciones del mes
## Adecuaciones PIE / diversidad
${generarAgenteDia ? "## Bajada al agente día\nIndica qué debe generar el agente diario para cada semana o sesión." : ""}`
  }

  if (tiempo === "semestral") {
    return `# Planificación semestral

## Datos generales
## OA oficiales utilizados
## Unidades o módulos del semestre
## Propósito semestral
## Distribución mensual
Usa una tabla con columnas: Mes, unidad/módulo, OA, foco de aprendizaje, actividad general, evaluación, evidencia.
## Distribución semanal sugerida
Usa una tabla con semanas o tramos. No desarrolles todas las clases como si fueran diarias; deja la bajada preparada.
## Hitos evaluativos
## Productos esperados
## Recursos y materiales generales
## Adecuaciones PIE / diversidad
## Seguimiento docente
${generarAgenteDia ? "## Puente con agente día\nPara cada tramo, entrega instrucciones para que el agente diario genere clases, guías, rúbricas o tickets de salida." : ""}`
  }

  return `# Planificación anual

## Datos generales
## OA oficiales utilizados
## Visión anual
## Primer semestre
Usa una tabla con meses, unidades/módulos, OA, actividades generales, evaluaciones y evidencias.
## Segundo semestre
Usa una tabla con meses, unidades/módulos, OA, actividades generales, evaluaciones y evidencias.
## Hitos anuales
## Evaluaciones principales
## Productos integradores
## Recursos generales
## Adecuaciones PIE / diversidad
## Seguimiento y cierre anual
${generarAgenteDia ? "## Puente con agente día\nExplica cómo convertir cada mes, semana o hito en planificación diaria desde EduAI." : ""}`
}

function buildLocalFallback(params: {
  curso: string
  asignatura: string
  tiempo: TiempoPlanificacion
  periodoLabel: string
  sesiones: number
  duracionMinutos: number
  actividadGeneral: string
  oaContext: string
  errorMessage: string
}) {
  return `# Planificación ${params.tiempo} — respaldo local EduAI

> No se pudo completar la generación con el proveedor de IA. Se entrega una estructura base editable para no perder el trabajo. Error: ${params.errorMessage}

## Datos generales

| Campo | Detalle |
|---|---|
| Curso | ${params.curso} |
| Asignatura | ${params.asignatura} |
| Horizonte | ${params.tiempo} |
| Periodo | ${params.periodoLabel || "No especificado"} |
| Sesiones estimadas | ${params.sesiones} |
| Duración por sesión | ${params.duracionMinutos} min |
| Actividad general | ${params.actividadGeneral || "No especificada"} |

## OA oficiales disponibles

${params.oaContext || "No hay OA seleccionados o disponibles en la base local para esta combinación."}

## Estructura sugerida

| Tramo | Foco | Actividad general | Evidencia | Evaluación |
|---|---|---|---|---|
| Inicio | Diagnóstico y activación | Presentar propósito, OA y producto esperado. | Registro inicial | Formativa |
| Desarrollo | Trabajo guiado | Desarrollar actividades, investigación, práctica o proyecto. | Producto parcial | Lista de cotejo |
| Cierre | Síntesis y evaluación | Presentar resultados y reflexionar sobre el aprendizaje. | Producto final | Rúbrica o pauta |

## Puente con agente día

Usa cada tramo para generar clases diarias, guías, rúbricas y tickets de salida desde EduAI.`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  const history = Array.isArray(body.history) ? body.history : []
  const cfg: PlanificadorCurricularConfig = body.config || {}

  const nivel = normalizeNivel(cfg.nivel)
  const curso = typeof cfg.curso === "string" && cfg.curso.trim()
    ? cfg.curso.trim()
    : nivel === "media" ? "1° Medio" : nivel === "basica" ? "1° Básico" : "NT1 - Pre Kinder (4-5 años)"
  const asignatura = typeof cfg.asignatura === "string" && cfg.asignatura.trim()
    ? cfg.asignatura.trim()
    : "Matemática"
  const unidadId = typeof cfg.unidadId === "string" ? cfg.unidadId.trim() : ""
  const selectedOAIds = ensureArray(cfg.selectedOAIds)
  const tiempo = isTiempoPlanificacion(cfg.tiempoPlanificacion) ? cfg.tiempoPlanificacion : "semestral"
  const horizon = getPlanningHorizonConfig(tiempo)
  const periodoLabel = typeof cfg.periodoLabel === "string" && cfg.periodoLabel.trim()
    ? cfg.periodoLabel.trim()
    : horizon.periodOptions[0]?.label || horizon.label
  const sesiones = clampNumber(cfg.sesiones, horizon.defaultSesiones, horizon.minSesiones, horizon.maxSesiones)
  const duracionMinutos = clampNumber(cfg.duracionMinutos, horizon.defaultDuracionMinutos, 15, 300)
  const actividadGeneral = typeof cfg.actividadGeneral === "string" ? cfg.actividadGeneral.trim() : ""
  const unidadesDeclaradas = typeof cfg.unidadesDeclaradas === "string" ? cfg.unidadesDeclaradas.trim() : ""
  const evaluacion = typeof cfg.evaluacion === "string" ? cfg.evaluacion.trim() : ""

  const summary = getPlannerSummary({ nivel, curso, asignatura })
  const units = getPlannerUnits({ nivel, curso, asignatura })
  const selectedUnit = units.find((unit) => unit.id === unidadId)
  const oaContext = buildSelectedOAContext({ nivel, curso, asignatura }, selectedOAIds, unidadId || undefined)
  const horizonText = buildPlanningHorizonText(tiempo, sesiones, duracionMinutos, periodoLabel)
  const teacherIdea = [actividadGeneral, unidadesDeclaradas, message].filter(Boolean).join("\n")
  const formatInstruction = buildFormatInstruction(tiempo, cfg.generarAgenteDia !== false)

  const systemPrompt = `Eres APl, Agente Planificador Curricular de EduAI para Chile.

MISIÓN:
Generar planificación ${tiempo} para educación chilena usando datos curriculares reales disponibles en el repositorio EduAI.

REGLAS CRÍTICAS:
1. No inventes Objetivos de Aprendizaje oficiales.
2. Usa SOLO los OA entregados en el bloque "OA REALES DISPONIBLES".
3. Si no hay OA suficientes, dilo con claridad y trabaja la planificación como propuesta general, sin crear códigos oficiales falsos.
4. Para educación básica y media, organiza con estructura útil para UTP: unidad, OA, indicadores, actividades, evaluación y evidencias.
5. Para planificación semestral/anual, no desarrolles cada clase completa; distribuye meses, semanas o tramos y deja puente para el agente diario.
6. La idea del docente es el eje didáctico. Los OA respaldan curricularmente la planificación.
7. Incluye adecuaciones PIE/diversidad cuando corresponda.
8. La respuesta debe quedar lista para copiar, guardar o exportar.

CONTEXTO:
- Nivel: ${nivel}
- Curso/Subnivel: ${curso}
- Asignatura/Núcleo: ${asignatura}
- Unidad seleccionada: ${selectedUnit?.label || "Sin unidad específica seleccionada"}
- Horizonte: ${horizonText}
- Periodo: ${periodoLabel}
- Sesiones estimadas: ${sesiones}
- Duración por sesión: ${duracionMinutos} minutos
- Evaluación solicitada: ${evaluacion || "No especificada; proponer formativa y/o sumativa según horizonte."}
- Formato institucional: ${cfg.formatoInstitucional ? "sí" : "no"}
- Incluir PIE/diversidad: ${cfg.incluirPIE === false ? "no obligatorio" : "sí"}
- Generar puente al agente día: ${cfg.generarAgenteDia === false ? "no" : "sí"}

COBERTURA LOCAL:
- Unidades/módulos cargados: ${summary.units}
- OA cargados: ${summary.oas}

OA REALES DISPONIBLES:
${oaContext || "Sin OA locales seleccionados para esta configuración."}

UNIDADES DECLARADAS POR EL DOCENTE:
${unidadesDeclaradas || "No especificadas."}

IDEA / ACTIVIDAD GENERAL DEL DOCENTE:
${truncate(teacherIdea || "El docente pide una planificación básica con los datos seleccionados.", 1800)}

FORMATO OBLIGATORIO:
${formatInstruction}`

  const aiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-4).filter(isChatHistoryItem).map((item: ChatHistoryItem) => ({
      role: item.role,
      content: truncate(item.content, item.role === "assistant" ? 1000 : 1400),
    })),
    {
      role: "user" as const,
      content: message || `Genera una planificación ${tiempo} para ${curso}, ${asignatura}, periodo ${periodoLabel}.`,
    },
  ]

  try {
    const strategy = getEducadorModelStrategy(tiempo === "diaria" ? "planning_short" : "planning_full")
    const result = await callAI(aiMessages, {
      maxTokens: tiempo === "anual" ? Math.max(strategy.maxTokens, 5200) : strategy.maxTokens,
      preferProvider: strategy.preferProvider,
      openrouterModel: strategy.openrouterModel,
    })

    return NextResponse.json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      cursoKey: cursoToKey(curso),
      nivel,
      curso,
      asignatura,
      unidadId,
      selectedOAIds,
      tiempoPlanificacion: tiempo,
      periodoLabel,
      sesiones,
      duracionMinutos,
      localCoverage: summary,
      hasLocalCurriculum: summary.oas > 0,
      bridgeToDailyAgent: cfg.generarAgenteDia !== false,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "No fue posible generar la planificación"
    const fallbackText = buildLocalFallback({
      curso,
      asignatura,
      tiempo,
      periodoLabel,
      sesiones,
      duracionMinutos,
      actividadGeneral,
      oaContext,
      errorMessage,
    })

    return NextResponse.json({
      text: fallbackText,
      provider: "EduAI respaldo local",
      model: "fallback-template",
      cursoKey: cursoToKey(curso),
      nivel,
      curso,
      asignatura,
      unidadId,
      selectedOAIds,
      tiempoPlanificacion: tiempo,
      periodoLabel,
      sesiones,
      duracionMinutos,
      localCoverage: summary,
      hasLocalCurriculum: summary.oas > 0,
      aiFallback: true,
    })
  }
}
