import type { BrainAIStoredTrace } from "@/lib/brain-ai/telemetry"

export type BrainAIV6Mode = "SHADOW" | "REFLECTION" | "SLEEP" | "DREAM" | "EVALUATION"

export type BrainAIExperience = {
  id: string
  origin: "real"
  traceId: string
  createdAt: string
  intent: BrainAIStoredTrace["intent"]
  route: BrainAIStoredTrace["route"]
  modalities: BrainAIStoredTrace["modalities"]
  locality: BrainAIStoredTrace["estimatedLocality"]
  complexity: number
  confidence: number
  gatePassRate: number
  planLength: number
  productionStage: BrainAIStoredTrace["productionStage"]
}

export type BrainAIReflection = {
  id: string
  traceId: string
  kind: "reinforce" | "repair"
  observation: string
  confidence: number
}

export type BrainAIDreamHypothesis = {
  id: string
  origin: "simulated"
  truthStatus: "hypothesis"
  basedOnExperienceIds: string[]
  intent: BrainAIStoredTrace["intent"]
  hypothesis: string
  counterfactual: string
  confidence: number
  eligibleForFactMemory: false
  eligibleForProductionPromotion: false
}

export type BrainAISkillCandidate = {
  id: string
  intent: BrainAIStoredTrace["intent"]
  route: BrainAIStoredTrace["route"]
  evidenceCount: number
  averageGatePassRate: number
  averageConfidence: number
  stage: "candidate"
  productionPromotionAllowed: false
}

export type BrainAIV6Gate = {
  id: "real-experience" | "quality" | "diversity" | "simulation-isolation" | "production-lock"
  label: string
  passed: boolean
  detail: string
}

export type BrainAIV6CycleReport = {
  version: "6"
  generatedAt: string
  mode: BrainAIV6Mode
  experiences: BrainAIExperience[]
  reflections: BrainAIReflection[]
  dreams: BrainAIDreamHypothesis[]
  skillCandidates: BrainAISkillCandidate[]
  gates: BrainAIV6Gate[]
  readiness: number
  productionWriteAllowed: false
  modelWeightUpdateAllowed: false
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function cleanLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
}

function experienceFromTrace(trace: BrainAIStoredTrace): BrainAIExperience {
  return {
    id: `experience:${trace.traceId}`,
    origin: "real",
    traceId: trace.traceId,
    createdAt: trace.createdAt,
    intent: trace.intent,
    route: trace.route,
    modalities: trace.modalities,
    locality: trace.estimatedLocality,
    complexity: clamp01(trace.complexity),
    confidence: clamp01(trace.confidence),
    gatePassRate: clamp01(trace.gatePassRate),
    planLength: Math.max(0, trace.planLength),
    productionStage: trace.productionStage,
  }
}

function buildReflections(experiences: BrainAIExperience[]): BrainAIReflection[] {
  return experiences.slice(0, 12).map(experience => {
    const needsRepair = experience.gatePassRate < 0.8 || experience.confidence < 0.65
    const observation = needsRepair
      ? `Revisar ${cleanLabel(experience.intent)}: la ruta ${experience.route} necesita más evidencia antes de reutilizarse como estrategia.`
      : `La ruta ${experience.route} fue consistente para ${cleanLabel(experience.intent)}; conservarla como evidencia, no como regla definitiva.`

    return {
      id: `reflection:${experience.traceId}`,
      traceId: experience.traceId,
      kind: needsRepair ? "repair" : "reinforce",
      observation,
      confidence: clamp01((experience.confidence + experience.gatePassRate) / 2),
    }
  })
}

function buildSkills(experiences: BrainAIExperience[]): BrainAISkillCandidate[] {
  const groups = new Map<string, BrainAIExperience[]>()

  for (const experience of experiences) {
    const key = `${experience.intent}:${experience.route}`
    const group = groups.get(key) || []
    group.push(experience)
    groups.set(key, group)
  }

  return Array.from(groups.values())
    .filter(group => group.length >= 2)
    .map(group => {
      const sample = group[0]
      return {
        id: `skill:${sample.intent}:${sample.route}`,
        intent: sample.intent,
        route: sample.route,
        evidenceCount: group.length,
        averageGatePassRate: clamp01(average(group.map(item => item.gatePassRate))),
        averageConfidence: clamp01(average(group.map(item => item.confidence))),
        stage: "candidate" as const,
        productionPromotionAllowed: false as const,
      }
    })
    .filter(candidate => candidate.averageGatePassRate >= 0.75)
    .sort((a, b) => b.evidenceCount - a.evidenceCount || b.averageGatePassRate - a.averageGatePassRate)
    .slice(0, 8)
}

