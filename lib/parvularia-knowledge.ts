import type { SupabaseClient } from "@supabase/supabase-js"
import { embedParvulariaText } from "@/lib/parvularia-embeddings"

export type ParvulariaKnowledgeActivity = {
  id: string
  source_id?: string | null
  level?: string | null
  topic?: string | null
  sequence_label?: string | null
  day_label?: string | null
  ambito_nucleo?: string | null
  oa_text?: string | null
  oat_text?: string | null
  skill_text?: string | null
  experience_text: string
  inicio?: string | null
  desarrollo?: string | null
  cierre?: string | null
  evaluation?: string | null
  resources?: string | null
  tags?: string[] | null
  quality_score?: number | string | null
  search_text?: string | null
  embedding_model?: string | null
  keyword_rank?: number | string | null
  semantic_rank?: number | string | null
  hybrid_score?: number | string | null
}

type SavedPlanningRow = {
  id: string
  contexto?: string | null
  content?: string | null
  planning_text?: string | null
  planning_json?: Record<string, unknown> | null
  created_at?: string | null
}

type GenerationHistoryRow = {
  candidate_activity_ids?: string[] | null
  generated_content?: string | null
  activity_fingerprints?: string[] | null
  created_at?: string | null
}

type CorpusSourceRow = {
  id: string
  file_name?: string | null
  category?: string | null
  level?: string | null
  topic?: string | null
  raw_text?: string | null
  rank?: number | string | null
}

export type ParvulariaKnowledgeContext = {
  candidates: ParvulariaKnowledgeActivity[]
  savedPlanningCount: number
  generationHistoryCount: number
  cloudSourceCount: number
  recentContentSamples: string[]
  candidateIds: string[]
  journeyCandidateIds: string[][]
  journeyReferenceCounts: number[]
  prompt: string
  source: "hybrid_cloud" | "database" | "saved_plannings_only" | "none"
}

type BuildKnowledgeArgs = {
  supabase: SupabaseClient
  userId: string
  course: string
  topic: string
  message: string
  journeyNuclei: string[]
  selectedOAIds: string[]
  selectedOATIds: string[]
  journeyContexts?: string[]
  candidateLimit?: number
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const STOPWORDS = new Set([
  "para", "como", "con", "una", "uno", "unos", "unas", "del", "las", "los", "que",
  "por", "sus", "esta", "este", "estos", "estas", "desde", "sobre", "entre", "cada",
  "actividad", "actividades", "planificacion", "parvulos", "parvulas", "ninos", "ninas",
  "jornada", "experiencia", "desarrollo", "inicio", "cierre", "finalizacion",
])

function tokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
}

function tokenSet(value: string, cap = 180) {
  return new Set(tokens(value).slice(0, cap))
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const token of a) if (b.has(token)) intersection += 1
  return intersection / (a.size + b.size - intersection)
}

function truncate(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => (value || "").trim()).filter(Boolean))]
}

function activitySearchBody(activity: ParvulariaKnowledgeActivity) {
  return [
    activity.level,
    activity.topic,
    activity.sequence_label,
    activity.day_label,
    activity.ambito_nucleo,
    activity.oa_text,
    activity.oat_text,
    activity.skill_text,
    activity.experience_text,
    activity.evaluation,
    activity.resources,
    activity.search_text,
    ...(activity.tags || []),
  ].filter(Boolean).join(" ")
}

function relevanceScore(activity: ParvulariaKnowledgeActivity, queryTokens: string[], course: string) {
  const body = normalize(activitySearchBody(activity))
  const activityLevel = normalize(activity.level || "")
  const requestedLevel = normalize(course)
  let score = activityLevel === requestedLevel ? 18 : 0
  if (activityLevel.includes("sala cuna menor") && requestedLevel.includes("sala cuna menor")) score += 15
  else if (activityLevel.includes("sala cuna mayor") && requestedLevel.includes("sala cuna mayor")) score += 15
  else if (activityLevel.includes("medio menor") && requestedLevel.includes("medio menor")) score += 15
  else if (activityLevel.includes("medio mayor") && requestedLevel.includes("medio mayor")) score += 15
  else if (activityLevel.includes("nt1") && requestedLevel.includes("nt1")) score += 15
  else if (activityLevel.includes("nt2") && requestedLevel.includes("nt2")) score += 15
  else if (activityLevel === "sala cuna" && requestedLevel.includes("sala cuna")) score += 8

  for (const token of queryTokens) {
    if (!body.includes(token)) continue
    score += token.length >= 8 ? 4 : token.length >= 5 ? 2 : 1
  }

  const quality = Number(activity.quality_score || 0)
  if (Number.isFinite(quality)) score += Math.min(8, Math.max(0, quality))
  if ((activity.desarrollo || "").length >= 260) score += 3
  if ((activity.inicio || "").length >= 80 && (activity.cierre || "").length >= 60) score += 2
  return score
}

