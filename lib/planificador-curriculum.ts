import { getOAs, cursoToKey, normalizeAsignatura, type NivelKey, type OA } from "@/lib/mineduc-oa"

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

const UNITS_MAP: Record<string, PlannerUnit[]> = {
  "media|1M|Matemática": [
    { id: "u1", label: "Unidad 1 · Productos notables, potencias con exponente entero y cono", oaIds: ["OA1", "OA2", "OA3", "OA7"] },
    { id: "u2", label: "Unidad 2 · Sistemas de ecuaciones lineales y geometría del círculo", oaIds: ["OA4", "OA5", "OA6"] },
    { id: "u3", label: "Unidad 3 · Homotecia y sus aplicaciones", oaIds: ["OA8", "OA9", "OA10"] },
    { id: "u4", label: "Unidad 4 · Nube de puntos, gráficos xy y probabilidad", oaIds: ["OA11", "OA12", "OA13", "OA14", "OA15"] },
  ],
}

const PARVULARIA_AMBITOS: Record<string, string> = {
  "Identidad y Autonomía": "Desarrollo Personal y Social",
  "Convivencia y Ciudadanía": "Desarrollo Personal y Social",
  "Corporalidad y Movimiento": "Desarrollo Personal y Social",
  "Lenguaje Verbal": "Comunicación Integral",
  "Lenguajes Artísticos": "Comunicación Integral",
  "Exploración del Entorno Natural": "Interacción y Comprensión del Entorno",
  "Pensamiento Matemático": "Interacción y Comprensión del Entorno",
  "Comprensión del Entorno Sociocultural": "Interacción y Comprensión del Entorno",
}

const PARVULARIA_OAT: Record<string, PlannerOption[]> = {
  "Identidad y Autonomía": [
    { id: "OAT-IA-01", label: "Favorecer progresivamente la autonomía, la identidad positiva y el autocuidado." },
    { id: "OAT-IA-02", label: "Promover la expresión y regulación de emociones, necesidades e intereses en contextos de juego y convivencia." },
  ],
  "Convivencia y Ciudadanía": [
    { id: "OAT-CC-01", label: "Desarrollar actitudes de respeto, colaboración, participación y resolución pacífica de conflictos." },
    { id: "OAT-CC-02", label: "Fortalecer la pertenencia al grupo y la valoración de la diversidad cultural y social." },
  ],
  "Corporalidad y Movimiento": [
    { id: "OAT-CM-01", label: "Promover el bienestar integral, el cuidado del cuerpo y la exploración motriz segura." },
    { id: "OAT-CM-02", label: "Favorecer hábitos de vida activa, coordinación y confianza corporal." },
  ],
  "Lenguaje Verbal": [
    { id: "OAT-LV-01", label: "Potenciar la comunicación oral, la escucha activa y el gusto por interactuar mediante lenguaje verbal." },
    { id: "OAT-LV-02", label: "Promover la iniciación a la lectura y escritura emergente en contextos significativos." },
  ],
  "Lenguajes Artísticos": [
    { id: "OAT-LA-01", label: "Favorecer la expresión creativa mediante música, artes visuales, corporalidad y juego dramático." },
    { id: "OAT-LA-02", label: "Estimular la apreciación estética, la imaginación y la comunicación de ideas y emociones." },
  ],
  "Exploración del Entorno Natural": [
    { id: "OAT-EN-01", label: "Promover la curiosidad científica, la observación y el cuidado del entorno natural." },
    { id: "OAT-EN-02", label: "Favorecer experiencias de indagación, comparación y explicación inicial del medio natural." },
  ],
  "Pensamiento Matemático": [
    { id: "OAT-PM-01", label: "Desarrollar nociones matemáticas tempranas a partir del juego, la resolución de problemas y la representación." },
    { id: "OAT-PM-02", label: "Estimular relaciones de cantidad, patrón, medida, espacio y datos en situaciones cotidianas." },
  ],
  "Comprensión del Entorno Sociocultural": [
    { id: "OAT-ES-01", label: "Promover el reconocimiento de la comunidad, tradiciones, roles y patrimonio cultural." },
    { id: "OAT-ES-02", label: "Favorecer la comprensión del entorno social desde experiencias cercanas, participación y diálogo." },
  ],
}

export function getCurriculumIdentity({ nivel, curso, asignatura }: PlannerCurriculumState) {
  const cursoKey = cursoToKey(curso)
  const asigKey = normalizeAsignatura(asignatura, nivel)
  return { cursoKey, asigKey, mapKey: `${nivel}|${cursoKey}|${asigKey}` }
}

export function getPlannerUnits(state: PlannerCurriculumState): PlannerUnit[] {
  const { mapKey } = getCurriculumIdentity(state)
  return UNITS_MAP[mapKey] || []
}

export function getPlannerOAOptions(state: PlannerCurriculumState, selectedUnitId?: string): OA[] {
  const all = getOAs(state.nivel, state.curso, state.asignatura)
  if (!selectedUnitId) return all
  const unit = getPlannerUnits(state).find(u => u.id === selectedUnitId)
  if (!unit) return all
  return all.filter(oa => unit.oaIds.includes(oa.id))
}

export function getParvulariaAmbito(asignatura: string): string {
  return PARVULARIA_AMBITOS[asignatura] || ""
}

export function getParvulariaOAT(asignatura: string): PlannerOption[] {
  return PARVULARIA_OAT[asignatura] || []
}

export function buildSelectedOAContext(state: PlannerCurriculumState, selectedOAIds: string[] = [], selectedUnitId?: string) {
  const oaOptions = getPlannerOAOptions(state, selectedUnitId)
  const picked = selectedOAIds.length ? oaOptions.filter(oa => selectedOAIds.includes(oa.id)) : oaOptions
  if (!picked.length) return ""

  const units = getPlannerUnits(state)
  const unit = units.find(u => u.id === selectedUnitId)
  const lines = picked.map(oa => `- ${oa.id}: ${oa.texto}${oa.ejes?.length ? ` [${oa.ejes.join(", ")}]` : ""}`)

  return [
    unit ? `UNIDAD CURRICULAR SELECCIONADA: ${unit.label}` : "",
    `OA SELECCIONADOS (${picked.length}):`,
    ...lines,
  ].filter(Boolean).join("\n")
}

export function buildPlanningHorizonText(tiempo: TiempoPlanificacion, sesiones?: number | string, duracion?: number | string) {
  const sesionesNum = Number(sesiones || 0)
  const duracionNum = Number(duracion || 0)
  const base = tiempo === "diaria"
    ? "Planificación diaria: diseña una secuencia completa para una clase."
    : tiempo === "semanal"
      ? "Planificación semanal: distribuye objetivos y actividades por sesión durante la semana."
      : "Planificación mensual: organiza una progresión de aprendizajes por varias semanas."

  const extra = [
    sesionesNum > 0 ? `Cantidad de sesiones estimadas: ${sesionesNum}.` : "",
    duracionNum > 0 ? `Duración referencial por sesión: ${duracionNum} minutos.` : "",
  ].filter(Boolean).join(" ")

  return `${base}${extra ? ` ${extra}` : ""}`
}
