export type ParvulariaPlanningHorizon = "diaria" | "semanal" | "quincenal" | "mensual" | "semestral"

export interface ParvulariaPlanningRow {
  jornada: string
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
  jornada: "",
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

function row(value: unknown, index: number): ParvulariaPlanningRow | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  return {
    jornada: text(raw.jornada) || `Jornada ${index + 1}`,
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
  const rows = Array.isArray(raw.filas) ? raw.filas.map((item, index) => row(item, index)).filter((item): item is ParvulariaPlanningRow => Boolean(item)) : []

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
    filas: rows.length
      ? rows
      : defaults.filas?.length
        ? defaults.filas.map((item, index) => ({ ...item, jornada: item.jornada || `Jornada ${index + 1}` }))
        : [{ ...EMPTY_ROW, jornada: "Jornada 1" }],
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

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "")
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function addCalendarMonthsInclusive(date: Date, months: number) {
  const originalDay = date.getUTCDate()
  const absoluteMonth = date.getUTCFullYear() * 12 + date.getUTCMonth() + months
  const year = Math.floor(absoluteMonth / 12)
  const month = absoluteMonth % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  if (originalDay > lastDay) return new Date(Date.UTC(year, month, lastDay))
  const exclusive = new Date(Date.UTC(year, month, originalDay))
  exclusive.setUTCDate(exclusive.getUTCDate() - 1)
  return exclusive
}

function localDate(value: string) {
  const date = parseIsoDate(value)
  if (!date) return value || ""
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function calculateParvulariaEndDate(start: string, planningHorizon: ParvulariaPlanningHorizon) {
  const date = parseIsoDate(start)
  if (!date) return ""
  if (planningHorizon === "diaria") return start
  if (planningHorizon === "semanal") return isoDate(addDays(date, 6))
  if (planningHorizon === "quincenal") return isoDate(addDays(date, 14))
  if (planningHorizon === "mensual") return isoDate(addCalendarMonthsInclusive(date, 1))
  return isoDate(addCalendarMonthsInclusive(date, 6))
}

function shortDayLabel(date: Date) {
  const weekday = new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "long" }).format(date)
  const dayMonth = new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", day: "2-digit", month: "long" }).format(date)
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${dayMonth}`
}

export function buildParvulariaPeriodGuide(
  start: string,
  end: string,
  planningHorizon: ParvulariaPlanningHorizon
) {
  const first = parseIsoDate(start)
  const last = parseIsoDate(end || start)
  if (!first || !last || last < first) return ""

  if (planningHorizon === "diaria") return `Experiencia de la jornada: ${shortDayLabel(first)}.`

  const days: Date[] = []
  for (let cursor = new Date(first.getTime()); cursor <= last && days.length < 370; cursor = addDays(cursor, 1)) {
    days.push(new Date(cursor.getTime()))
  }

  if (planningHorizon === "semanal" || planningHorizon === "quincenal") {
    const weekdays = days.filter((date) => {
      const weekday = date.getUTCDay()
      return weekday !== 0 && weekday !== 6
    })
    return [
      "Genera una experiencia distinta y concreta para cada día hábil del período (lunes a viernes).",
      ...weekdays.map((date, index) => `${index + 1}. ${shortDayLabel(date)}`),
      "Si existe un feriado institucional, el docente podrá editar esa fecha posteriormente; no dejes días hábiles sin experiencia.",
    ].join("\n")
  }

  if (planningHorizon === "mensual") {
    const weeks: string[] = []
    let week = 1
    for (let index = 0; index < days.length; index += 7) {
      const slice = days.slice(index, index + 7)
      if (!slice.length) continue
      weeks.push(`Semana ${week}: ${shortDayLabel(slice[0])} a ${shortDayLabel(slice[slice.length - 1])}`)
      week += 1
    }
    return [
      "Organiza el mes por semanas y, dentro de cada semana, propone experiencias concretas para los días hábiles.",
      ...weeks,
    ].join("\n")
  }

  const months: string[] = []
  const seen = new Set<string>()
  for (const date of days) {
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    if (seen.has(key)) continue
    seen.add(key)
    months.push(new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", month: "long", year: "numeric" }).format(date))
  }
  return [
    "Organiza el semestre por meses y semanas, mostrando progresión de experiencias y OA sin convertirlo en bloques horarios.",
    ...months.map((month, index) => `${index + 1}. ${month.charAt(0).toUpperCase() + month.slice(1)}`),
  ].join("\n")
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
