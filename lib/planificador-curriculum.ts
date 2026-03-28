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

export type TiempoPlanificacion = "diaria" | "semanal" | "mensual"

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
}

interface RawUnidad {
  numero?: number
  id?: string
  nombre: string
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
    return raw.unidades.map((unidad) => ({
      id: unidad.id || `u${String(unidad.numero ?? "").trim()}`,
      label: unidad.numero ? `Unidad ${unidad.numero} · ${unidad.nombre}` : unidad.nombre,
      oaIds: (unidad.oa || []).map((item) => item.id),
    }))
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
  duracion?: number | string
) {
  const sesionesNum = Number(sesiones || 0)
  const duracionNum = Number(duracion || 0)

  const base =
    tiempo === "diaria"
      ? "Planificación diaria: diseña una secuencia completa para una clase."
      : tiempo === "semanal"
        ? "Planificación semanal: distribuye objetivos y actividades por sesión durante la semana."
        : "Planificación mensual: organiza una progresión de aprendizajes por varias semanas."

  const extra = [
    sesionesNum > 0 ? `Cantidad de sesiones estimadas: ${sesionesNum}.` : "",
    duracionNum > 0 ? `Duración referencial por sesión: ${duracionNum} minutos.` : "",
  ]
    .filter(Boolean)
    .join(" ")

  return `${base}${extra ? ` ${extra}` : ""}`
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
