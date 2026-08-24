export type ImportedAnswerSource = "file" | "ai_inferred" | "missing"

export type ImportedExamQuestion = {
  type: "multiple_choice" | "true_false" | "development" | "mixed_choice_development"
  question: string
  options?: string[]
  correctAnswer?: number | null
  answerText?: string
  explanation?: string
  solutionSteps?: string[]
  distractorRationales?: string[]
  modelAnswer?: string
  expectedLatex?: string
  rubric?: { criteria: string; points: number }[]
  maxPoints?: number
  selectionPoints?: number
  justificationMaxPoints?: number
  developmentMaxPoints?: number
  showRubricToStudent?: boolean
  imageRef?: number | null
  imagePage?: number | null
  optionImageRefs?: Array<number | null>
  optionImagePages?: Array<number | null>
  imageUrl?: string
  optionImageUrls?: string[]
  answerSource: ImportedAnswerSource
  sourcePage?: number | null
  importWarnings?: string[]
}

const SUPER_MAP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")", "ⁿ": "n",
}

const SUB_MAP: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "₊": "+", "₋": "-", "₌": "=", "₍": "(", "₎": ")",
  "ₐ": "a", "ₑ": "e", "ₕ": "h", "ᵢ": "i", "ⱼ": "j", "ₖ": "k",
  "ₗ": "l", "ₘ": "m", "ₙ": "n", "ₒ": "o", "ₚ": "p", "ᵣ": "r",
  "ₛ": "s", "ₜ": "t", "ᵤ": "u", "ᵥ": "v", "ₓ": "x",
}

function replaceUnicodeScriptRuns(value: string, map: Record<string, string>, marker: "^" | "_") {
  const chars = Object.keys(map).join("")
  if (!chars) return value
  const re = new RegExp(`[${chars}]+`, "g")
  return value.replace(re, (run) => `${marker}{${Array.from(run).map((ch) => map[ch] ?? ch).join("")}}`)
}

function normalizeMathSegment(value: string) {
  let text = value
  text = replaceUnicodeScriptRuns(text, SUPER_MAP, "^")
  text = replaceUnicodeScriptRuns(text, SUB_MAP, "_")
  text = text
    .replace(/√\s*\(([^()]+)\)/g, "\\sqrt{$1}")
    .replace(/√\s*([A-Za-z0-9]+)/g, "\\sqrt{$1}")
    .replace(/\b([A-Za-z0-9]+)\s*⁄\s*([A-Za-z0-9]+)\b/g, "\\frac{$1}{$2}")
  return text
}

/**
 * Conserva texto normal y convierte super/subíndices Unicode frecuentes a una
 * forma que ExamMathText/KaTeX puede representar. No intenta reescribir prosa.
 */
export function normalizeDocumentMath(value: unknown): string {
  const raw = String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
  if (!raw) return ""

  const normalized = normalizeMathSegment(raw)
  if (normalized === raw) return raw

  // Solo envolver automáticamente cuando la cadena es corta y claramente STEM.
  // En frases largas se conservan los marcadores ^{} / _{} para no convertir toda
  // la oración en modo matemático.
  const mathLike = normalized.length <= 90 && /[=+\-*/^_\\]|[A-Z][a-z]?_\{|\\sqrt|\\frac/.test(normalized)
  if (mathLike && !/\$/.test(normalized)) return `$${normalized}$`
  return normalized
}

function normalizeType(value: unknown): ImportedExamQuestion["type"] {
  const v = String(value || "").toLowerCase().trim()
  if (["true_false", "verdadero_falso", "vf", "v_f"].includes(v)) return "true_false"
  if (["development", "desarrollo", "open", "open_response"].includes(v)) return "development"
  if (["mixed_choice_development", "mixed", "alternativa_desarrollo"].includes(v)) return "mixed_choice_development"
  return "multiple_choice"
}

function parseAnswerIndex(raw: unknown, options: string[], type: ImportedExamQuestion["type"]): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  if (typeof raw === "boolean" && type === "true_false") return raw ? 0 : 1
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw)
    if (n >= 0 && n < Math.max(1, options.length)) return n
    if (n >= 1 && n <= options.length) return n - 1
    return null
  }

  const value = String(raw).trim().toLowerCase()
  if (!value) return null
  if (type === "true_false") {
    if (["verdadero", "v", "true"].includes(value)) return 0
    if (["falso", "f", "false"].includes(value)) return 1
  }
  const letter = value.match(/^[a-f](?:[).:\-]|$)/i)?.[0]?.[0]?.toLowerCase()
  if (letter) {
    const idx = letter.charCodeAt(0) - 97
    if (idx >= 0 && idx < options.length) return idx
  }
  const numeric = Number(value)
  if (Number.isInteger(numeric)) {
    if (numeric >= 0 && numeric < options.length) return numeric
    if (numeric >= 1 && numeric <= options.length) return numeric - 1
  }
  const exact = options.findIndex((opt) => opt.trim().toLowerCase() === value)
  return exact >= 0 ? exact : null
}

function normalizeRubric(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      criteria: normalizeDocumentMath(item?.criteria ?? item?.criterion ?? item?.criterio ?? ""),
      points: Math.max(0, Number(item?.points ?? item?.puntos ?? 0) || 0),
    }))
    .filter((item) => item.criteria && item.points > 0)
}

