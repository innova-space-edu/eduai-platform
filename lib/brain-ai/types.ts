export type BrainAIModality = "text" | "audio" | "image" | "video" | "tool"

export type BrainAIRoute =
  | "FAST_MEMORY"
  | "STANDARD_REASONING"
  | "DEEP_COGNITION"
  | "RETRIEVAL"
  | "VALIDATION"
  | "REPAIR"
  | "ACTION"

export type BrainAIMemoryKind =
  | "working"
  | "episodic"
  | "semantic"
  | "canonical"
  | "procedural"
  | "reflection"
  | "curriculum"
  | "device"

export type BrainAIMemoryDecision = "ADD" | "UPDATE" | "DELETE" | "NOOP"

export type BrainAIIntent =
  | "answer"
  | "transcribe"
  | "translate"
  | "summarize"
  | "create_assessment"
  | "analyze_image"
  | "analyze_video"
  | "multimodal_reasoning"
  | "retrieve_knowledge"
  | "execute_action"

export type BrainAINodeStatus = "idle" | "planned" | "running" | "success" | "warning" | "blocked"

export type BrainAIProductionStage =
  | "EXPERIMENTAL"
  | "CANDIDATE"
  | "VALIDATING"
  | "VALIDATED"
  | "PRODUCTION_READY"

export type BrainAICapabilityState = "ready" | "candidate" | "experimental" | "blocked"

export type BrainAILocality = "local" | "hybrid" | "cloud"

export type BrainAILatencyClass = "instant" | "fast" | "interactive" | "slow"

export type BrainAIRequest = {
  input: string
  modalities: BrainAIModality[]
  intentHint?: BrainAIIntent
  shadowMode?: boolean
}

export type BrainAIMemoryPolicy = {
  read: BrainAIMemoryKind[]
  write: BrainAIMemoryKind[]
  decision: BrainAIMemoryDecision
  reason: string
  injectIntoPrompt: boolean
}

export type BrainAIPlanStep = {
  id: string
  order: number
  label: string
  capabilityId: string
  route: BrainAIRoute
  modalities: BrainAIModality[]
  requiresMemory: BrainAIMemoryKind[]
  optional: boolean
  detail: string
}

export type BrainAIWorldPrediction = {
  id: string
  label: string
  probability: number
  impact: "low" | "medium" | "high"
  mitigation: string
}

export type BrainAITraceNode = {
  id: string
  label: string
  region:
    | "signal"
    | "intent"
    | "goal"
    | "memory"
    | "planning"
    | "routing"
    | "sensory"
    | "reasoning"
    | "validation"
    | "action"
    | "reflection"
    | "result"
  status: BrainAINodeStatus
  detail: string
}

export type BrainAIGateCheck = {
  id: string
  label: string
  passed: boolean
  required: boolean
  detail: string
}

export type BrainAITrace = {
  traceId: string
  createdAt: string
  shadowMode: boolean
  inputPreview: string
  modalities: BrainAIModality[]
  intent: BrainAIIntent
  goal: string
  route: BrainAIRoute
  complexity: number
  confidence: number
  memoryPolicy: BrainAIMemoryPolicy
  plan: BrainAIPlanStep[]
  predictions: BrainAIWorldPrediction[]
  nodes: BrainAITraceNode[]
  gates: BrainAIGateCheck[]
  productionStage: BrainAIProductionStage
  estimatedLocality: BrainAILocality
  expectedLatencyClass: BrainAILatencyClass
  notes: string[]
}

export type BrainAICapability = {
  id: string
  label: string
  region: "brain" | "memory" | "text" | "audio" | "image" | "video" | "router" | "tools" | "multimodal"
  modality?: BrainAIModality
  state: BrainAICapabilityState
  locality: BrainAILocality
  engine: string
  productionStage: BrainAIProductionStage
  description: string
  dependencies: string[]
  risks: string[]
}

export type BrainAIBrowserSnapshot = {
  webgpu: boolean
  webnn: boolean
  wasm: boolean
  cacheStorage: boolean
  microphone: boolean
  mediaRecorder: boolean
  speechSynthesis: boolean
  hardwareConcurrency: number
  deviceMemoryGB: number | null
}

export type BrainAITraceSummary = {
  total: number
  fastMemory: number
  standardReasoning: number
  deepCognition: number
  multimodal: number
  lastIntent: BrainAIIntent | null
  lastRoute: BrainAIRoute | null
  lastRunAt: string | null
}
