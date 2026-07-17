import {
  cursoToKey,
  getCurriculumRecord,
  getOAs,
  getParvulariaAmbitoForCurso,
  getParvulariaOATForCurso,
  normalizeAsignatura,
  type NivelKey,
  type OA,
} from "@/lib/mineduc-oa"

export type TiempoPlanificacion = "diaria" | "semanal" | "mensual" | "semestral" | "anual"

export interface PlanningHorizonConfig {
  id: TiempoPlanificacion
  label: string
  shortLabel: string
  description: string
  defaultSesiones: number
  minSesiones: number
  maxSesiones: number
  defaultDuracionMinutos: number
  periodOptions: Array<{ id: string; label: string; inicio?: string; fin?: string }>
  expectedStructure: string[]
}

export const PLANNING_HORIZONS: PlanningHorizonConfig[] = [
  {
    id: "diaria",
    label: "Planificación diaria",
    shortLabel: "Diaria",
    description: "Clase específica con inicio, desarrollo, cierre, evaluación y materiales.",
    defaultSesiones: 1,
    minSesiones: 1,
    maxSesiones: 3,
    defaultDuracionMinutos: 90,
    periodOptions: [{ id: "clase", label: "Clase única" }],
    expectedStructure: ["datos generales", "OA", "objetivo de clase", "inicio", "desarrollo", "cierre", "evaluación", "materiales"],
  },
  {
    id: "semanal",
    label: "Planificación semanal",
    shortLabel: "Semanal",
    description: "Secuencia de una semana, distribuida por sesiones y evidencias de avance.",
    defaultSesiones: 3,
    minSesiones: 1,
    maxSesiones: 8,
    defaultDuracionMinutos: 90,
    periodOptions: [{ id: "semana", label: "Semana lectiva" }],
    expectedStructure: ["propósito semanal", "progresión por sesión", "evaluación formativa", "recursos", "evidencias"],
  },
  {
    id: "mensual",
    label: "Planificación mensual",
    shortLabel: "Mensual",
    description: "Organización de una unidad o subunidad durante varias semanas.",
    defaultSesiones: 8,
    minSesiones: 4,
    maxSesiones: 24,
    defaultDuracionMinutos: 90,
    periodOptions: [
      { id: "marzo", label: "Marzo" },
      { id: "abril", label: "Abril" },
      { id: "mayo", label: "Mayo" },
      { id: "junio", label: "Junio" },
      { id: "julio", label: "Julio" },
      { id: "agosto", label: "Agosto" },
      { id: "septiembre", label: "Septiembre" },
      { id: "octubre", label: "Octubre" },
      { id: "noviembre", label: "Noviembre" },
      { id: "diciembre", label: "Diciembre" },
    ],
    expectedStructure: ["objetivos del mes", "semanas", "actividades centrales", "evaluaciones", "recursos", "ajustes"],
  },
  {
    id: "semestral",
    label: "Planificación semestral",
    shortLabel: "Semestral",
    description: "Distribución macro del semestre con unidades, OA, semanas, evaluaciones y productos.",
    defaultSesiones: 18,
    minSesiones: 8,
    maxSesiones: 60,
    defaultDuracionMinutos: 90,
    periodOptions: [
      { id: "primer-semestre", label: "Primer semestre · marzo a junio", inicio: "marzo", fin: "junio" },
      { id: "segundo-semestre", label: "Segundo semestre · julio a diciembre", inicio: "julio", fin: "diciembre" },
    ],
    expectedStructure: ["marco semestral", "distribución mensual", "semanas", "OA por tramo", "evaluaciones", "productos", "seguimiento"],
  },
  {
    id: "anual",
    label: "Planificación anual",
    shortLabel: "Anual",
    description: "Vista completa marzo-diciembre con semestres, unidades, OA, hitos y evaluaciones.",
    defaultSesiones: 36,
    minSesiones: 16,
    maxSesiones: 120,
    defaultDuracionMinutos: 90,
    periodOptions: [{ id: "anio-escolar", label: "Año escolar · marzo a diciembre", inicio: "marzo", fin: "diciembre" }],
    expectedStructure: ["visión anual", "primer semestre", "segundo semestre", "unidades", "OA", "evaluaciones", "hitos", "cierre"],
  },
]