function alternativeRoute(route: BrainAIStoredTrace["route"], experiences: BrainAIExperience[]) {
  return experiences.find(item => item.route !== route)?.route || "VALIDATION"
}

function buildDreams(experiences: BrainAIExperience[]): BrainAIDreamHypothesis[] {
  if (!experiences.length) return []

  return experiences.slice(0, 6).map((experience, index) => {
    const companion = experiences[(index + 1) % experiences.length]
    const route = alternativeRoute(experience.route, experiences)
    const basedOn = companion && companion.id !== experience.id
      ? [experience.id, companion.id]
      : [experience.id]

    return {
      id: `dream:${experience.traceId}:${index}`,
      origin: "simulated",
      truthStatus: "hypothesis",
      basedOnExperienceIds: basedOn,
      intent: experience.intent,
      hypothesis: `Simular si ${cleanLabel(experience.intent)} mantiene calidad usando una estrategia alternativa sin aumentar costo ni latencia innecesariamente.`,
      counterfactual: `¿Qué ocurriría si la ruta ${experience.route} se comparara contra ${route} antes de ejecutar una tarea real equivalente?`,
      confidence: clamp01(0.35 + 0.25 * experience.gatePassRate + 0.2 * experience.confidence),
      eligibleForFactMemory: false,
      eligibleForProductionPromotion: false,
    }
  })
}

export function buildBrainAIV6Cycle(
  traces: BrainAIStoredTrace[],
  generatedAt = new Date().toISOString(),
): BrainAIV6CycleReport {
  const experiences = traces.slice(0, 40).map(experienceFromTrace)
  const reflections = buildReflections(experiences)
  const dreams = buildDreams(experiences)
  const skillCandidates = buildSkills(experiences)
  const averageQuality = average(experiences.map(item => (item.gatePassRate + item.confidence) / 2))
  const distinctIntents = new Set(experiences.map(item => item.intent)).size
  const distinctRoutes = new Set(experiences.map(item => item.route)).size

  const gates: BrainAIV6Gate[] = [
    {
      id: "real-experience",
      label: "Experiencia real suficiente",
      passed: experiences.length >= 3,
      detail: `${experiences.length}/3 trazas resumidas disponibles para consolidación.`,
    },
    {
      id: "quality",
      label: "Calidad mínima",
      passed: averageQuality >= 0.7,
      detail: `Calidad observada ${Math.round(averageQuality * 100)}%; objetivo ≥ 70%.`,
    },
    {
      id: "diversity",
      label: "Diversidad cognitiva",
      passed: distinctIntents >= 2 || distinctRoutes >= 2,
      detail: `${distinctIntents} intención(es) y ${distinctRoutes} ruta(s) distintas.`,
    },
    {
      id: "simulation-isolation",
      label: "Sueños aislados de hechos",
      passed: dreams.every(item => !item.eligibleForFactMemory),
      detail: "Toda experiencia simulada permanece como hipótesis y nunca se convierte automáticamente en memoria factual.",
    },
    {
      id: "production-lock",
      label: "Production Gate bloqueado",
      passed: true,
      detail: "El ciclo V6 no escribe memoria productiva ni modifica pesos del modelo.",
    },
  ]

  const readiness = clamp01(average([
    Math.min(1, experiences.length / 6),
    averageQuality,
    Math.min(1, (distinctIntents + distinctRoutes) / 4),
    gates.filter(gate => gate.passed).length / gates.length,
  ]))

  return {
    version: "6",
    generatedAt,
    mode: dreams.length ? "DREAM" : experiences.length ? "REFLECTION" : "SHADOW",
    experiences,
    reflections,
    dreams,
    skillCandidates,
    gates,
    readiness,
    productionWriteAllowed: false,
    modelWeightUpdateAllowed: false,
  }
}