function savedPlanningText(row: SavedPlanningRow) {
  const jsonContent =
    row.planning_json && typeof row.planning_json.content === "string"
      ? row.planning_json.content
      : ""
  return row.content || row.planning_text || jsonContent || ""
}

function collectRecentSamples(
  saved: SavedPlanningRow[],
  history: GenerationHistoryRow[],
  maxSamples = 48,
) {
  const sources = [
    ...saved.map(savedPlanningText),
    ...history.map((row) => row.generated_content || ""),
    ...history.flatMap((row) => row.activity_fingerprints || []),
  ].filter((value) => value && value.trim())

  const samples: string[] = []
  for (const source of sources) {
    const compact = source.replace(/\s+/g, " ").trim()
    const fingerprints = fingerprintSentences(source)
    const fragments = fingerprints.length
      ? fingerprints.slice(0, 16)
      : compact.split(/(?<=[.!?])\s+/).filter((item) => item.length >= 120).slice(0, 6).map((item) => truncate(item, 600))

    for (const fragment of fragments) {
      if (!fragment || samples.some((item) => normalize(item) === normalize(fragment))) continue
      samples.push(fragment)
      if (samples.length >= maxSamples) return samples
    }
  }
  return samples
}

function selectDiverseCandidates(
  activities: ParvulariaKnowledgeActivity[],
  recentSamples: string[],
  reusedIds: Set<string>,
  queryTokens: string[],
  course: string,
  limit: number,
) {
  const recentSets = recentSamples.map((sample) => tokenSet(sample))
  const ranked = activities
    .map((activity) => {
      const set = tokenSet(activity.experience_text)
      const similarity = recentSets.reduce((max, recent) => Math.max(max, jaccard(set, recent)), 0)
      const reusedPenalty = reusedIds.has(activity.id) ? 18 : 0
      return {
        activity,
        set,
        similarity,
        score: relevanceScore(activity, queryTokens, course) + Number(activity.hybrid_score || 0) * 900 - similarity * 42 - reusedPenalty,
      }
    })
    .filter((item) => item.activity.experience_text.trim().length >= 140)
    .sort((a, b) => b.score - a.score)

  const selected: typeof ranked = []
  for (const candidate of ranked) {
    if (candidate.similarity >= 0.64) continue
    const nearDuplicate = selected.some((item) => jaccard(candidate.set, item.set) >= 0.58)
    if (nearDuplicate) continue
    selected.push(candidate)
    if (selected.length >= limit) break
  }

  if (selected.length < Math.min(6, limit)) {
    for (const candidate of ranked) {
      if (selected.some((item) => item.activity.id === candidate.activity.id)) continue
      selected.push(candidate)
      if (selected.length >= limit) break
    }
  }

  return selected.map((item) => item.activity)
}

