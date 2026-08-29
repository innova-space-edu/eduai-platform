import { getBrainAICapability } from "@/lib/brain-ai/capabilities"
import type {
  BrainAIGateCheck,
  BrainAIIntent,
  BrainAILatencyClass,
  BrainAILocality,
  BrainAIMemoryKind,
  BrainAIMemoryPolicy,
  BrainAIModality,
  BrainAIPlanStep,
  BrainAIProductionStage,
  BrainAIRequest,
  BrainAIRoute,
  BrainAITrace,
  BrainAITraceNode,
  BrainAIWorldPrediction,
} from "@/lib/brain-ai/types"

const DEEP_CUES = [
  "investiga", "profundo", "compara", "demuestra", "analiza", "evalúa", "evalua", "explica por qué", "explica por que",
  "research", "deep", "compare", "prove", "analyze", "evaluate", "why",
]

const MEMORY_CUES = ["recuerda", "recordar", "memoria", "anterior", "antes", "ya hicimos", "previous", "remember", "memory"]
const CURRICULUM_CUES = ["oa", "mineduc", "curriculum", "currículo", "curriculo", "objetivo de aprendizaje", "curso", "asignatura", "rúbrica", "rubrica"]
const ACTION_CUES = ["crea", "genera", "guarda", "envía", "envia", "publica", "actualiza", "edita", "create", "generate", "save", "send", "publish", "update", "edit"]
const ASSESSMENT_CUES = ["evaluación", "evaluacion", "prueba", "examen", "quiz", "preguntas", "rúbrica", "rubrica"]
const TRANSLATE_CUES = ["traduce", "traducir", "translate"]
const SUMMARY_CUES = ["resume", "resumen", "summarize", "summary"]
const RETRIEVE_CUES = ["busca", "buscar", "localiza", "consulta", "recupera", "find", "search", "retrieve", "lookup"]

function hasAny(text: string, cues: string[]) {
  return cues.some(cue => text.includes(cue))
}

function normalizeModalities(modalities: BrainAIModality[]) {
  const unique = [...new Set(modalities)]
  return unique.length ? unique : ["text" as const]
}

function detectIntent(request: BrainAIRequest): { intent: BrainAIIntent; confidence: number } {
  if (request.intentHint) return { intent: request.intentHint, confidence: 1 }
  const text = request.input.toLocaleLowerCase()
  const modalities = normalizeModalities(request.modalities)
  const hasAudio = modalities.includes("audio")
  const hasImage = modalities.includes("image")
  const hasVideo = modalities.includes("video")
  const multimodal = modalities.filter(item => item !== "tool").length > 1

  if (multimodal) return { intent: "multimodal_reasoning", confidence: 0.94 }
  if (hasVideo) return { intent: "analyze_video", confidence: 0.96 }
  if (hasImage) return { intent: "analyze_image", confidence: 0.95 }
  if (hasAudio && hasAny(text, TRANSLATE_CUES)) return { intent: "translate", confidence: 0.96 }
  if (hasAudio) return { intent: "transcribe", confidence: 0.94 }
  if (hasAny(text, ASSESSMENT_CUES) && hasAny(text, ACTION_CUES)) return { intent: "create_assessment", confidence: 0.93 }
  if (hasAny(text, TRANSLATE_CUES)) return { intent: "translate", confidence: 0.93 }
  if (hasAny(text, SUMMARY_CUES)) return { intent: "summarize", confidence: 0.9 }
  if (hasAny(text, RETRIEVE_CUES)) return { intent: "retrieve_knowledge", confidence: 0.87 }
  if (hasAny(text, ACTION_CUES)) return { intent: "execute_action", confidence: 0.82 }
  return { intent: "answer", confidence: 0.78 }
}

function complexityScore(input: string, modalities: BrainAIModality[], intent: BrainAIIntent) {
  let score = 0.18
  const normalized = input.toLocaleLowerCase()
  score += Math.min(0.24, input.length / 1400)
  score += Math.max(0, normalizeModalities(modalities).length - 1) * 0.14
  if (hasAny(normalized, DEEP_CUES)) score += 0.24
  if (["multimodal_reasoning", "analyze_video", "create_assessment"].includes(intent)) score += 0.16
  if (["retrieve_knowledge", "execute_action"].includes(intent)) score += 0.08
  return Math.max(0, Math.min(1, score))
}

