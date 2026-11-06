import { generationFingerprint, stableJson } from "./fingerprint"

export const PLANNING_LIBRARY_VERSION = 1
export const PRESENTATION_FIELDS = ["profesor", "educadoraParvularia", "asistentesParvularia"] as const
const OMIT = new Set(["content", "planning_text", "title", "created_at", "updated_at", "folder_organization", "plan_mode", "_eduaiReuse", "generationRunId"])
const ALIASES: Record<string, string> = {
  unidad_id: "unidadId", selected_oa_ids: "selectedOAIds", selected_oat_ids: "selectedOATIds",
  tiempo_planificacion: "tiempoPlanificacion", duracion_minutos: "duracionMinutos",
}

export function planningConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (!OMIT.has(key) && !(PRESENTATION_FIELDS as readonly string[]).includes(key) && !(key in ALIASES)) result[key] = value
  }
  for (const [alias, key] of Object.entries(ALIASES)) if (alias in config) result[key] = config[alias]
  for (const key of ["selectedOAIds", "selectedOATIds"]) {
    if (Array.isArray(result[key])) result[key] = [...new Set((result[key] as unknown[]).filter((x) => typeof x === "string"))].sort()
  }
  return result
}

export type PlanningIdentity = {
  key: string
  curriculumHash: string
  requestConfig: Record<string, unknown>
  module: string
}

export function planningIdentity(input: {
  module: string
  config: Record<string, unknown>
  resolved?: Record<string, unknown>
  message: string
  history: unknown[]
  curriculum: unknown
}): PlanningIdentity {
  const curriculumHash = generationFingerprint({ capability: "curriculum", payload: input.curriculum })
  return {
    key: generationFingerprint({ capability: "planning-library", schemaVersion: PLANNING_LIBRARY_VERSION, payload: {
      module: input.module, config: planningConfig(input.config), resolved: input.resolved || {},
      message: canonicalPresentation(input.message, input.config),
      history: input.history.map((item) => {
        if (!item || typeof item !== "object") return item
        const value = item as Record<string, unknown>
        return { role: value.role, content: typeof value.content === "string" ? canonicalPresentation(value.content, input.config) : value.content }
      }), curriculumHash,
      promptRevision: process.env.EDUAI_DOCUMENT_LIBRARY_REVISION || "2026-11-06-v1",
    } }),
    curriculumHash, requestConfig: input.config, module: input.module,
  }
}

/** Saved edits are reusable only while their pedagogical configuration still matches. */
export function samePlanningConfig(saved: Record<string, unknown>, original: Record<string, unknown>): boolean {
  const expected = planningConfig(original)
  const current = planningConfig(saved)
  const projected = Object.fromEntries(Object.keys(expected).map((key) => [key, current[key]]))
  return stableJson(projected) === stableJson(expected)
}

export function renderPlanningPresentation(text: string, previous: Record<string, unknown>, current: Record<string, unknown>): string | null {
  let output = text
  for (const key of PRESENTATION_FIELDS) {
    const before = typeof previous[key] === "string" ? previous[key].trim() : ""
    const after = typeof current[key] === "string" ? current[key].trim() : ""
    if (before === after) continue
    // Empty fields cannot be filled safely in an arbitrary Markdown/table document.
    if (!before || !after) return null
    const escaped = before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    output = output.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "gu"), () => after)
  }
  return output
}

function canonicalPresentation(text: string, config: Record<string, unknown>): string {
  const placeholders = Object.fromEntries(PRESENTATION_FIELDS.filter((key) => typeof config[key] === "string" && config[key].trim()).map((key) => [key, `__EDUAI_${key}__`]))
  return renderPlanningPresentation(text, config, { ...config, ...placeholders }) || text
}
