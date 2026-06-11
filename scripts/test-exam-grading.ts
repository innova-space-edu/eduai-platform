import assert from "node:assert/strict"
import {
  calculateGradeFromPercentage,
  calculateScoreSummary,
  getQuestionMaxPoints,
} from "../lib/exam/grading"

assert.equal(calculateGradeFromPercentage(0, 60), 1)
assert.equal(calculateGradeFromPercentage(20, 60), 2)
assert.equal(calculateGradeFromPercentage(60, 60), 4)
assert.equal(calculateGradeFromPercentage(100, 60), 7)

const twentyPointExam = Array.from({ length: 10 }, () => ({
  type: "multiple_choice",
  maxPoints: 2,
}))
const twentyPointAnswers = Array.from({ length: 10 }, (_, index) => ({
  type: "multiple_choice",
  isCorrect: index < 2,
}))
const twentyPointSummary = calculateScoreSummary(twentyPointExam, twentyPointAnswers)
assert.deepEqual(twentyPointSummary, {
  earnedPoints: 4,
  totalPoints: 20,
  correctCount: 2,
  percentage: 20,
})
assert.equal(calculateGradeFromPercentage(twentyPointSummary.percentage, 60), 2)

const mixedExam = [
  { type: "true_false", selectionPoints: 1, justificationMaxPoints: 2 },
  {
    type: "development",
    rubric: [
      { criteria: "Procedimiento", points: 2 },
      { criteria: "Resultado", points: 3 },
    ],
  },
]
assert.equal(getQuestionMaxPoints(mixedExam[0]), 3)
assert.equal(getQuestionMaxPoints(mixedExam[1]), 5)

const mixedSummary = calculateScoreSummary(mixedExam, [
  { type: "true_false", selectionCorrect: true, justificationScore: 1 },
  { type: "development", manualScore: 4 },
])
assert.deepEqual(mixedSummary, {
  earnedPoints: 6,
  totalPoints: 8,
  correctCount: 1,
  percentage: 75,
})

console.log("✓ exam grading tests passed")