function choosePrimaryRoute(input: string, modalities: BrainAIModality[], intent: BrainAIIntent, complexity: number): BrainAIRoute {
  const text = input.toLocaleLowerCase()
  if (hasAny(text, MEMORY_CUES) && complexity < 0.58 && modalities.length <= 1) return "FAST_MEMORY"
  if (complexity >= 0.68 || intent === "multimodal_reasoning" || intent === "analyze_video") return "DEEP_COGNITION"
  if (intent === "retrieve_knowledge") return "RETRIEVAL"
  if (intent === "execute_action") return "ACTION"
  return "STANDARD_REASONING"
}

function buildMemoryPolicy(request: BrainAIRequest, intent: BrainAIIntent): BrainAIMemoryPolicy {
  const text = request.input.toLocaleLowerCase()
  const read = new Set<BrainAIMemoryKind>()
  const write = new Set<BrainAIMemoryKind>()

  read.add("working")
  if (hasAny(text, MEMORY_CUES)) {
    read.add("episodic")
    read.add("semantic")
  }
  if (hasAny(text, CURRICULUM_CUES) || intent === "create_assessment") {
    read.add("curriculum")
    read.add("canonical")
    read.add("semantic")
  }
  if (["execute_action", "create_assessment"].includes(intent)) read.add("procedural")
  if (intent === "multimodal_reasoning" || intent === "analyze_video") read.add("reflection")
  if (/webgpu|wasm|webnn|gpu|cpu|ram|latencia|benchmark|device|dispositivo/.test(text)) read.add("device")

  // Shadow Mode never writes user content automatically. Reflection metadata can
  // be persisted only after an explicit execution phase is approved.
  const decision = "NOOP" as const
  const reason = read.size > 1
    ? "Brain AI detectó memoria potencialmente útil, pero Shadow Mode solo propone lecturas y no inyecta memoria completa automáticamente."
    : "No hay evidencia suficiente para recuperar memoria de largo plazo; se mantiene working memory únicamente."

  return {
    read: [...read],
    write: [...write],
    decision,
    reason,
    injectIntoPrompt: false,
  }
}

function makeStep(
  order: number,
  label: string,
  capabilityId: string,
  route: BrainAIRoute,
  modalities: BrainAIModality[],
  detail: string,
  requiresMemory: BrainAIMemoryKind[] = [],
  optional = false,
): BrainAIPlanStep {
  return { id: `step-${order}-${capabilityId}`, order, label, capabilityId, route, modalities, requiresMemory, optional, detail }
}

