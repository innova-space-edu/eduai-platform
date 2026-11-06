export const PARVULARIA_CONTENT_FIELDS = ["experienciaAprendizaje", "orientacionesRelevantes", "rolEquipoFamilia", "recursos", "evaluacion"] as const
export type ParvulariaContentField = typeof PARVULARIA_CONTENT_FIELDS[number]

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

export function mentionedJourneyIndices(value: string): number[] {
  const text = normalize(value)
  const indices = [...text.matchAll(/\bjornadas?\s*([123](?:\s*(?:,|y|e)\s*[123])*)\b/g)]
    .flatMap((match) => [...match[1].matchAll(/[123]/g)].map((number) => Number(number[0]) - 1))
  for (const [word, index] of [["primera", 0], ["segunda", 1], ["tercera", 2]] as const) {
    if (text.includes(`${word} jornada`) || text.includes(`jornada ${word}`)) indices.push(index)
  }
  return [...new Set(indices)].sort()
}

export function partialParvulariaScope(message: string) {
  const journeyIndices = mentionedJourneyIndices(message)
  if (!journeyIndices.length || journeyIndices.length === 3) return null
  const text = normalize(message)
  // Global or curricular edits require the complete validated flow.
  if (/\b(todas|completa|global|oa|oat|nucleo|nivel|curso|fechas?|periodo|horizonte)\b/.test(text)) return null
  const fields: ParvulariaContentField[] = []
  if (/\b(recursos?|materiales?)\b/.test(text)) fields.push("recursos")
  if (/\b(evaluacion|indicadores?|instrumento)\b/.test(text)) fields.push("evaluacion")
  if (/\b(experiencias?|actividades?|desarrollo|inicio|cierre)\b/.test(text)) fields.push("experienciaAprendizaje")
  if (/\b(orientaciones?|mediacion)\b/.test(text)) fields.push("orientacionesRelevantes")
  if (/\b(familia|equipo|roles?)\b/.test(text)) fields.push("rolEquipoFamilia")
  return { journeyIndices, fields: /\b(solo|solamente|unicamente|exclusivamente)\b/.test(text) && fields.length ? fields : [...PARVULARIA_CONTENT_FIELDS] }
}

export function mergeParvulariaFields<T extends Record<ParvulariaContentField, string>>(
  previous: T, replacement: Record<string, unknown>, fields: readonly ParvulariaContentField[],
): T {
  const merged = { ...previous }
  for (const field of fields) {
    if (!PARVULARIA_CONTENT_FIELDS.includes(field)) throw new Error("Campo de planificación no permitido")
    const value = replacement[field]
    if (typeof value !== "string" || !value.trim()) throw new Error(`La jornada no entregó el campo ${field}.`)
    merged[field] = value.trim() as T[typeof field]
  }
  return merged
}

export function localJourneyBlueprint(input: {
  index: number; nucleus: string; horizon: string; references: Array<{ id: string; topic?: string | null }>;
}) {
  // Coordination data already exists; the journey model still performs pedagogical design.
  const organizations = ["exploración y elección individual acompañada", "interacción y construcción en grupos pequeños", "representación, comunicación y transferencia a una situación cotidiana"]
  return JSON.stringify({ version: 1, journey: input.index + 1, nucleus: input.nucleus,
    horizon: input.horizon, organization: organizations[input.index % organizations.length], organizationIsSuggestion: true,
    references: input.references.slice(0, 6).map((item) => ({ id: item.id, idea: item.topic || "Referencia compatible" })),
    design: "Diseña actividades propias con preparación, acción infantil, mediación, cierre y evidencia. Varía mecánica por fecha y complejidad por edad. No copies una referencia completa." })
}

export function compatiblePartialDocument(document: {
  nivelEducativo: string; fechas: string; horizonte?: string;
  filas: Array<Record<ParvulariaContentField, string> & { jornada: string; objetivosAprendizajes: string }>;
}, expected: { level: string; dates: string; horizon: string; journeys: Array<{ nucleus: string; objectives: string }> }) {
  const clean = (value: string) => value.replace(/\s+/g, " ").trim()
  return document.nivelEducativo === expected.level && document.fechas === expected.dates &&
    document.horizonte === expected.horizon && document.filas.length === 3 && expected.journeys.length === 3 &&
    document.filas.every((row, index) => row.jornada.includes(expected.journeys[index].nucleus) &&
      clean(row.objetivosAprendizajes) === clean(expected.journeys[index].objectives) &&
      PARVULARIA_CONTENT_FIELDS.every((field) => typeof row[field] === "string" && row[field].trim().length > 0))
}
