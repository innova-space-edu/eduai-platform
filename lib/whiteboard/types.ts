export type WhiteboardPoint = { x: number; y: number }

export type WhiteboardStroke = {
  id: string
  points: WhiteboardPoint[]
  color?: string
  width?: number
}

export type WhiteboardBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type WhiteboardRecognitionSource = "mathpix" | "gemini" | "manual" | "none"

export type WhiteboardMathBlock = {
  id: string
  strokeIds: string[]
  bounds: WhiteboardBounds
  latex: string
  text: string
  confidence: number | null
  type: "number" | "expression" | "equation" | "system" | "function" | "geometry" | "text" | "unknown"
  status: "writing" | "recognizing" | "ready" | "review"
  source: WhiteboardRecognitionSource
  alternatives: string[]
  editedManually?: boolean
  warning?: string | null
}

export type WhiteboardPage = {
  id: string
  title: string
  strokes: WhiteboardStroke[]
  blocks: WhiteboardMathBlock[]
  activeBlockId: string | null
  canvasHeight: number
  createdAt: string
  updatedAt: string
}

export type WhiteboardNotebook = {
  id: string
  title: string
  folder?: string
  pages: WhiteboardPage[]
  activePageId: string
  createdAt: string
  updatedAt: string
  cloudSyncedAt?: string | null
}

export type WhiteboardSolveMode = "solve" | "verify" | "hint" | "explain" | "graph"

export type WhiteboardSolveStep = {
  index: number
  explanation: string
  latex: string
  valid?: boolean | null
}

export type WhiteboardVerificationLine = {
  index: number
  latex: string
  valid: boolean | null
  message: string
  operation?: string | null
}

export type WhiteboardGraphPoint = { x: number; y: number }

export type WhiteboardSolveResult = {
  normalizedLatex: string
  classification: string
  steps: WhiteboardSolveStep[]
  answerLatex: string
  explanation: string
  verified: boolean
  engine: "sympy" | "deterministic" | "ai-assisted"
  verification?: {
    valid: boolean | null
    substitutionLatex?: string
    message?: string
    lines?: WhiteboardVerificationLine[]
  } | null
  graph?: {
    expressionLatex: string
    xMin: number
    xMax: number
    yMin: number
    yMax: number
    points: WhiteboardGraphPoint[]
  } | null
  warning?: string | null
}