export function getPlanningHorizonConfig(tiempo: TiempoPlanificacion): PlanningHorizonConfig {
  return PLANNING_HORIZONS.find((item) => item.id === tiempo) || PLANNING_HORIZONS[0]
}

export function isTiempoPlanificacion(value: unknown): value is TiempoPlanificacion {
  return typeof value === "string" && PLANNING_HORIZONS.some((item) => item.id === value)
}

export function getPlanningPeriodOptions(tiempo: TiempoPlanificacion) {
  return getPlanningHorizonConfig(tiempo).periodOptions
}

export interface PlannerUnit {
  id: string
  label: string
  oaIds: string[]
}

export interface PlannerOption {
  id: string
  label: string
  description?: string
}

export interface PlannerCurriculumState {
  nivel: NivelKey
  curso: string
  asignatura: string
}

interface RawOAItem {
  id: string
  codigo_oficial?: string
  descripcion: string
  eje?: string
  indicadores?: string[]
}

interface RawUnidad {
  numero?: number
  unidad?: number
  id?: string
  nombre?: string
  titulo?: string
  oa: RawOAItem[]
}

interface RawModulo {
  id: string
  nombre: string
  descripcion_modulo?: string
  oa: RawOAItem[]
}

interface RawParvNucleo {
  nombre: string
  oa_transversales?: RawOAItem[]
  oa_contenido?: RawOAItem[]
}

interface RawParvAmbito {
  nombre: string
  nucleos: RawParvNucleo[]
}

interface StandardCurriculumFile {
  metadata?: Record<string, unknown>
  objetivos_habilidad?: unknown[]
  objetivos_actitud?: unknown[]
  unidades?: RawUnidad[]
  modulos?: RawModulo[]
  estructura_planificacion?: {
    tipo?: string
    modulos_disponibles?: string[]
    sugerencia_uso?: string
  }
  usa_base_compartida?: string
}

interface ParvulariaCurriculumFile {
  metadata?: Record<string, unknown>
  ambitos: RawParvAmbito[]
}

export function getCurriculumIdentity({ nivel, curso, asignatura }: PlannerCurriculumState) {
  const cursoKey = cursoToKey(curso)
  const asigKey = normalizeAsignatura(asignatura, nivel)
  return { cursoKey, asigKey, mapKey: `${nivel}|${cursoKey}|${asigKey}` }
}

function getUnidadNumero(unidad: RawUnidad): number | string | undefined {
  return unidad.numero ?? unidad.unidad
}

function getUnidadNombre(unidad: RawUnidad): string {
  return unidad.nombre ?? unidad.titulo ?? ""
}

function getUnidadId(unidad: RawUnidad): string {
  return unidad.id || `u${String(getUnidadNumero(unidad) ?? "").trim()}`
}

export function getPlannerUnits(state: PlannerCurriculumState): PlannerUnit[] {
  const record = getCurriculumRecord(state.nivel, state.curso, state.asignatura)
  if (!record) return []

  if (record.kind === "parvularia") {
    const raw = record.raw as ParvulariaCurriculumFile
    const nucleoNormalizado = normalizeAsignatura(state.asignatura, "parvularia")

    for (const ambito of raw.ambitos || []) {
      for (const nucleo of ambito.nucleos || []) {
        if (normalizeAsignatura(nucleo.nombre, "parvularia") !== nucleoNormalizado) continue

        const oaIds = (nucleo.oa_contenido || []).map((item) => item.id)
        const courseKey = cursoToKey(state.curso)

        return [
          {
            id: `parv-${courseKey}-${nucleoNormalizado.toLowerCase().replace(/\s+/g, "-")}`,
            label: `${state.curso} · ${ambito.nombre} · ${nucleo.nombre}`,
            oaIds,
          },
        ]
      }
    }

    return []
  }

  const raw = record.raw as StandardCurriculumFile

  if (record.sharedBaseKey) {
    const sharedOAs = getOAs(state.nivel, state.curso, state.asignatura)
    const grouped = new Map<string, PlannerUnit>()

    for (const oa of sharedOAs) {
      const id = oa.unidadId || "modulo"
      const prev = grouped.get(id)

      if (prev) {
        if (!prev.oaIds.includes(oa.id)) prev.oaIds.push(oa.id)
      } else {
        grouped.set(id, {
          id,
          label: oa.unidadNombre || id,
          oaIds: [oa.id],
        })
      }
    }

    return [...grouped.values()]
  }

  if (raw.unidades?.length) {
    return raw.unidades.map((unidad) => {
      const numero = getUnidadNumero(unidad)
      const nombre = getUnidadNombre(unidad)

      return {
        id: getUnidadId(unidad),
        label: numero ? `Unidad ${numero} · ${nombre}` : nombre,
        oaIds: (unidad.oa || []).map((item) => item.id),
      }
    })
  }

  if (raw.modulos?.length) {
    return raw.modulos.map((modulo) => ({
      id: modulo.id,
      label: `Módulo · ${modulo.nombre}`,
      oaIds: (modulo.oa || []).map((item) => item.id),
    }))
  }

  return []
}