export async function buildParvulariaKnowledgeContext(args: BuildKnowledgeArgs): Promise<ParvulariaKnowledgeContext> {
  const candidateLimit = Math.max(6, Math.min(18, args.candidateLimit || 12))
  const queryTokens = uniqueStrings([
    ...tokens(args.topic),
    ...tokens(args.message),
    ...args.journeyNuclei.flatMap(tokens),
    ...args.selectedOAIds.flatMap(tokens),
    ...args.selectedOATIds.flatMap(tokens),
  ]).slice(0, 70)

  const queryText = uniqueStrings([
    args.course,
    args.topic,
    args.message,
    ...args.journeyNuclei,
    ...args.selectedOAIds,
    ...args.selectedOATIds,
  ]).join(" ").slice(0, 7_500)
  const keywordQuery = queryTokens.slice(0, 24).join(" OR ") || queryText

  const basePerJourney = Math.floor(candidateLimit / 3)
  const remainder = candidateLimit % 3
  const journeyLimits = [0, 1, 2].map((index) => basePerJourney + (index < remainder ? 1 : 0))
  const journeySpecs = [0, 1, 2].map((index) => {
    const nucleus = args.journeyNuclei[index] || args.journeyNuclei[0] || ""
    const curriculumContext = args.journeyContexts?.[index] || ""
    const journeyQueryText = uniqueStrings([
      args.course,
      nucleus,
      curriculumContext,
      args.topic.length <= 500 ? args.topic : "",
    ]).join(" ").slice(0, 3_200)
    const journeyQueryTokens = uniqueStrings([
      ...tokens(nucleus),
      ...tokens(curriculumContext),
      ...(args.topic.length <= 500 ? tokens(args.topic) : []),
    ]).slice(0, 40)
    return {
      nucleus,
      queryText: journeyQueryText,
      queryTokens: journeyQueryTokens,
      keywordQuery: journeyQueryTokens.slice(0, 18).join(" OR ") || nucleus || keywordQuery,
    }
  })

  const savedPromise = args.supabase
    .from("saved_plannings")
    .select("id,contexto,content,planning_text,planning_json,created_at")
    .eq("user_id", args.userId)
    .eq("nivel", "parvularia")
    .order("created_at", { ascending: false })
    .limit(80)

  const historyPromise = args.supabase
    .from("parvularia_generation_history")
    .select("candidate_activity_ids,generated_content,activity_fingerprints,created_at")
    .eq("user_id", args.userId)
    .order("created_at", { ascending: false })
    .limit(24)

  const cloudSourcesPromise = args.supabase.rpc("search_parvularia_corpus_sources", {
    p_query: keywordQuery,
    p_level: args.course,
    p_limit: 6,
  })

  const embeddingsPromise = Promise.all(journeySpecs.map((spec) => embedParvulariaText(spec.queryText).catch(() => null)))

  const [savedResult, historyResult, cloudSourcesResult, journeyEmbeddings] = await Promise.all([
    savedPromise,
    historyPromise,
    cloudSourcesPromise,
    embeddingsPromise,
  ])

  const saved = (savedResult.error ? [] : savedResult.data || []) as SavedPlanningRow[]
  const history = (historyResult.error ? [] : historyResult.data || []) as GenerationHistoryRow[]
  const cloudSources = (cloudSourcesResult.error ? [] : cloudSourcesResult.data || []) as CorpusSourceRow[]

  const hybridResults = await Promise.all(
    journeySpecs.map((spec, index) =>
      args.supabase.rpc("search_parvularia_activities_hybrid", {
        p_query: spec.keywordQuery,
        p_query_embedding: journeyEmbeddings[index] ? "[" + journeyEmbeddings[index]!.join(",") + "]" : null,
        p_level: args.course,
        p_limit: Math.min(24, Math.max(journeyLimits[index] * 5, 12)),
      })
    )
  )

  let retrievedByJourney = hybridResults.map((result) =>
    (result.error ? [] : result.data || []) as ParvulariaKnowledgeActivity[]
  )
  let retrievalSource: "hybrid_cloud" | "database" = retrievedByJourney.some((items) => items.length)
    ? "hybrid_cloud"
    : "database"

  let fallbackActivities: ParvulariaKnowledgeActivity[] = []
  if (retrievedByJourney.some((items) => !items.length)) {
    const fallback = await args.supabase
      .from("parvularia_activity_bank")
      .select("id,source_id,level,topic,sequence_label,day_label,ambito_nucleo,oa_text,oat_text,skill_text,experience_text,inicio,desarrollo,cierre,evaluation,resources,tags,quality_score,search_text,embedding_model")
      .eq("active", true)
      .limit(500)
    fallbackActivities = (fallback.error ? [] : fallback.data || []) as ParvulariaKnowledgeActivity[]
    retrievedByJourney = retrievedByJourney.map((items) => items.length ? items : fallbackActivities)
  }

  const recentSamples = collectRecentSamples(saved, history)
  const reusedIds = new Set(history.flatMap((row) => row.candidate_activity_ids || []))
  const usedIds = new Set<string>()
  const selectedByJourney = journeySpecs.map((spec, index) => {
    const available = retrievedByJourney[index].filter((activity) => !usedIds.has(activity.id))
    const picked = selectDiverseCandidates(
      available,
      recentSamples,
      reusedIds,
      spec.queryTokens,
      args.course,
      journeyLimits[index],
    )
    picked.forEach((activity) => usedIds.add(activity.id))
    return picked
  })

  let selected = selectedByJourney.flat()
  if (selected.length < candidateLimit) {
    const union = [...retrievedByJourney.flat(), ...fallbackActivities]
      .filter((activity, index, array) => array.findIndex((candidate) => candidate.id === activity.id) === index)
      .filter((activity) => !usedIds.has(activity.id))
    const fill = selectDiverseCandidates(
      union,
      recentSamples,
      reusedIds,
      queryTokens,
      args.course,
      candidateLimit - selected.length,
    )
    fill.forEach((activity) => usedIds.add(activity.id))
    selected = [...selected, ...fill]
  }
  const referenceBlock = (activity: ParvulariaKnowledgeActivity, label: string) => [
    label + " · ID " + activity.id,
    "Nivel: " + (activity.level || "No informado") + " · Tema: " + (activity.topic || "No informado"),
    activity.ambito_nucleo ? "Ámbito/Núcleo: " + activity.ambito_nucleo : "",
    activity.oa_text ? "OA fuente: " + truncate(activity.oa_text, 260) : "",
    activity.oat_text ? "OAT fuente: " + truncate(activity.oat_text, 220) : "",
    activity.skill_text ? "Habilidad: " + truncate(activity.skill_text, 140) : "",
    "Experiencia fuente: " + truncate(activity.experience_text, 520),
    activity.resources ? "Recursos fuente: " + truncate(activity.resources, 180) : "",
    activity.evaluation ? "Evaluación fuente: " + truncate(activity.evaluation, 180) : "",
  ].filter(Boolean).join("\n")

  const references = selectedByJourney.map((activities, journeyIndex) => [
    "JORNADA " + (journeyIndex + 1) + " · " + (journeySpecs[journeyIndex].nucleus || "Núcleo seleccionado"),
    activities.length
      ? activities.map((activity, activityIndex) =>
          referenceBlock(activity, "REFERENCIA J" + (journeyIndex + 1) + "." + (activityIndex + 1))
        ).join("\n\n")
      : "Sin referencias específicas recuperadas para esta jornada.",
  ].join("\n")).join("\n\n")
  const cloudContext = cloudSources.slice(0, 3).map((source, index) => [
    `FUENTE CLOUD ${index + 1}: ${source.file_name || source.topic || "Documento Parvularia"}`,
    source.category ? `Tipo: ${source.category}` : "",
    source.topic ? `Tema: ${source.topic}` : "",
    source.raw_text ? truncate(source.raw_text, 420) : "",
  ].filter(Boolean).join("\n")).join("\n\n")

  const recent = recentSamples.slice(0, 6).map((sample, index) =>
    `YA UTILIZADO ${index + 1}: ${truncate(sample, 320)}`
  ).join("\n")

  const prompt = [
    "═══════════════════════════════════════════════",
    "BIBLIOTECA PEDAGÓGICA PARVULARIA · EDUAI CLOUD",
    "═══════════════════════════════════════════════",
    selected.length
      ? "Las referencias fueron recuperadas POR JORNADA con búsqueda híbrida (texto + significado) y filtros por subnivel. Usa cada grupo prioritariamente para la jornada indicada. Son referencias de profundidad, mediación, materiales y nivel de desarrollo: NO las copies literalmente; combina, transforma y crea actividades nuevas coherentes con los OA/OAT seleccionados."
      : "La biblioteca estructurada todavía no tiene referencias compatibles para esta solicitud.",
    references,
    "═══════════════════════════════════════════════",
    "CONTEXTO PEDAGÓGICO COMPLEMENTARIO · FUENTES CLOUD",
    "═══════════════════════════════════════════════",
    cloudContext || "No se encontraron documentos complementarios relevantes para esta solicitud.",
    "Usa este contexto solo cuando sea pertinente. Los OA/OAT oficiales seleccionados tienen prioridad sobre cualquier documento del corpus.",
    "═══════════════════════════════════════════════",
    "MEMORIA ANTIRREPETICIÓN",
    "═══════════════════════════════════════════════",
    saved.length
      ? `Se revisaron ${saved.length} planificaciones parvularias guardadas por este usuario.`
      : "No hay planificaciones parvularias guardadas disponibles para comparar.",
    history.length
      ? `Se revisaron ${history.length} generaciones recientes adicionales.`
      : "No hay historial adicional disponible.",
    recent
      ? `Evita repetir estas mecánicas, secuencias o combinaciones casi iguales:\n${recent}`
      : "No hay fragmentos previos que deban excluirse.",
    "REGLAS DE DIVERSIDAD:",
    "- Las 3 jornadas deben usar mecánicas distintas entre sí.",
    "- No repitas una actividad previa cambiando solo el material, color, personaje o nombre.",
    "- Cambia de manera sustantiva la acción infantil, mediación adulta, disposición del espacio, recursos y evidencia observable.",
    "- Si una referencia del banco se parece a una planificación reciente, prefiere otra referencia.",
    "- Mantén actividades concretas y detalladas: acción del párvulo + material/espacio + mediación + propósito/evidencia.",
  ].filter(Boolean).join("\n")

  return {
    candidates: selected,
    savedPlanningCount: saved.length,
    generationHistoryCount: history.length,
    cloudSourceCount: cloudSources.length,
    recentContentSamples: recentSamples,
    candidateIds: selected.map((activity) => activity.id),
    journeyCandidateIds: selectedByJourney.map((items) => items.map((activity) => activity.id)),
    journeyReferenceCounts: selectedByJourney.map((items) => items.length),
    prompt,
    source: selected.length ? retrievalSource : saved.length || history.length ? "saved_plannings_only" : "none",
  }
}