function buildPlan(request: BrainAIRequest, intent: BrainAIIntent, route: BrainAIRoute, memory: BrainAIMemoryPolicy) {
  const modalities = normalizeModalities(request.modalities)
  const plan: BrainAIPlanStep[] = []
  let order = 1
  const add = (
    label: string,
    capabilityId: string,
    stepRoute: BrainAIRoute,
    stepModalities: BrainAIModality[],
    detail: string,
    requiresMemory: BrainAIMemoryKind[] = [],
    optional = false,
  ) => plan.push(makeStep(order++, label, capabilityId, stepRoute, stepModalities, detail, requiresMemory, optional))

  if (modalities.includes("audio")) {
    add("Detectar voz y pausas", "audio.vad", "STANDARD_REASONING", ["audio"], "Segmentar audio localmente antes de ejecutar ASR.")
    add("Transcribir audio", "audio.whisper", "STANDARD_REASONING", ["audio"], "Whisper Tiny INT8 local con Worker, Router V3 y timestamps.")
  }

  if (modalities.includes("image")) {
    add("Clasificar señal visual", "image.classification", "STANDARD_REASONING", ["image"], "Preclasificación visual local para decidir si se necesita OCR/visión profunda.", [], true)
    add("Extraer estructura/texto", "image.ocr", "RETRIEVAL", ["image"], "OCR/document vision cuando la imagen contiene material textual.", [], true)
    add("Comprender imagen", "image.vision", route === "DEEP_COGNITION" ? "DEEP_COGNITION" : "STANDARD_REASONING", ["image"], "Visión multimodal para relaciones semánticas que MobileNet no puede resolver.", [], true)
  }

  if (modalities.includes("video")) {
    add("Descomponer video", "video.analysis", "DEEP_COGNITION", ["video", "audio", "image"], "Extraer audio, transcript y frames representativos antes de fusionar contexto.")
  }

  if (memory.read.some(kind => kind !== "working")) {
    add("Recuperar memoria selectiva", "memory.long-term", "RETRIEVAL", ["text"], "Consultar solo las memorias requeridas por el plan; no volcar memoria completa al prompt.", memory.read.filter(kind => kind !== "working"))
  }

  if (modalities.length > 1 || intent === "multimodal_reasoning" || intent === "analyze_video") {
    add("Fusionar contexto multimodal", "multimodal.fusion", "DEEP_COGNITION", modalities, "Unificar únicamente señales relevantes en un contexto común.")
  }

  const reasoningCapability = route === "FAST_MEMORY" ? "brain.cognitive-router" : route === "DEEP_COGNITION" ? "text.cloud-llm" : "text.local-llm"
  add(
    route === "FAST_MEMORY" ? "Resolver desde ruta rápida" : route === "DEEP_COGNITION" ? "Razonamiento profundo" : "Razonamiento estándar",
    reasoningCapability,
    route,
    ["text"],
    route === "FAST_MEMORY"
      ? "Resolver desde memoria/canonical facts sin activar un modelo grande cuando sea suficiente."
      : route === "DEEP_COGNITION"
        ? "Usar reasoning profundo con fallback cloud mientras el LLM local no alcance esta ruta."
        : "Preferir LLM local cuando el runtime/modelo estén listos; si no, usar AI Core como fallback medido.",
    memory.read,
  )

  add("Validar resultado", "brain.reflection", "VALIDATION", ["text"], "Comprobar consistencia, calidad, cobertura del objetivo y señales de reparación.")

  if (["create_assessment", "execute_action"].includes(intent) || modalities.includes("tool")) {
    add("Preparar acción", "tools.eduai", "ACTION", ["tool"], "La acción real permanece bloqueada en Shadow Mode hasta autorización/gate de producción.", ["procedural"])
  }

  return plan
}

function buildWorldPredictions(plan: BrainAIPlanStep[], request: BrainAIRequest): BrainAIWorldPrediction[] {
  const predictions: BrainAIWorldPrediction[] = []
  const ids = new Set(plan.map(step => step.capabilityId))

  if (ids.has("text.local-llm")) {
    predictions.push({
      id: "local-llm-readiness",
      label: "El LLM local puede no estar ejecutable todavía",
      probability: 0.72,
      impact: "medium",
      mitigation: "Mantener AI Core como fallback y medir hardware/runtime antes de descargar modelos grandes.",
    })
  }
  if (request.modalities.includes("audio")) {
    predictions.push({
      id: "asr-quality",
      label: "Whisper Tiny puede perder precisión en nombres, ruido o habla rápida",
      probability: 0.36,
      impact: "medium",
      mitigation: "Usar VAD v1.5, score de calidad por segmento y marcar fragmentos de baja confianza.",
    })
  }
  if (request.modalities.includes("video")) {
    predictions.push({
      id: "video-budget",
      label: "Procesar demasiados frames puede elevar latencia/costo",
      probability: 0.68,
      impact: "high",
      mitigation: "Aplicar muestreo temporal adaptativo y usar transcript para reducir llamadas de visión.",
    })
  }
  if (plan.some(step => step.capabilityId === "memory.long-term")) {
    predictions.push({
      id: "memory-schema",
      label: "La memoria persistente aún requiere schema/RLS definitivo",
      probability: 0.9,
      impact: "high",
      mitigation: "Shadow Mode propone lecturas pero no persiste contenido hasta validar políticas de Supabase.",
    })
  }
  if (!predictions.length) {
    predictions.push({
      id: "baseline",
      label: "Ruta de baja complejidad sin riesgo técnico dominante",
      probability: 0.82,
      impact: "low",
      mitigation: "Mantener observabilidad y validar salida antes de promoverla a producción.",
    })
  }
  return predictions
}

