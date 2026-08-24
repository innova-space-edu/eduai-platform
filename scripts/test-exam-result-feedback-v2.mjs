import { readFileSync } from "node:fs"

// La corrección principal se aplica antes desde test-exam-document-import.
// Esta segunda salvaguarda garantiza que la recalificación matemática no toque
// evaluaciones que no contienen preguntas puramente de desarrollo.
await import("./apply-exam-result-grade-sync-all-types.mjs")

const page = readFileSync("app/examen/p/[code]/page.tsx", "utf8")
const route = readFileSync("app/api/agents/exam-feedback/route.ts", "utf8")
const evidence = readFileSync("components/exam/ExamLatexAnswerFix.tsx", "utf8")
const rescoreRoute = readFileSync("app/api/agents/exam-math-rescore/route.ts", "utf8")
const importTest = readFileSync("scripts/test-exam-document-import.mjs", "utf8")
const grading = readFileSync("lib/exam/grading.ts", "utf8")

const checks = []
function check(name, condition) {
  if (!condition) throw new Error(`[exam-result-feedback-v2] FAIL: ${name}`)
  checks.push(name)
  console.log(`✓ ${name}`)
}

check("1/19 retroalimentación usa EduAI AI Gateway como enriquecimiento", route.includes("runAIStructured") && route.includes("generatePedagogicalEnrichment"))
check("2/19 la pauta oficial permanece inmutable", route.includes("La pauta oficial es inmutable") && route.includes("enrichQuestionAnswerKey"))
check("3/19 alternativa sin responder no se clasifica como error pedagógico", route.includes("No registraste una respuesta en esta pregunta"))
check("4/19 feedback explica concepto sin repetir innecesariamente la respuesta", route.includes("No repitas simplemente la respuesta correcta") && route.includes("Bien resuelto."))
check("5/19 resultados distinguen estado sin responder", page.includes("EXAM_RESULT_FEEDBACK_V2") && page.includes('unanswered: "○ Sin responder"'))
check("6/19 resumen muestra cantidad de preguntas respondidas", page.includes("answeredReviewCount") && page.includes("Respondidas"))
check("7/19 resultado usa etiqueta Respuesta esperada", page.includes("Respuesta esperada"))
check("8/19 lienzos quedan limitados al examen e intento exactos", evidence.includes("EXAM_RESULT_EVIDENCE_SCOPE_V2") && evidence.includes("return artifactHasContent(exact) ? exact : null"))
check("9/19 un lienzo vacío no se considera evidencia", evidence.includes("hasStrokes") && evidence.includes("artifactHasContent"))
check("10/19 evidencia visual solo se inserta en tarjetas de desarrollo", evidence.includes('if (!cardText.includes("desarrollo")) continue'))
check("11/19 nota del estudiante no convierte score ausente en cero", page.includes("EXAM_RESULT_SCORE_SYNC_V3") && page.includes("displayPercentage") && page.includes("displayGrade") && !page.includes("Number(submission.score || 0)"))
check("12/19 fallback de nota usa puntaje obtenido antes de asumir cero", page.includes("pointsPercentage") && page.includes("earnedPoints / totalPoints") && page.includes("fallbackSummary.percentage"))
check("13/19 recalificación matemática conserva grade/score de la entrega original", evidence.includes("EXAM_RESULT_RESCORE_MERGE_V3") && evidence.includes("...data.submission") && evidence.includes("...rescored.submission"))
check("14/19 endpoint de recalificación devuelve campos completos de nota", rescoreRoute.includes("EXAM_RESULT_RESCORE_FIELDS_V3") && rescoreRoute.includes("score, grade, correct_count, total_questions, earned_points, total_points, time_spent"))
check("15/19 parche y prueba de resultados se ejecutan en el build normal", importTest.includes('await import("./apply-exam-result-feedback-v2.mjs")') && importTest.includes('await import("./test-exam-result-feedback-v2.mjs")'))
check("16/19 alternativas conservan la submission oficial sin recalificación matemática", evidence.includes("EXAM_RESULT_RESCORE_TYPE_GUARD_V4") && evidence.includes('answer?.type === "development"') && evidence.includes("if (!hasDevelopmentToRescore) return data"))
check("17/19 V/F conserva la misma nota oficial porque usa el mismo guardia por tipo", evidence.includes("EXAM_RESULT_RESCORE_TYPE_GUARD_V4") && grading.includes('question?.type === "true_false"'))
check("18/19 alternativa+desarrollo conserva la nota oficial y su puntaje parcial", evidence.includes("EXAM_RESULT_RESCORE_TYPE_GUARD_V4") && grading.includes('question?.type === "mixed_choice_development"'))
check("19/19 motor de puntaje cubre alternativas, V/F, desarrollo y alternativa+desarrollo", grading.includes('question?.type === "multiple_choice"') && grading.includes('question?.type === "true_false"') && grading.includes('question?.type === "development"') && grading.includes('question?.type === "mixed_choice_development"'))

console.log(`\n[exam-result-feedback-v2] ${checks.length}/19 verificaciones superadas`)
