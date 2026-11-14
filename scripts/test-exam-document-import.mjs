import { readFileSync, writeFileSync } from "node:fs"

// El flujo normal ejecuta primero el parche principal. Este import aplica las
// salvaguardas finales de forma idempotente antes de verificar el resultado.
await import("./apply-exam-document-import-safety.mjs")
await import("./apply-exam-result-feedback-v2.mjs")

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
check("3/21 límite de carga compartido", route.includes("MAX_FILE_BYTES = EXAM_IMPORT_MAX_BYTES") && component.includes("MAX_BYTES = EXAM_IMPORT_MAX_BYTES"))
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
check("14/21 borrador se elimina al crear examen", page.includes("await clearExamCreatorDraft();") && page.includes("setCreatedExam({"))
check("15/21 append reemplaza la pregunta inicial vacía", page.includes("EXAM_IMPORT_EMPTY_STARTER_GUARD_V1") && page.includes("appendExamQuestions(current, imported)"))
check("16/21 fórmulas rasterizadas se transcriben y no se conservan como imágenes", route.includes("EXAM_IMPORT_REAL_FIXTURE_PROMPT_V1") && route.includes("contiene SOLO una fórmula") && route.includes("NO uses imageRef/optionImageRefs"))
check("17/21 pauta final se vincula a preguntas sin duplicarla", route.includes("pauta/solucionario al final") && route.includes("NO conviertas la pauta en preguntas nuevas"))
check("18/21 DOCX prioriza HTML semántico para tablas y signos", route.includes("prioriza la estructura del HTML SEMÁNTICO") && route.includes("superíndices"))
check("19/21 respuestas faltantes reciben segunda verificación IA", route.includes("EXAM_IMPORT_ANSWER_RETRY_V1") && route.includes("resolveMissingImportedAnswers") && route.includes("questions.some((question) => question.answerSource === \"missing\")"))
check("20/21 UI no pide activar IA cuando ya se intentó resolver", component.includes("EXAM_IMPORT_MISSING_ANSWER_UI_V1") && component.includes("segunda verificación") && component.includes("No asignará una alternativa por defecto"))
check("21/21 prompt JSON de segunda verificación conserva sintaxis válida", route.includes("'Devuelve JSON estricto: {\"answers\"") && !route.includes('"Devuelve JSON estricto: {"answers"'))

check("22/25 módulos PDF y generación son secciones hermanas", page.indexOf('id="exam-section-archivo"') >= 0 && page.indexOf('<ExamDocumentImporter onApply={applyDocumentImport}') < page.indexOf('id="exam-section-ia"') && page.includes('id: "archivo"'))
check("23/25 cancelación y protección contra respuestas obsoletas", component.includes("requestRef.current !== controller") && component.includes("signal: controller.signal") && page.includes("abortRef.current !== controller"))
check("24/25 aplicar solo agrega y evita duplicados", component.includes("applyingRef.current") && page.includes("appendExamQuestions"))
check("25/25 referencias de imágenes ausentes permanecen nulas", core.includes("function optionalReference") && core.includes("optionalReference(raw?.imageRef)"))
check("26/29 editor manual unificado e imágenes por alternativa", page.includes("EXAM_MANUAL_UNIFIED_V1") && page.split("<ExamImageEditor").length === 4 && page.includes("ManualQuestionTools"))
check("27/29 reutilización de material, duplicar y ordenar", page.includes("reuseStimulus") && page.includes("copyStimulusTo") && page.includes("duplicateQuestion") && page.includes("moveQuestion"))
check("28/29 OA manual, autoguardado y selección explícita", page.includes("Vincular OA obligatoriamente (manual e IA)") && page.includes("draft.aiRequireOA") && page.includes("Selecciona explícitamente la respuesta correcta"))
check("29/29 subida de imágenes autenticada", assetRoute.includes("export async function POST") && assetRoute.includes("session.auth.getUser()") && assetRoute.includes("Formato de imagen no permitido"))
check("30/33 cinco etapas reales", page.includes("EXAM_CREATOR_WIZARD_V1") && page.includes("activeStep !== 3") && page.includes("creationMethod"))
check("31/33 borrador conserva vista previa y lote", page.includes("generationCache:generationCacheRef.current") && page.includes("documentPreview") && page.includes("useExamCreatorDraft"))
check("32/33 editor plegable", page.includes("openQuestionId!==q.id") && page.includes("Plegar todas"))
check("33/33 importador conserva análisis", component.includes("controlledResult") && page.includes("onResultChange={setDocumentPreview}"))
check("34/34 volver a Agentes conserva el borrador", page.includes("Volver a Agentes") && page.includes('await saveNow();router.push("/agentes")') && page.includes("leaveForAgents"))
check("35/36 editor visual y revisión compacta", page.includes("EXAM_VISUAL_REVIEW_V1") && page.includes("Abrir todas") && page.includes("ExamVisualEditor") && page.includes("sticky top-[176px]"))
check("36/36 verificador Python en revisión", page.includes("<ExamPythonReview questions={questions}/>"))
console.log(`\n[exam-document-import] ${checks.length}/36 verificaciones superadas`)
await import("./test-exam-result-feedback-v2.mjs")