function productionGates(plan: BrainAIPlanStep[], shadowMode: boolean): { gates: BrainAIGateCheck[]; stage: BrainAIProductionStage } {
  const capabilityStates = plan.map(step => ({ step, capability: getBrainAICapability(step.capabilityId) }))
  const allKnown = capabilityStates.every(item => Boolean(item.capability))
  const allRequiredReady = capabilityStates
    .filter(item => !item.step.optional)
    .every(item => item.capability?.state === "ready")
  const noBlocked = capabilityStates.every(item => item.capability?.state !== "blocked")
  const localFallbacks = capabilityStates.every(item => item.capability?.locality !== "local" || item.capability.state !== "blocked")

  const gates: BrainAIGateCheck[] = [
    { id: "known", label: "Capacidades registradas", passed: allKnown, required: true, detail: allKnown ? "Todos los pasos tienen una capability conocida." : "Hay pasos sin capability registrada." },
    { id: "required-ready", label: "Dependencias obligatorias", passed: allRequiredReady, required: true, detail: allRequiredReady ? "Las capacidades obligatorias están listas." : "Al menos una capacidad obligatoria sigue en candidate/experimental." },
    { id: "blocked", label: "Sin capacidades bloqueadas", passed: noBlocked, required: true, detail: noBlocked ? "No se detectaron rutas bloqueadas." : "Existe una capacidad bloqueada en el plan." },
    { id: "fallback", label: "Fallback controlado", passed: localFallbacks, required: true, detail: "El plan conserva una ruta alternativa cuando una capacidad local no está disponible." },
    { id: "shadow", label: "Shadow Mode", passed: shadowMode, required: true, detail: shadowMode ? "No se ejecutan acciones mutables ni escrituras de memoria." : "Selective execution requiere gates adicionales." },
    { id: "observability", label: "Observabilidad", passed: true, required: true, detail: "Se registra intent/route/plan sin almacenar el prompt completo." },
  ]

  const requiredPassed = gates.filter(gate => gate.required).every(gate => gate.passed)
  if (requiredPassed && allRequiredReady) return { gates, stage: "VALIDATING" }
  if (noBlocked && allKnown) return { gates, stage: "CANDIDATE" }
  return { gates, stage: "EXPERIMENTAL" }
}

function localityForPlan(plan: BrainAIPlanStep[]): BrainAILocality {
  const localities = new Set(plan.map(step => getBrainAICapability(step.capabilityId)?.locality).filter(Boolean))
  if (localities.size === 1 && localities.has("local")) return "local"
  if (localities.size === 1 && localities.has("cloud")) return "cloud"
  return "hybrid"
}

function latencyForPlan(plan: BrainAIPlanStep[], complexity: number): BrainAILatencyClass {
  if (complexity < 0.25 && plan.length <= 3) return "instant"
  if (complexity < 0.5 && plan.length <= 5) return "fast"
  if (complexity < 0.78 && plan.length <= 8) return "interactive"
  return "slow"
}

function buildGoal(intent: BrainAIIntent) {
  const goals: Record<BrainAIIntent, string> = {
    answer: "Responder correctamente con la ruta cognitiva mínima suficiente.",
    transcribe: "Convertir voz a texto conservando idioma, continuidad y timestamps útiles.",
    translate: "Traducir preservando significado, idioma objetivo y estructura relevante.",
    summarize: "Reducir contenido manteniendo ideas, evidencias y estructura esencial.",
    create_assessment: "Construir una evaluación coherente con contenido, nivel y criterios recuperados.",
    analyze_image: "Extraer señales visuales relevantes y convertirlas en contexto útil.",
    analyze_video: "Fusionar audio, tiempo y visión para comprender el video sin procesar datos innecesarios.",
    multimodal_reasoning: "Fusionar modalidades relevantes y resolver el objetivo con un plan trazable.",
    retrieve_knowledge: "Recuperar conocimiento pertinente antes de responder, evitando memoria irrelevante.",
    execute_action: "Preparar una acción verificable y segura antes de cualquier mutación externa.",
  }
  return goals[intent]
}