export function normalizeImportedQuestion(raw: any): ImportedExamQuestion {
  const type = normalizeType(raw?.type)
  const options = type === "true_false"
    ? ["Verdadero", "Falso"]
    : Array.isArray(raw?.options ?? raw?.alternatives ?? raw?.choices)
      ? (raw.options ?? raw.alternatives ?? raw.choices).map((item: unknown) => normalizeDocumentMath(item))
      : []

  const correctAnswer = type === "development"
    ? null
    : parseAnswerIndex(raw?.correctAnswer ?? raw?.correct_answer ?? raw?.answer, options, type)

  const declaredSource = String(raw?.answerSource ?? raw?.answer_source ?? "").toLowerCase()
  let answerSource: ImportedAnswerSource = declaredSource === "file" || declaredSource === "ai_inferred"
    ? declaredSource
    : "missing"

  if (type === "development") {
    const hasModel = Boolean(String(raw?.modelAnswer ?? raw?.model_answer ?? raw?.expectedAnswer ?? "").trim())
    if (!hasModel && answerSource === "file") answerSource = "missing"
  } else if (correctAnswer === null && answerSource === "file") {
    answerSource = "missing"
  }

  const rubric = normalizeRubric(raw?.rubric)
  const selectionPoints = Math.max(0, Number(raw?.selectionPoints ?? raw?.selection_points ?? (type === "true_false" ? 1 : 0)) || 0)
  const justificationMaxPoints = Math.max(0, Number(raw?.justificationMaxPoints ?? raw?.justification_max_points ?? (type === "true_false" ? 2 : 0)) || 0)
  const developmentMaxPoints = Math.max(0, Number(raw?.developmentMaxPoints ?? raw?.development_max_points ?? 2) || 0)

  const modelAnswer = normalizeDocumentMath(raw?.modelAnswer ?? raw?.model_answer ?? raw?.expectedAnswer ?? "")
  const inferredMax = type === "development"
    ? (rubric.reduce((sum, item) => sum + item.points, 0) || 5)
    : type === "true_false"
      ? selectionPoints + justificationMaxPoints
      : type === "mixed_choice_development"
        ? Math.max(1, selectionPoints || 3) + developmentMaxPoints
        : 1

  return {
    type,
    question: normalizeDocumentMath(raw?.question ?? raw?.statement ?? raw?.enunciado ?? ""),
    options,
    correctAnswer,
    answerText: normalizeDocumentMath(raw?.answerText ?? raw?.correctAnswerText ?? ""),
    explanation: normalizeDocumentMath(raw?.explanation ?? raw?.explicacion ?? ""),
    solutionSteps: Array.isArray(raw?.solutionSteps ?? raw?.steps)
      ? (raw.solutionSteps ?? raw.steps).map((step: unknown) => normalizeDocumentMath(step)).filter(Boolean)
      : [],
    distractorRationales: Array.isArray(raw?.distractorRationales)
      ? raw.distractorRationales.map((item: unknown) => normalizeDocumentMath(item))
      : [],
    modelAnswer,
    expectedLatex: normalizeDocumentMath(raw?.expectedLatex ?? raw?.expected_latex ?? ""),
    rubric,
    maxPoints: Math.max(0, Number(raw?.maxPoints ?? raw?.max_points ?? inferredMax) || inferredMax),
    selectionPoints: type === "true_false" || type === "mixed_choice_development" ? Math.max(1, selectionPoints || (type === "true_false" ? 1 : 3)) : undefined,
    justificationMaxPoints: type === "true_false" ? justificationMaxPoints : undefined,
    developmentMaxPoints: type === "mixed_choice_development" ? developmentMaxPoints : undefined,
    showRubricToStudent: raw?.showRubricToStudent === true,
    imageRef: Number.isInteger(Number(raw?.imageRef)) ? Number(raw.imageRef) : null,
    imagePage: Number.isInteger(Number(raw?.imagePage)) ? Number(raw.imagePage) : null,
    optionImageRefs: Array.isArray(raw?.optionImageRefs)
      ? raw.optionImageRefs.map((item: unknown) => Number.isInteger(Number(item)) ? Number(item) : null)
      : [],
    optionImagePages: Array.isArray(raw?.optionImagePages)
      ? raw.optionImagePages.map((item: unknown) => Number.isInteger(Number(item)) ? Number(item) : null)
      : [],
    answerSource,
    sourcePage: Number.isInteger(Number(raw?.sourcePage ?? raw?.page)) ? Number(raw?.sourcePage ?? raw?.page) : null,
    importWarnings: Array.isArray(raw?.warnings) ? raw.warnings.map(String).filter(Boolean) : [],
  }
}

export function summarizeImportedQuestions(questions: ImportedExamQuestion[]) {
  let explicitAnswers = 0
  let inferredAnswers = 0
  let missingAnswers = 0
  let imageReferences = 0

  for (const question of questions) {
    if (question.answerSource === "file") explicitAnswers += 1
    else if (question.answerSource === "ai_inferred") inferredAnswers += 1
    else missingAnswers += 1

    if (question.imageRef !== null && question.imageRef !== undefined) imageReferences += 1
    imageReferences += (question.optionImageRefs || []).filter((value) => value !== null && value !== undefined).length
  }

  return {
    questionCount: questions.length,
    explicitAnswers,
    inferredAnswers,
    missingAnswers,
    imageReferences,
  }
}
