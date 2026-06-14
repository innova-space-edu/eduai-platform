export type QuestionQualitySeverity = "warning" | "error"

export type QuestionQualityIssue = {
  code: string
  message: string
  severity: QuestionQualitySeverity
}

export type AnswerKeyEntry = {
  index: number
  type: "multiple_choice" | "true_false" | "development" | "mixed_choice_development"
  question: string
  answerText: string
  explanation: string
  solutionSteps: string[]
  correctAnswer?: number
  options?: string[]
  expectedLatex?: string
  rubric?: any[]
  qualityStatus: "ready" | "review"
  qualityWarnings: string[]
}

function asText(value: unknown): string {
  return String(value ?? "").trim()
}

function cleanForCompare(value: unknown): string {
  return asText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.$`*_]/g, "")
    .trim()
}

function asSteps(value: unknown, fallback = ""): string[] {
  const steps = Array.isArray(value)
    ? value.map(asText).filter(Boolean)
    : []
  if (steps.length > 0) return steps
  return fallback ? [fallback] : []
}

export function normalizeAnswerIndex(value: unknown, options: string[]): number {
  const max = Math.max(0, options.length - 1)
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(max, Math.round(value)))
  }
  if (typeof value === "boolean" && options.length === 2) {
    return value ? 0 : 1
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase()
    const n = Number(trimmed)
    if (Number.isFinite(n)) return Math.max(0, Math.min(max, Math.round(n)))
    const letters = ["a", "b", "c", "d", "e", "f"]
    const byLetter = letters.indexOf(trimmed)
    if (byLetter >= 0) return Math.max(0, Math.min(max, byLetter))
    const byText = options.findIndex((item: string) => cleanForCompare(item) === cleanForCompare(trimmed))
    if (byText >= 0) return byText
  }
  return 0
}

export function assessQuestionQuality(question: any): QuestionQualityIssue[] {
  const issues: QuestionQualityIssue[] = []
  const type = question?.type

  if (!asText(question?.question)) {
    issues.push({ code: "missing_question", message: "Falta el enunciado.", severity: "error" })
  }

  if (type === "multiple_choice" || type === "mixed_choice_development") {
    const options: string[] = Array.isArray(question?.options)
      ? question.options.map((item: unknown) => asText(item))
      : []
    if (options.length !== 4) {
      issues.push({ code: "mc_option_count", message: "Debe contener exactamente 4 alternativas.", severity: "error" })
    }
    if (options.some((item: string) => !item)) {
      issues.push({ code: "mc_empty_option", message: "Hay alternativas vacías.", severity: "error" })
    }
    const unique = new Set(options.map((item: string) => cleanForCompare(item)).filter(Boolean))
    if (unique.size !== options.filter((item: string) => Boolean(item)).length) {
      issues.push({ code: "mc_duplicate_option", message: "Hay alternativas repetidas o equivalentes en texto.", severity: "error" })
    }
    const idx = normalizeAnswerIndex(question?.correctAnswer, options)
    if (!options[idx]) {
      issues.push({ code: "mc_invalid_answer_index", message: "El índice de la alternativa correcta no apunta a una opción válida.", severity: "error" })
    }
    if (options[idx] && cleanForCompare(question?.answerText) !== cleanForCompare(options[idx])) {
      issues.push({ code: "mc_answer_text_mismatch", message: "La respuesta declarada no coincide con options[correctAnswer].", severity: "error" })
    }
    if (!asText(question?.explanation)) {
      issues.push({ code: "missing_explanation", message: "Falta la explicación de la respuesta correcta.", severity: "warning" })
    }
    if (!Array.isArray(question?.solutionSteps) || question.solutionSteps.length === 0) {
      issues.push({ code: "missing_solution_steps", message: "Faltan pasos o fundamento de la solución.", severity: "warning" })
    }
    if (!Array.isArray(question?.distractorRationales) || question.distractorRationales.length !== options.length) {
      issues.push({ code: "missing_distractor_rationales", message: "Falta justificar los distractores para revisar su coherencia.", severity: "warning" })
    }
  }

  if (type === "mixed_choice_development") {
    q.modelAnswer = asText(q.modelAnswer ?? q.expectedAnswer ?? q.respuestaModelo)
    q.expectedLatex = asText(q.expectedLatex ?? q.expected_latex)
    q.rubric = Array.isArray(q.rubric) ? q.rubric : []
    q.showRubricToStudent = q.showRubricToStudent === true
  }

  if (type === "true_false") {
    const answerText = asText(question?.answerText)
    if (!["Verdadero", "Falso"].includes(answerText)) {
      issues.push({ code: "tf_answer_text", message: "La respuesta debe ser Verdadero o Falso.", severity: "error" })
    }
    if (!asText(question?.explanation)) {
      issues.push({ code: "missing_explanation", message: "Falta justificar por qué la afirmación es verdadera o falsa.", severity: "warning" })
    }
  }

  if (type === "mixed_choice_development") {
    if (!asText(question?.modelAnswer)) {
      issues.push({ code: "missing_model_answer", message: "Falta la respuesta modelo para revisar el desarrollo.", severity: "warning" })
    }
    if (!Array.isArray(question?.rubric) || question.rubric.length === 0) {
      issues.push({ code: "missing_rubric", message: "Falta la rúbrica del desarrollo adicional.", severity: "warning" })
    }
  }

  if (type === "development") {
    if (!asText(question?.modelAnswer)) {
      issues.push({ code: "missing_model_answer", message: "Falta la respuesta modelo para corregir el desarrollo.", severity: "error" })
    }
    if (!Array.isArray(question?.solutionSteps) || question.solutionSteps.length === 0) {
      issues.push({ code: "missing_solution_steps", message: "Faltan pasos esperados de la solución.", severity: "warning" })
    }
    if (!Array.isArray(question?.rubric) || question.rubric.length === 0) {
      issues.push({ code: "missing_rubric", message: "Falta la rúbrica de la pregunta de desarrollo.", severity: "error" })
    }
  }

  return issues
}

export function enrichQuestionAnswerKey(rawQuestion: any): any {
  const q = { ...(rawQuestion || {}) }
  const type: "multiple_choice" | "true_false" | "development" | "mixed_choice_development" =
    q.type === "true_false" || q.type === "development" || q.type === "mixed_choice_development" ? q.type : "multiple_choice"
  q.type = type

  if (type === "multiple_choice" || type === "mixed_choice_development") {
    q.options = Array.isArray(q.options)
      ? q.options.map((item: unknown) => asText(item))
      : []
    q.correctAnswer = normalizeAnswerIndex(q.correctAnswer, q.options)
    const correctOption = asText(q.options[q.correctAnswer])
    q.answerText = correctOption
    q.correctAnswerText = correctOption
    q.explanation = asText(q.explanation)
    q.solutionSteps = asSteps(q.solutionSteps ?? q.steps, q.explanation)
    q.distractorRationales = Array.isArray(q.distractorRationales)
      ? q.distractorRationales.map((item: unknown) => asText(item))
      : Array.isArray(q.distractor_reasons)
        ? q.distractor_reasons.map((item: unknown) => asText(item))
        : []
  }

  if (type === "mixed_choice_development") {
    q.modelAnswer = asText(q.modelAnswer ?? q.expectedAnswer ?? q.respuestaModelo)
    q.expectedLatex = asText(q.expectedLatex ?? q.expected_latex)
    q.rubric = Array.isArray(q.rubric) ? q.rubric : []
    q.showRubricToStudent = q.showRubricToStudent === true
  }

  if (type === "true_false") {
    q.options = ["Verdadero", "Falso"]
    q.correctAnswer = normalizeAnswerIndex(q.correctAnswer, q.options)
    q.answerText = q.correctAnswer === 0 ? "Verdadero" : "Falso"
    q.correctAnswerText = q.answerText
    q.explanation = asText(q.explanation)
    q.solutionSteps = asSteps(q.solutionSteps ?? q.steps, q.explanation)
  }

  if (type === "development") {
    q.modelAnswer = asText(q.modelAnswer ?? q.expectedAnswer ?? q.respuestaModelo)
    q.expectedLatex = asText(q.expectedLatex ?? q.expected_latex)
    q.answerText = q.modelAnswer
    q.explanation = asText(q.explanation)
    q.solutionSteps = asSteps(q.solutionSteps ?? q.steps, q.modelAnswer)
    q.rubric = Array.isArray(q.rubric) ? q.rubric : []
  }

  const issues = assessQuestionQuality(q)
  q.qualityStatus = issues.some((issue: QuestionQualityIssue) => issue.severity === "error") ? "review" : "ready"
  q.qualityWarnings = issues.map((issue: QuestionQualityIssue) => issue.message)
  return q
}

export function findBlockingQualityIssues(questions: any[]): Array<{ index: number; issues: QuestionQualityIssue[] }> {
  return (Array.isArray(questions) ? questions : [])
    .map((question: any, index: number) => ({ index, issues: assessQuestionQuality(question) }))
    .filter((item: { index: number; issues: QuestionQualityIssue[] }) => item.issues.some((issue: QuestionQualityIssue) => issue.severity === "error"))
}

export function buildAnswerKey(questions: any[]): AnswerKeyEntry[] {
  return (Array.isArray(questions) ? questions : []).map((raw, index) => {
    const q = enrichQuestionAnswerKey(raw)
    return {
      index,
      type: q.type,
      question: asText(q.question),
      answerText: asText(q.answerText),
      explanation: asText(q.explanation),
      solutionSteps: asSteps(q.solutionSteps),
      correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : undefined,
      options: Array.isArray(q.options)
        ? q.options.map((item: unknown) => asText(item))
        : undefined,
      expectedLatex: asText(q.expectedLatex) || undefined,
      rubric: Array.isArray(q.rubric) ? q.rubric : undefined,
      qualityStatus: q.qualityStatus,
      qualityWarnings: Array.isArray(q.qualityWarnings) ? q.qualityWarnings : [],
    }
  })
}