function nodeStatus(capabilityId: string, optional = false): BrainAITraceNode["status"] {
  const capability = getBrainAICapability(capabilityId)
  if (!capability) return "blocked"
  if (capability.state === "blocked") return "blocked"
  if (capability.state === "ready") return "success"
  return optional ? "planned" : "warning"
}

function buildTraceNodes(
  request: BrainAIRequest,
  intent: BrainAIIntent,
  goal: string,
  route: BrainAIRoute,
  memory: BrainAIMemoryPolicy,
  plan: BrainAIPlanStep[],
): BrainAITraceNode[] {
  const nodes: BrainAITraceNode[] = [
    { id: "signal", label: "Signal", region: "signal", status: "success", detail: normalizeModalities(request.modalities).join(" + ") },
    { id: "intent", label: "Intent", region: "intent", status: "success", detail: intent },
    { id: "goal", label: "Goal", region: "goal", status: "success", detail: goal },
    { id: "memory", label: "Memory", region: "memory", status: memory.read.length > 1 ? "planned" : "success", detail: memory.read.join(" · ") },
    { id: "planning", label: "Planner", region: "planning", status: "success", detail: `${plan.length} pasos` },
    { id: "routing", label: "Cognitive Router", region: "routing", status: "success", detail: route },
  ]

  for (const step of plan) {
    const capability = getBrainAICapability(step.capabilityId)
    const region: BrainAITraceNode["region"] =
      capability?.region === "audio" || capability?.region === "image" || capability?.region === "video" || capability?.region === "multimodal"
        ? "sensory"
        : step.route === "VALIDATION"
          ? "validation"
          : step.route === "ACTION"
            ? "action"
            : "reasoning"
    nodes.push({
      id: step.id,
      label: step.label,
      region,
      status: nodeStatus(step.capabilityId, step.optional),
      detail: `${capability?.label || step.capabilityId} · ${step.route}`,
    })
  }

  nodes.push({ id: "reflection", label: "Reflection", region: "reflection", status: "planned", detail: "quality + recovery" })
  nodes.push({ id: "result", label: "Result", region: "result", status: request.shadowMode === false ? "planned" : "idle", detail: request.shadowMode === false ? "selective execution" : "shadow only" })
  return nodes
}

function traceId() {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `brain-${Date.now()}-${random}`
}

export function runBrainAIShadow(input: BrainAIRequest): BrainAITrace {
  const request: BrainAIRequest = {
    ...input,
    input: input.input.trim(),
    modalities: normalizeModalities(input.modalities),
    shadowMode: input.shadowMode !== false,
  }
  const detection = detectIntent(request)
  const complexity = complexityScore(request.input, request.modalities, detection.intent)
  const route = choosePrimaryRoute(request.input, request.modalities, detection.intent, complexity)
  const memoryPolicy = buildMemoryPolicy(request, detection.intent)
  const plan = buildPlan(request, detection.intent, route, memoryPolicy)
  const predictions = buildWorldPredictions(plan, request)
  const goal = buildGoal(detection.intent)
  const gates = productionGates(plan, request.shadowMode !== false)
  const notes = [
    "Brain AI está en Shadow Mode: propone decisiones sin sustituir todavía la respuesta real de EduAI.",
    "La memoria se consulta como ruta independiente; no se inyecta memoria completa automáticamente en cada prompt.",
    "Las acciones y escrituras de memoria permanecen bloqueadas hasta superar Production Gate.",
  ]

  return {
    traceId: traceId(),
    createdAt: new Date().toISOString(),
    shadowMode: request.shadowMode !== false,
    inputPreview: request.input.slice(0, 120),
    modalities: request.modalities,
    intent: detection.intent,
    goal,
    route,
    complexity,
    confidence: detection.confidence,
    memoryPolicy,
    plan,
    predictions,
    nodes: buildTraceNodes(request, detection.intent, goal, route, memoryPolicy, plan),
    gates: gates.gates,
    productionStage: gates.stage,
    estimatedLocality: localityForPlan(plan),
    expectedLatencyClass: latencyForPlan(plan, complexity),
    notes,
  }
}