// Parvularia: getOAs() ya devuelve OA integrados de todo el subnivel/curso, por lo que aquí se pueden combinar OA de varios núcleos.
export function getPlannerOAOptions(state: PlannerCurriculumState, selectedUnitId?: string): OA[] {
  const all = getOAs(state.nivel, state.curso, state.asignatura)
  if (!selectedUnitId) return all

  return all.filter((oa) => {
    if (state.nivel === "parvularia") return true
    if (oa.unidadId) return oa.unidadId === selectedUnitId
    return false
  })
}

export function getParvulariaAmbito(curso: string, asignatura: string): string {
  return getParvulariaAmbitoForCurso(curso, asignatura)
}

export function getParvulariaOAT(curso: string, asignatura: string): PlannerOption[] {
  return getParvulariaOATForCurso(curso, asignatura)
}

export function buildSelectedOAContext(
  state: PlannerCurriculumState,
  selectedOAIds: string[] = [],
  selectedUnitId?: string
) {
  const oaOptions = getPlannerOAOptions(state, selectedUnitId)
  const picked = selectedOAIds.length
    ? oaOptions.filter((oa) => selectedOAIds.includes(oa.id))
    : oaOptions

  if (!picked.length) return ""

  const units = getPlannerUnits(state)
  const unit = units.find((u) => u.id === selectedUnitId)

  const lines = picked.map((oa) => {
    const extra: string[] = []
    if (oa.codigoOficial) extra.push(oa.codigoOficial)
    if (oa.unidadNombre) extra.push(`Unidad/Módulo: ${oa.unidadNombre}`)
    if (oa.ambito) extra.push(`Ámbito: ${oa.ambito}`)
    if (oa.nucleo) extra.push(`Núcleo: ${oa.nucleo}`)
    if (oa.verificationStatus !== "verificado_oficial") {
      extra.push(oa.verificationLabel || "Pendiente de verificación oficial")
    }

    return `- ${oa.id}: ${oa.texto}${extra.length ? ` [${extra.join(" · ")}]` : ""}`
  })

  return [
    unit ? `UNIDAD CURRICULAR SELECCIONADA: ${unit.label}` : "",
    `OA SELECCIONADOS (${picked.length}):`,
    ...lines,
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildPlanningHorizonText(
  tiempo: TiempoPlanificacion,
  sesiones?: number | string,
  duracion?: number | string,
  periodoLabel?: string
) {
  const sesionesNum = Number(sesiones || 0)
  const duracionNum = Number(duracion || 0)
  const config = getPlanningHorizonConfig(tiempo)

  const extra = [
    periodoLabel ? `Periodo: ${periodoLabel}.` : "",
    sesionesNum > 0 ? `Cantidad de sesiones estimadas: ${sesionesNum}.` : "",
    duracionNum > 0 ? `Duración referencial por sesión: ${duracionNum} minutos.` : "",
    config.expectedStructure.length ? `Debe incluir: ${config.expectedStructure.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ")

  return `${config.label}: ${config.description}${extra ? ` ${extra}` : ""}`
}

export function hasLocalCurriculum(state: PlannerCurriculumState) {
  return getPlannerOAOptions(state).length > 0
}

export function getPlannerSummary(state: PlannerCurriculumState) {
  const units = getPlannerUnits(state)
  const oas = getPlannerOAOptions(state)

  return {
    hasCurriculum: oas.length > 0,
    units: units.length,
    oas: oas.length,
  }
}
