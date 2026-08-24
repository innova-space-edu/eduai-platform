import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/examen/p/[code]/page.tsx"
const LATEX_FIX = "components/exam/ExamLatexAnswerFix.tsx"
const RESCORE_ROUTE = "app/api/agents/exam-math-rescore/route.ts"
const MARKER = "EXAM_RESULT_FEEDBACK_V2"
const SCORE_MARKER = "EXAM_RESULT_SCORE_SYNC_V3"
const EVIDENCE_MARKER = "EXAM_RESULT_EVIDENCE_SCOPE_V2"
const RESCORE_MERGE_MARKER = "EXAM_RESULT_RESCORE_MERGE_V3"
const RESCORE_ROUTE_MARKER = "EXAM_RESULT_RESCORE_FIELDS_V3"

function load(path) {
  if (!existsSync(path)) throw new Error(`[exam-result-feedback-v2] No existe ${path}`)
  return readFileSync(path, "utf8")
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[exam-result-feedback-v2] No se encontró ${label}`)
  return source.replace(from, to)
}

function patchResultPage() {
  let source = load(PAGE)
  if (source.includes(MARKER) && source.includes(SCORE_MARKER)) return

  source = replaceRequired(
    source,
    `    const nota =
      submission.grade ??
      calculateGradeFromPercentage(
        Number(submission.score || 0),
        exam?.settings?.examPercentage || 60,
      );
    const pct = Number(submission.score || 0);
    const graded = submission.answers || [];`,
    `    const graded = submission.answers || [];`,
    "cálculo antiguo de nota",
  )

  source = replaceRequired(
    source,
    `    const fallbackSummary = calculateScoreSummary(reviewQs, graded);`,
    `    // ${MARKER}
    const answeredReviewCount = reviewQs.reduce((count: number, question: any, index: number) => {
      const answer = graded[index] || {};
      if (question?.type === "development") {
        return count + (String(answer?.devText || "").trim() || String(answer?.developmentLatex || "").trim() ? 1 : 0);
      }
      if (question?.type === "mixed_choice_development") {
        const selected = Number(answer?.selectedAnswer);
        const hasSelection = Number.isInteger(selected) && selected >= 0;
        const hasDevelopment = Boolean(String(answer?.devText || "").trim() || String(answer?.developmentLatex || "").trim());
        return count + (hasSelection || hasDevelopment ? 1 : 0);
      }
      const selected = Number(answer?.selectedAnswer);
      return count + (Number.isInteger(selected) && selected >= 0 ? 1 : 0);
    }, 0);
    const fallbackSummary = calculateScoreSummary(reviewQs, graded);`,
    "contador de respuestas",
  )

  source = replaceRequired(
    source,
    `    const totalPoints = Number(
      submission.total_points ??
        fallbackSummary.totalPoints ??
        examTotalPoints ??
        0,
    );`,
    `    const totalPoints = Number(
      submission.total_points ??
        fallbackSummary.totalPoints ??
        examTotalPoints ??
        0,
    );

    // ${SCORE_MARKER}
    // La respuesta de recalificación matemática puede ser parcial. Nunca convertimos
    // un score ausente en 0: preservamos los puntos y recalculamos solo si hace falta.
    const hasSubmittedScore =
      submission.score !== null &&
      submission.score !== undefined &&
      String(submission.score).trim() !== "";
    const submittedScore = hasSubmittedScore ? Number(submission.score) : Number.NaN;
    const pointsPercentage =
      totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : Number.NaN;
    const displayPercentage = Number.isFinite(submittedScore)
      ? Math.max(0, Math.min(100, submittedScore))
      : Number.isFinite(pointsPercentage)
        ? Math.max(0, Math.min(100, pointsPercentage))
        : Math.max(0, Math.min(100, Number(fallbackSummary.percentage) || 0));

    const hasSubmittedGrade =
      submission.grade !== null &&
      submission.grade !== undefined &&
      String(submission.grade).trim() !== "";
    const submittedGrade = hasSubmittedGrade ? Number(submission.grade) : Number.NaN;
    const displayGrade =
      Number.isFinite(submittedGrade) && submittedGrade >= 1 && submittedGrade <= 7
        ? submittedGrade
        : calculateGradeFromPercentage(
            displayPercentage,
            exam?.settings?.examPercentage || 60,
          );`,
    "sincronización de nota y porcentaje",
  )

  source = replaceRequired(
    source,
    `{nota >= 5.5 ? "🎉" : nota >= 4.0 ? "📚" : "💪"}`,
    `{displayGrade >= 5.5 ? "🎉" : displayGrade >= 4.0 ? "📚" : "💪"}`,
    "ícono según nota",
  )

  source = replaceRequired(
    source,
    `                  Nota: {nota}`,
    `                  Nota: {displayGrade}`,
    "nota visible",
  )

  source = replaceRequired(
    source,
    `                  {nota >= 5.5
                    ? "¡Excelente trabajo!"
                    : nota >= 4.0
                      ? "Aprobado. ¡Bien hecho!"
                      : "Sigue practicando, puedes mejorar."}`,
    `                  {displayGrade >= 5.5
                    ? "¡Excelente trabajo!"
                    : displayGrade >= 4.0
                      ? "Aprobado. ¡Bien hecho!"
                      : "Sigue practicando, puedes mejorar."}`,
    "mensaje según nota",
  )

  source = replaceRequired(
    source,
    `                <div className="flex justify-center gap-8 mt-4">`,
    `                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">`,
    "resumen de resultado",
  )

  source = replaceRequired(
    source,
    `                      {Math.round(pct)}%`,
    `                      {Math.round(displayPercentage)}%`,
    "porcentaje visible",
  )

  source = replaceRequired(
    source,
    `                  <div>
                    <p className="text-muted2 text-xs">Tiempo</p>`,
    `                  <div>
                    <p className="text-muted2 text-xs">Respondidas</p>
                    <p className="text-blue-600 font-bold text-xl">
                      {answeredReviewCount}/{reviewQs.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted2 text-xs">Tiempo</p>`,
    "métrica respondidas",
  )

  source = replaceRequired(
    source,
    `                const baseCorrect = g.isCorrect === true;
                const tfSelPts =`,
    `                const baseCorrect = g.isCorrect === true;
                const selectedIndex = Number(g.selectedAnswer);
                const hasSelection = Number.isInteger(selectedIndex) && selectedIndex >= 0;
                const tfSelPts =`,
    "detección de respuesta",
  )

  source = replaceRequired(
    source,
    `                    : baseCorrect
                      ? "full"
                      : "wrong";`,
    `                    : !hasSelection
                      ? "unanswered"
                      : baseCorrect
                        ? "full"
                        : "wrong";`,
    "estado sin responder",
  )

  source = replaceRequired(
    source,
    `                  wrong: "border-red-200 bg-red-50",
                }[state];`,
    `                  wrong: "border-red-200 bg-red-50",
                  unanswered: "border-slate-200 bg-slate-50",
                }[state];`,
    "color sin responder",
  )

  source = replaceRequired(
    source,
    `                  wrong: "✗ Incorrecta",
                }[state];`,
    `                  wrong: "✗ Incorrecta",
                  unanswered: "○ Sin responder",
                }[state];`,
    "etiqueta sin responder",
  )

  source = replaceRequired(
    source,
    `                  wrong: "bg-red-100 text-red-700",
                }[state];`,
    `                  wrong: "bg-red-100 text-red-700",
                  unanswered: "bg-slate-100 text-slate-700",
                }[state];`,
    "badge sin responder",
  )

  source = replaceRequired(
    source,
    `                const studentAnswer = isDev
                  ? g.devText || "—"
                  : isTF
                    ? item.options?.[g.selectedAnswer] || "—"
                    : item.options?.[g.selectedAnswer] || "—";`,
    `                const studentAnswer = isDev
                  ? g.devText || "No registraste una respuesta de desarrollo."
                  : hasSelection
                    ? item.options?.[g.selectedAnswer] || "Respuesta registrada"
                    : "No respondiste esta pregunta.";`,
    "texto de respuesta del estudiante",
  )

  source = source.replace(
    `                            ? "Respuesta modelo registrada"
                            : "Respuesta correcta registrada"}`,
    `                            ? "Respuesta modelo"
                            : "Respuesta esperada"}`,
  )

  source = replaceRequired(
    source,
    `                          className={\`font-medium \${state === "full" ? "text-green-700" : state === "wrong" ? "text-red-700" : "text-amber-700"}\`}`,
    `                          className={\`font-medium \${state === "full" ? "text-green-700" : state === "wrong" ? "text-red-700" : state === "unanswered" ? "text-slate-600" : "text-amber-700"}\`}`,
    "color de respuesta",
  )

  source = source.replace(
    `                          ✦ Retroalimentación basada en la pauta`,
    `                          ✦ Explicación y retroalimentación`,
  )

  writeFileSync(PAGE, source)
}

