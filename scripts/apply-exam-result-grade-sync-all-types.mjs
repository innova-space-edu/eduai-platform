import { existsSync, readFileSync, writeFileSync } from "node:fs"

const LATEX_FIX = "components/exam/ExamLatexAnswerFix.tsx"
const MARKER = "EXAM_RESULT_RESCORE_TYPE_GUARD_V4"

if (!existsSync(LATEX_FIX)) {
  throw new Error(`[exam-result-grade-sync] No existe ${LATEX_FIX}`)
}

let source = readFileSync(LATEX_FIX, "utf8")

if (!source.includes(MARKER)) {
  const from = `async function tryRescoreSubmission(originalFetch: typeof fetch, data: any) {
  const submissionId = data?.submission?.id
  if (!submissionId) return data

  try {`

  const to = `async function tryRescoreSubmission(originalFetch: typeof fetch, data: any) {
  const submissionId = data?.submission?.id
  if (!submissionId) return data

  // ${MARKER}
  // La recalificación matemática solo corresponde a preguntas puramente de desarrollo.
  // Alternativas, V/F y alternativa+desarrollo conservan directamente la submission
  // oficial devuelta por el servidor, evitando reemplazos innecesarios de nota/score.
  const submissionAnswers = Array.isArray(data?.submission?.answers)
    ? data.submission.answers
    : []
  const hasDevelopmentToRescore = submissionAnswers.some(
    (answer: any) => answer?.type === "development",
  )
  if (!hasDevelopmentToRescore) return data

  try {`

  if (!source.includes(from)) {
    throw new Error("[exam-result-grade-sync] No se encontró tryRescoreSubmission para aplicar guardia por tipo")
  }

  source = source.replace(from, to)
  writeFileSync(LATEX_FIX, source)
  console.log("[exam-result-grade-sync] recalificación matemática limitada a desarrollo; nota oficial preservada para todos los tipos")
}
