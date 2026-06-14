export type ExamScoreSummary = {
  earnedPoints: number
  totalPoints: number
  correctCount: number
  percentage: number
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function roundToOneDecimal(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 10) / 10
}

export function clampPoints(value: unknown, min = 0, max = Number.POSITIVE_INFINITY): number {
  const n = asFiniteNumber(value, min)
  return Math.max(min, Math.min(max, roundToOneDecimal(n)))
}

export function normalizeExamPercentage(value: unknown, fallback = 60): number {
  const n = asFiniteNumber(value, fallback)
  // La fórmula de escala necesita un valor estrictamente entre 0 y 100.
  return Math.max(1, Math.min(99, roundToOneDecimal(n)))
}

export function calculateGradeFromPercentage(scorePercent: unknown, exigencia: unknown = 60): number {
  const percentage = Math.max(0, Math.min(100, asFiniteNumber(scorePercent, 0)))
  const requiredPercentage = normalizeExamPercentage(exigencia)

  const grade = percentage >= requiredPercentage
    ? 4 + ((percentage - requiredPercentage) * 3) / (100 - requiredPercentage)
    : 1 + (percentage * 3) / requiredPercentage

  return roundToOneDecimal(Math.max(1, Math.min(7, grade)))
}

export function getTrueFalsePointBreakdown(question: any): {
  selectionPoints: number
  justificationMaxPoints: number
  maxPoints: number
} {
  const selectionPoints = clampPoints(question?.selectionPoints ?? 1)
  const explicitMaxPoints = Number(question?.maxPoints)
  const fallbackJustification = Number.isFinite(explicitMaxPoints)
    ? Math.max(0, explicitMaxPoints - selectionPoints)
    : 2
  const justificationMaxPoints = clampPoints(
    question?.justificationMaxPoints ?? fallbackJustification,
  )

  return {
    selectionPoints,
    justificationMaxPoints,
    maxPoints: roundToOneDecimal(selectionPoints + justificationMaxPoints),
  }
}


export function getMixedChoiceDevelopmentPointBreakdown(question: any): {
  selectionPoints: number
  developmentMaxPoints: number
  maxPoints: number
} {
  const explicitMaxPoints = Number(question?.maxPoints)
  const selectionPoints = clampPoints(question?.selectionPoints ?? 3)
  const fallbackDevelopment = Number.isFinite(explicitMaxPoints)
    ? Math.max(0, explicitMaxPoints - selectionPoints)
    : 2
  const developmentMaxPoints = clampPoints(
    question?.developmentMaxPoints ?? fallbackDevelopment,
  )

  return {
    selectionPoints,
    developmentMaxPoints,
    maxPoints: roundToOneDecimal(selectionPoints + developmentMaxPoints),
  }
}

export function getQuestionMaxPoints(question: any): number {
  if (!question) return 1

  if (question.type === "true_false") {
    return getTrueFalsePointBreakdown(question).maxPoints
  }

  if (question.type === "mixed_choice_development") {
    return getMixedChoiceDevelopmentPointBreakdown(question).maxPoints
  }

  if (question.type === "development") {
    if (Array.isArray(question.rubric) && question.rubric.length > 0) {
      const rubricPoints = question.rubric.reduce(
        (acc: number, item: any) => acc + clampPoints(item?.points ?? item?.puntos ?? item?.puntaje ?? 0),
        0,
      )
      if (rubricPoints > 0) return roundToOneDecimal(rubricPoints)
    }

    return Math.max(1, clampPoints(question.maxPoints ?? 5))
  }

  return Math.max(1, clampPoints(question.maxPoints ?? 1))
}

export function calculateScoreSummary(questions: any[], answers: any[]): ExamScoreSummary {
  let earnedPoints = 0
  let totalPoints = 0
  let correctCount = 0

  ;(Array.isArray(questions) ? questions : []).forEach((question: any, index: number) => {
    const answer = Array.isArray(answers) ? answers[index] || {} : {}
    const maxPoints = getQuestionMaxPoints(question)
    totalPoints += maxPoints

    if (question?.type === "multiple_choice") {
      if (answer?.isCorrect === true) {
        earnedPoints += maxPoints
        correctCount += 1
      }
      return
    }

    if (question?.type === "mixed_choice_development") {
      const { selectionPoints, developmentMaxPoints } = getMixedChoiceDevelopmentPointBreakdown(question)
      const selectionCorrect = answer?.selectionCorrect === true || answer?.isCorrect === true
      const developmentScore = clampPoints(answer?.manualDevelopmentScore ?? answer?.developmentScore ?? answer?.aiScore ?? 0, 0, developmentMaxPoints)

      if (selectionCorrect) earnedPoints += selectionPoints
      earnedPoints += developmentScore

      if (selectionCorrect && developmentScore >= developmentMaxPoints) {
        correctCount += 1
      }
      return
    }

    if (question?.type === "true_false") {
      const { selectionPoints, justificationMaxPoints } = getTrueFalsePointBreakdown(question)
      const selectionCorrect = answer?.selectionCorrect === true || answer?.isCorrect === true
      const justificationScore = clampPoints(answer?.justificationScore ?? 0, 0, justificationMaxPoints)

      if (selectionCorrect) earnedPoints += selectionPoints
      earnedPoints += justificationScore

      // Una pregunta V/F se considera completamente correcta solo cuando alcanza
      // todo su puntaje. Las respuestas parciales conservan sus puntos, pero no
      // inflan la columna de preguntas correctas.
      if (selectionCorrect && justificationScore >= justificationMaxPoints) {
        correctCount += 1
      }
      return
    }

    if (question?.type === "development") {
      const scored = clampPoints(answer?.manualScore ?? answer?.aiScore ?? 0, 0, maxPoints)
      earnedPoints += scored
      if (maxPoints > 0 && scored / maxPoints >= 0.6) correctCount += 1
      return
    }
  })

  const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0

  return {
    earnedPoints: roundToOneDecimal(earnedPoints),
    totalPoints: roundToOneDecimal(totalPoints),
    correctCount,
    percentage: roundToOneDecimal(percentage),
  }
}

export function formatPoints(value: unknown): string {
  const n = roundToOneDecimal(asFiniteNumber(value, 0))
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