function patchDevelopmentEvidence() {
  let source = load(LATEX_FIX)

  if (!source.includes(EVIDENCE_MARKER)) {
    source = replaceRequired(
      source,
      `function getArtifactFromStorage(examId: string, attemptId: string, index: number) {
  if (typeof window === "undefined") return null
  const exactKey = \`eduai-exam-notebook:\${examId}:\${attemptId}:\${index}\`
  const exact = parseJsonSafe(window.localStorage.getItem(exactKey))
  if (exact) return exact

  const suffix = \`:\${index}\`
  const candidates: any[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i) || ""
    if (!key.startsWith("eduai-exam-notebook:") || !key.endsWith(suffix)) continue
    const parsed = parseJsonSafe(window.localStorage.getItem(key))
    if (parsed) candidates.push(parsed)
  }

  candidates.sort((a, b) => Date.parse(String(b?.updatedAt || 0)) - Date.parse(String(a?.updatedAt || 0)))
  return candidates[0] || null
}`,
      `// ${EVIDENCE_MARKER}
function artifactHasContent(artifact: any) {
  if (!artifact || typeof artifact !== "object") return false
  if (String(artifact?.latex || artifact?.ocrText || "").trim()) return true
  if (typeof artifact?.previewPngDataUrl === "string" && artifact.previewPngDataUrl.trim()) return true
  const pages = Array.isArray(artifact?.pages) ? artifact.pages : []
  return pages.some((page: any) => Array.isArray(page?.strokes) && page.strokes.length > 0)
}

function getArtifactFromStorage(examId: string, attemptId: string, index: number) {
  if (typeof window === "undefined") return null
  const exactKey = \`eduai-exam-notebook:\${examId}:\${attemptId}:\${index}\`
  const exact = parseJsonSafe(window.localStorage.getItem(exactKey))
  return artifactHasContent(exact) ? exact : null
}`,
      "scope exacto del artefacto",
    )

    source = replaceRequired(
      source,
      `  if (!latex && !readable && !pages.length && !previewPngDataUrl) return answer`,
      `  const hasStrokes = pages.some((page: any) => Array.isArray(page?.strokes) && page.strokes.length > 0)
  if (!latex && !readable && !hasStrokes && !previewPngDataUrl) return answer`,
      "artefacto vacío",
    )

    source = replaceRequired(
      source,
      `function findArtifactForQuestion(index: number) {
  const latest = getLatestArtifactsFromWindow()
  if (latest[index]) return latest[index]

  if (typeof window === "undefined") return null
  const candidates: any[] = []
  const suffix = \`:\${index}\`
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i) || ""
    if (!key.startsWith("eduai-exam-notebook:") || !key.endsWith(suffix)) continue
    const parsed = parseJsonSafe(window.localStorage.getItem(key))
    if (parsed) candidates.push(parsed)
  }
  candidates.sort((a, b) => Date.parse(String(b?.updatedAt || 0)) - Date.parse(String(a?.updatedAt || 0)))
  return candidates[0] || null
}`,
      `function findArtifactForQuestion(index: number) {
  const latest = getLatestArtifactsFromWindow()
  const artifact = latest[index]
  return artifactHasContent(artifact) ? artifact : null
}`,
      "artefacto de la entrega actual",
    )

    source = replaceRequired(
      source,
      `    const card = findSmallestQuestionCard(index + 1)
    if (!card || card.querySelector(\`[data-eduai-dev-evidence="\${index}"]\`)) continue`,
      `    const card = findSmallestQuestionCard(index + 1)
    if (!card || card.querySelector(\`[data-eduai-dev-evidence="\${index}"]\`)) continue
    const cardText = (card.textContent || "").toLowerCase()
    if (!cardText.includes("desarrollo")) continue`,
      "evidencia solo en desarrollo",
    )
  }

  if (!source.includes(RESCORE_MERGE_MARKER)) {
    source = replaceRequired(
      source,
      `      return { ...data, submission: rescored.submission }`,
      `      // ${RESCORE_MERGE_MARKER}
      // El endpoint de recalificación puede devolver solo id/exam_id/answers.
      // Se fusiona sobre la entrega original para no perder grade, score ni puntajes.
      return {
        ...data,
        submission: {
          ...data.submission,
          ...rescored.submission,
          answers: Array.isArray(rescored.submission?.answers)
            ? rescored.submission.answers
            : data.submission?.answers,
        },
      }`,
      "preservación de nota tras recalificación",
    )
  }

  writeFileSync(LATEX_FIX, source)
}

function patchMathRescoreRoute() {
  let source = load(RESCORE_ROUTE)
  if (source.includes(RESCORE_ROUTE_MARKER)) return

  const oldSelect = `.select("id, exam_id, answers")`
  if (!source.includes(oldSelect)) {
    throw new Error("[exam-result-feedback-v2] No se encontró select parcial de exam-math-rescore")
  }

  const fullSelect = `.select("id, exam_id, answers, score, grade, correct_count, total_questions, earned_points, total_points, time_spent")`
  source = source.replaceAll(oldSelect, fullSelect)
  source = source.replace(
    `type Fraction = { n: number; d: number }`,
    `// ${RESCORE_ROUTE_MARKER}
type Fraction = { n: number; d: number }`,
  )
  writeFileSync(RESCORE_ROUTE, source)
}

patchResultPage()
patchDevelopmentEvidence()
patchMathRescoreRoute()
console.log("[exam-result-feedback-v2] nota, estados, retroalimentación y lienzos de resultados corregidos")
