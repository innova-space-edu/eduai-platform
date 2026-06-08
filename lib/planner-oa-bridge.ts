import { getPlannerOAOptions, getPlannerSummary } from "@/lib/planificador-curriculum"
import type { NivelKey, OA } from "@/lib/mineduc-oa"
import { OA_SYNONYMS } from "@/lib/planner-oa-synonyms"

interface CurriculumState {
  nivel: NivelKey
  curso: string
  asignatura: string
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()
}

function keywords(value: string) {
  const source = normalize(value).split(/\s+/).filter((token) => token.length >= 4)
  const expanded = new Set(source)
  for (const token of source) {
    if (token.endsWith("es") && token.length > 5) expanded.add(token.slice(0, -2))
    if (token.endsWith("s") && token.length > 4) expanded.add(token.slice(0, -1))
    for (const [root, related] of Object.entries(OA_SYNONYMS)) {
      if (token === root || related.includes(token)) {
        expanded.add(root)
        related.forEach((item) => expanded.add(item))
      }
    }
  }
  return expanded
}

function relevance(oa: OA, query: Set<string>) {
  const corpus = keywords(`${oa.codigoOficial || ""} ${oa.texto} ${(oa.ejes || []).join(" ")} ${(oa.habilidades || []).join(" ")} ${oa.unidadNombre || ""} ${oa.ambito || ""} ${oa.nucleo || ""}`)
  let score = 0
  for (const token of query) if (corpus.has(token)) score += token.length >= 7 ? 3 : 1
  return score
}

export function resolveOAConnection(params: {
  state: CurriculumState
  unidadId?: string
  selectedOAIds?: string[]
  userText: string
}) {
  const all = getPlannerOAOptions(params.state, params.unidadId || undefined)
  const selectedIds = new Set(params.selectedOAIds || [])
  const manuallySelected = all.filter((oa) => selectedIds.has(oa.id))
  const query = keywords(params.userText)
  const ranked = all
    .map((oa) => ({ oa, score: relevance(oa, query) }))
    .sort((a, b) => b.score - a.score)
  const automatic = manuallySelected.length
    ? []
    : ranked.filter((item) => item.score > 0).slice(0, params.state.nivel === "parvularia" ? 3 : 4).map((item) => item.oa)
  const resolved = manuallySelected.length ? manuallySelected : automatic
  const summary = getPlannerSummary(params.state)

  return {
    all,
    resolved,
    resolvedOAIds: resolved.map((oa) => oa.id),
    manuallySelected: manuallySelected.length > 0,
    autoSelected: automatic.length > 0,
    summary,
  }
}

export function buildConnectedOAContext(params: ReturnType<typeof resolveOAConnection>) {
  if (!params.resolved.length) {
    return `CONEXIÓN OA LOCAL: la base curricular local contiene ${params.summary.oas} OA para esta combinación, pero no se seleccionó ni detectó uno pertinente. No inventes códigos ni textos oficiales. Indica al docente que puede seleccionar OA desde el panel.`
  }

  const mode = params.manuallySelected ? "seleccionados manualmente por el docente" : "sugeridos automáticamente desde la base OA local según el contexto"
  return [
    `CONEXIÓN OA LOCAL ACTIVA: ${params.resolved.length} OA ${mode}.`,
    "Usa exclusivamente estos OA oficiales como respaldo curricular. No inventes OA adicionales:",
    ...params.resolved.map((oa) => `- ${oa.codigoOficial || oa.id}: ${oa.texto}${oa.unidadNombre ? ` [${oa.unidadNombre}]` : ""}${oa.ambito ? ` [Ámbito: ${oa.ambito}${oa.nucleo ? ` · Núcleo: ${oa.nucleo}` : ""}]` : ""}`),
  ].join("\n")
}
