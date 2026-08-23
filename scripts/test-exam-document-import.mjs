import { readFileSync, writeFileSync } from "node:fs"

// El flujo normal ejecuta primero el parche principal. Este import aplica las
// salvaguardas finales de forma idempotente antes de verificar el resultado.
await import("./apply-exam-document-import-safety.mjs")

// Reparación defensiva: el helper de segunda verificación se genera desde un
// template literal. Si una versión anterior dejó las comillas JSON sin escapar,
// corrige esa única línea antes de que Turbopack analice route.ts.
const routePath = "app/api/agents/exam-import/route.ts"
let routeSource = readFileSync(routePath, "utf8")
const malformedRetryPrompt = '    "Devuelve JSON estricto: {"answers":[{"index":0,"resolved":true,"correctAnswer":0,"modelAnswer":"","explanation":"","solutionSteps":[]}]}",'
const safeRetryPrompt = '    \'Devuelve JSON estricto: {"answers":[{"index":0,"resolved":true,"correctAnswer":0,"modelAnswer":"","explanation":"","solutionSteps":[]}]}\','
if (routeSource.includes(malformedRetryPrompt)) {
  routeSource = routeSource.replace(malformedRetryPrompt, safeRetryPrompt)
  writeFileSync(routePath, routeSource)
  console.log("[exam-document-import] comillas del prompt de segunda verificación reparadas")
}

const checks = []
function check(name, condition) {
  if (!condition) throw new Error(`[exam-document-import] FAIL: ${name}`)
  checks.push(name)
  console.log(`✓ ${name}`)
}

const page = readFileSync("app/examen/crear/page.tsx", "utf8")
const component = readFileSync("components/exam/ExamDocumentImporter.tsx", "utf8")
const route = readFileSync(routePath, "utf8")
const assetRoute = readFileSync("app/api/assets/exam-image/route.ts", "utf8")
const core = readFileSync("lib/exam/document-import.ts", "utf8")
const questionCard = readFileSync("components/exam/QuestionCard.tsx", "utf8")
const examApi = readFileSync("app/api/agents/examen-docente/route.ts", "utf8")

check("1/21 importador conectado al creador", page.includes("ExamDocumentImporter") && page.includes("applyDocumentImport"))
check("2/21 PDF y DOCX aceptados", component.includes(".pdf,.docx") && route.includes("Solo se aceptan archivos PDF o DOCX"))
check("3/21 límite de 50 MB", route.includes("MAX_FILE_BYTES = 50 * 1024 * 1024") && component.includes("MAX_BYTES = 50 * 1024 * 1024"))
check("4/21 firma PDF validada", route.includes('buffer.subarray(0, 5).toString("ascii") !== "%PDF-"'))
check("5/21 firma DOCX/ZIP validada", route.includes("buffer[0] === 0x50") && route.includes("buffer[1] === 0x4b"))
check("6/21 respuestas desconocidas no se convierten en A", route.includes("NUNCA uses la alternativa A/índice 0 como valor por defecto") && core.includes("return null"))
check("7/21 salida incompleta se reclasifica como missing", route.includes("EXAM_IMPORT_MISSING_ANSWER_GUARD_V1") && route.includes('question.answerSource = "missing"'))
check("8/21 pauta distingue archivo/IA/faltante", core.includes('"file" | "ai_inferred" | "missing"') && component.includes("Respuesta inferida por IA"))
check("9/21 importación se bloquea si faltan respuestas", component.includes("result.preview.missingAnswers > 0") && component.includes("Importación bloqueada"))
check("10/21 imágenes privadas se guardan en eduai-assets", route.includes('.from("eduai-assets")') && route.includes('storage_bucket: "eduai-assets"') && assetRoute.includes("download(asset.storage_path)"))
check("11/21 imágenes de alternativas llegan al estudiante", questionCard.includes("EXAM_OPTION_IMAGES_V1") && examApi.includes("EXAM_OPTION_IMAGES_API_V1"))
check("12/21 matemática Unicode se normaliza", core.includes("SUPER_MAP") && core.includes("SUB_MAP") && core.includes("normalizeDocumentMath"))
check("13/21 autoguardado y recuperación activos", page.includes("eduai:exam-creator:draft:v1") && page.includes("Borrador anterior recuperado automáticamente"))
check("14/21 borrador se elimina al crear examen", page.includes("clearExamCreatorDraft();") && page.includes("setCreatedExam({"))
check("15/21 append reemplaza la pregunta inicial vacía", page.includes("EXAM_IMPORT_EMPTY_STARTER_GUARD_V1") && page.includes("onlyEmptyStarter ? imported"))
check("16/21 fórmulas rasterizadas se transcriben y no se conservan como imágenes", route.includes("EXAM_IMPORT_REAL_FIXTURE_PROMPT_V1") && route.includes("contiene SOLO una fórmula") && route.includes("NO uses imageRef/optionImageRefs"))
check("17/21 pauta final se vincula a preguntas sin duplicarla", route.includes("pauta/solucionario al final") && route.includes("NO conviertas la pauta en preguntas nuevas"))
check("18/21 DOCX prioriza HTML semántico para tablas y signos", route.includes("prioriza la estructura del HTML SEMÁNTICO") && route.includes("superíndices"))
check("19/21 respuestas faltantes reciben segunda verificación IA", route.includes("EXAM_IMPORT_ANSWER_RETRY_V1") && route.includes("resolveMissingImportedAnswers") && route.includes("questions.some((question) => question.answerSource === \"missing\")"))
check("20/21 UI no pide activar IA cuando ya se intentó resolver", component.includes("EXAM_IMPORT_MISSING_ANSWER_UI_V1") && component.includes("segunda verificación") && component.includes("No asignará una alternativa por defecto"))
check("21/21 prompt JSON de segunda verificación conserva sintaxis válida", route.includes("'Devuelve JSON estricto: {\"answers\"") && !route.includes('"Devuelve JSON estricto: {"answers"'))

console.log(`\n[exam-document-import] ${checks.length}/21 verificaciones superadas`)
