import { readFileSync } from "node:fs"

const page = readFileSync("app/examen/p/[code]/page.tsx", "utf8")
const route = readFileSync("app/api/agents/exam-feedback/route.ts", "utf8")
const evidence = readFileSync("components/exam/ExamLatexAnswerFix.tsx", "utf8")

const checks = []
function check(name, condition) {
  if (!condition) throw new Error(`[exam-result-feedback-v2] FAIL: ${name}`)
  checks.push(name)
  console.log(`✓ ${name}`)
}

check("1/10 retroalimentación usa EduAI AI Gateway como enriquecimiento", route.includes("runAIStructured") && route.includes("generatePedagogicalEnrichment"))
check("2/10 la pauta oficial permanece inmutable", route.includes("La pauta oficial es inmutable") && route.includes("enrichQuestionAnswerKey"))
check("3/10 alternativa sin responder no se clasifica como error pedagógico", route.includes("No registraste una respuesta en esta pregunta"))
check("4/10 feedback explica concepto sin repetir innecesariamente la respuesta", route.includes("No repitas simplemente la respuesta correcta") && route.includes("Bien resuelto."))
check("5/10 resultados distinguen estado sin responder", page.includes("EXAM_RESULT_FEEDBACK_V2") && page.includes('unanswered: "○ Sin responder"'))
check("6/10 resumen muestra cantidad de preguntas respondidas", page.includes("answeredReviewCount") && page.includes("Respondidas"))
check("7/10 resultado usa etiqueta Respuesta esperada", page.includes("Respuesta esperada"))
check("8/10 lienzos quedan limitados al examen e intento exactos", evidence.includes("EXAM_RESULT_EVIDENCE_SCOPE_V2") && evidence.includes("return artifactHasContent(exact) ? exact : null"))
check("9/10 un lienzo vacío no se considera evidencia", evidence.includes("hasStrokes") && evidence.includes("artifactHasContent"))
check("10/10 evidencia visual solo se inserta en tarjetas de desarrollo", evidence.includes('if (!cardText.includes("desarrollo")) continue'))

console.log(`\n[exam-result-feedback-v2] ${checks.length}/10 verificaciones superadas`)
