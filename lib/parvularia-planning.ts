export type ParvulariaPlanningHorizon = "diaria" | "semanal" | "quincenal" | "mensual" | "semestral"

export interface ParvulariaPlanningRow {
  ambitoNucleo: string
  objetivosAprendizajes: string
  experienciaAprendizaje: string
  orientacionesRelevantes: string
  rolEquipoFamilia: string
  recursos: string
  evaluacion: string
}

export interface ParvulariaPlanningDocument {
  version: 1
  tipo: "parvularia_institucional"
  titulo: string
  nivelEducativo: string
  fechas: string
  educadoraParvulos: string
  asistentesParvulos: string
  objetivoAprendizaje: string
  principioJuego: string
  principioActividad: string
  focoExperiencia: string
  horizonte: ParvulariaPlanningHorizon
  filas: ParvulariaPlanningRow[]
}

const EMPTY_ROW: ParvulariaPlanningRow = {
  ambitoNucleo: "",
  objetivosAprendizajes: "",
  experienciaAprendizaje: "",
  orientacionesRelevantes: "",
  rolEquipoFamilia: "",
  recursos: "",
  evaluacion: "",
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function horizon(value: unknown): ParvulariaPlanningHorizon {
  return value === "diaria" || value === "semanal" || value === "quincenal" || value === "mensual" || value === "semestral"
    ? value
    : "diaria"
}

function row(value: unknown): ParvulariaPlanningRow | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  return {
    ambitoNucleo: text(raw.ambitoNucleo),
    objetivosAprendizajes: text(raw.objetivosAprendizajes),
    experienciaAprendizaje: text(raw.experienciaAprendizaje),
    orientacionesRelevantes: text(raw.orientacionesRelevantes),
    rolEquipoFamilia: text(raw.rolEquipoFamilia),
    recursos: text(raw.recursos),
    evaluacion: text(raw.evaluacion),
  }
}

export function normalizeParvulariaPlanningDocument(
  value: unknown,
  defaults: Partial<ParvulariaPlanningDocument> = {}
): ParvulariaPlanningDocument {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const rows = Array.isArray(raw.filas) ? raw.filas.map(row).filter((item): item is ParvulariaPlanningRow => Boolean(item)) : []

  return {
    version: 1,
    tipo: "parvularia_institucional",
    titulo: text(raw.titulo) || defaults.titulo || "Planificación de Educación Parvularia",
    nivelEducativo: text(raw.nivelEducativo) || defaults.nivelEducativo || "",
    fechas: text(raw.fechas) || defaults.fechas || "",
    educadoraParvulos: text(raw.educadoraParvulos) || defaults.educadoraParvulos || "",
    asistentesParvulos: text(raw.asistentesParvulos) || defaults.asistentesParvulos || "",
    objetivoAprendizaje: text(raw.objetivoAprendizaje) || defaults.objetivoAprendizaje || "",
    principioJuego: text(raw.principioJuego) || defaults.principioJuego || "",
    principioActividad: text(raw.principioActividad) || defaults.principioActividad || "",
    focoExperiencia: text(raw.focoExperiencia) || defaults.focoExperiencia || "",
    horizonte: horizon(raw.horizonte || defaults.horizonte),
    filas: rows.length ? rows : defaults.filas?.length ? defaults.filas : [{ ...EMPTY_ROW }],
  }
}

function stripCodeFence(content: string) {
  const trimmed = String(content || "").trim()
  const fenced = trimmed.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i)
  return fenced ? fenced[1].trim() : trimmed
}

export function parseParvulariaPlanningDocument(content: string): ParvulariaPlanningDocument {
  const raw = stripCodeFence(content)
  let candidate = raw

  if (!candidate.startsWith("{")) {
    const start = candidate.indexOf("{")
    const end = candidate.lastIndexOf("}")
    if (start >= 0 && end > start) candidate = candidate.slice(start, end + 1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    throw new Error("La planificación parvularia no contiene el formato estructurado esperado.")
  }

  const doc = normalizeParvulariaPlanningDocument(parsed)
  if (!doc.filas.length) throw new Error("La planificación parvularia no contiene filas de planificación.")
  return doc
}

export function serializeParvulariaPlanningDocument(document: ParvulariaPlanningDocument) {
  return JSON.stringify(normalizeParvulariaPlanningDocument(document), null, 2)
}

function localDate(value: string) {
  if (!value) return ""
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function buildParvulariaDateLabel(start: string, end?: string) {
  const first = localDate(start)
  const last = localDate(end || start)
  if (!first) return ""
  if (!last || first === last) return first
  return `${first} al ${last}`
}

export function parvulariaHorizonLabel(value: ParvulariaPlanningHorizon) {
  const labels: Record<ParvulariaPlanningHorizon, string> = {
    diaria: "Diaria",
    semanal: "Semanal",
    quincenal: "Quincenal",
    mensual: "Mensual",
    semestral: "Semestral",
  }
  return labels[value]
}

export function isParvulariaPlanningContent(content: string) {
  try {
    const doc = parseParvulariaPlanningDocument(content)
    return doc.tipo === "parvularia_institucional"
  } catch {
    return false
  }
}