function structuredActivityFingerprints(content: string) {
  try {
    const parsed = JSON.parse(content) as { filas?: Array<{ experienciaAprendizaje?: unknown }> }
    if (!Array.isArray(parsed.filas)) return []

    const activities: string[] = []
    for (const row of parsed.filas) {
      const experience = typeof row?.experienciaAprendizaje === "string" ? row.experienciaAprendizaje : ""
      const development = experience.match(/desarrollo\s*:\s*([\s\S]*?)(?=\n?\s*finalizaci[oó]n\s*:|$)/i)?.[1] || ""
      const lines = development.split(/\n+/).map((line) => line.trim()).filter(Boolean)

      for (const line of lines) {
        const withoutBullet = line.replace(/^[•·*Ø\-–—]+\s*/, "").trim()
        if (!withoutBullet) continue
        if (/^(?:edades?.*|sala cuna (?:menor|mayor)|nivel (?:medio|transici[oó]n))\s*:?\s*$/i.test(withoutBullet)) continue

        const activity = withoutBullet.replace(
          /^(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d{1,2}(?:(?:\s+de\s+|[-/])?[\p{L}\d-]+)?\s*[:\-–—]\s*/iu,
          "",
        ).trim()
        if (activity.length >= 75) activities.push(truncate(activity, 520))
      }
    }
    return uniqueStrings(activities)
  } catch {
    return []
  }
}

function fingerprintSentences(content: string) {
  const structured = structuredActivityFingerprints(content)
  if (structured.length) return structured.slice(0, 120)

  const normalized = content.replace(/\s+/g, " ").trim()
  const developmentMatches = [...content.matchAll(/Desarrollo\s*:\s*([\s\S]*?)(?=Finalizaci[oó]n\s*:|Cierre\s*:|$)/gi)]
    .map((match) => truncate(match[1], 520))
  const fallback = normalized
    .split(/(?<=[.!?])\s+/)
    .filter((item) => item.length >= 110)
    .slice(0, 24)
    .map((item) => truncate(item, 520))
  return uniqueStrings((developmentMatches.length ? developmentMatches : fallback).slice(0, 120))
}
export async function rememberParvulariaGeneration(args: {
  supabase: SupabaseClient
  userId: string
  course: string
  topic: string
  selectedOAIds: string[]
  selectedOATIds: string[]
  candidateActivityIds: string[]
  generatedContent: string
  metadata?: Record<string, unknown>
}) {
  try {
    const { error } = await args.supabase
      .from("parvularia_generation_history")
      .insert({
        user_id: args.userId,
        course: args.course,
        topic: args.topic,
        selected_oa_ids: args.selectedOAIds,
        selected_oat_ids: args.selectedOATIds,
        candidate_activity_ids: args.candidateActivityIds,
        generated_content: args.generatedContent,
        activity_fingerprints: fingerprintSentences(args.generatedContent),
        metadata: args.metadata || {},
      })

    return { ok: !error, error: error?.message || null }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar memoria de generación",
    }
  }
}


export function evaluateParvulariaNovelty(
  generatedContent: string,
  recentContentSamples: string[],
) {
  const generatedFragments = fingerprintSentences(generatedContent)
  if (!generatedFragments.length || !recentContentSamples.length) {
    return { passed: true, maxSimilarity: 0, comparedFragments: generatedFragments.length }
  }

  const recentSets = recentContentSamples.map((sample) => tokenSet(sample))
  let maxSimilarity = 0

  for (const fragment of generatedFragments) {
    const set = tokenSet(fragment)
    for (const recent of recentSets) {
      maxSimilarity = Math.max(maxSimilarity, jaccard(set, recent))
    }
  }

  return {
    passed: maxSimilarity < 0.58,
    maxSimilarity: Math.round(maxSimilarity * 1000) / 1000,
    comparedFragments: generatedFragments.length,
  }
}
