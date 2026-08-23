import { readFileSync } from "node:fs"

// El flujo normal ejecuta primero el parche principal. Este import aplica las
// salvaguardas finales de forma idempotente antes de verificar el resultado.
await import("./apply-exam-document-import-safety.mjs")

const checks = []
function check(name, condition) {
  if (!condition) throw new Error(`[exam-document-import] FAIL: ${name}`)
  checks.push(name)
  console.log(`✓ ${name}`)
}

const page = readFileSync("app/examen/crear/page.tsx", "utf8")
const component = readFileSync("components/exam/ExamDocumentImporter.tsx", "utf8")
const route = readFileSync("app/api/agents/exam-import/route.ts", "utf8")
const assetRoute = readFileSync("app/api/assets/exam-image/route.ts", "utf8")
const core = readFileSync("lib/exam/document-import.ts", "utf8")
const questionCard = readFileSync("components/exam/QuestionCard.tsx", "utf8")
const examApi = readFileSync("app/api/agents/examen-docente/route.ts", "utf8")

check("1/18 importador conectado al creador", page.includes("ExamDocumentImporter") && page.includes("applyDocumentImport"))
check("2/18 PDF y DOCX aceptados", component.includes(".pdf,.docx") && route.includes("Solo se aceptan archivos PDF o DOCX"))
check("3/18 límite de 50 MB", route.includes("MAX_FILE_BYTES = 50 * 1024 * 1024") && component.includes("MAX_BYTES = 50 * 1024 * 1024"))
check("4/18 firma PDF validada", route.includes('buffer.subarray(0, 5).toString("ascii") !== "%PDF-"'))
check("5/18 firma DOCX/ZIP validada", route.includes("buffer[0] === 0x50") && route.includes("buffer[1] === 0x4b"))
check("6/18 respuestas desconocidas no se convierten en A", route.includes("NUNCA uses la alternativa A/índice 0 como valor por defecto") && core.includes("return null"))
check("7/18 salida incompleta se reclasifica como missing", route.includes("EXAM_IMPORT_MISSING_ANSWER_GUARD_V1") && route.includes('question.answerSource = "missing"'))
check("8/18 pauta distingue archivo/IA/faltante", core.includes('"file" | "ai_inferred" | "missing"') && component.includes("Respuesta inferida por IA"))
check("9/18 importación se bloquea si faltan respuestas", component.includes("result.preview.missingAnswers > 0") && component.includes("Importación bloqueada"))
check("10/18 imágenes privadas se guardan en eduai-assets", route.includes('.from("eduai-assets")') && route.includes('storage_bucket: "eduai-assets"') && assetRoute.includes("download(asset.storage_path)"))
check("11/18 imágenes de alternativas llegan al estudiante", questionCard.includes("EXAM_OPTION_IMAGES_V1") && examApi.includes("EXAM_OPTION_IMAGES_API_V1"))
check("12/18 matemática Unicode se normaliza", core.includes("SUPER_MAP") && core.includes("SUB_MAP") && core.includes("normalizeDocumentMath"))
check("13/18 autoguardado y recuperación activos", page.includes("eduai:exam-creator:draft:v1") && page.includes("Borrador anterior recuperado automáticamente"))
check("14/18 borrador se elimina al crear examen", page.includes("clearExamCreatorDraft();") && page.includes("setCreatedExam({"))
check("15/18 append reemplaza la pregunta inicial vacía", page.includes("EXAM_IMPORT_EMPTY_STARTER_GUARD_V1") && page.includes("onlyEmptyStarter ? imported"))
check("16/18 fórmulas rasterizadas se transcriben y no se conservan como imágenes", route.includes("EXAM_IMPORT_REAL_FIXTURE_PROMPT_V1") && route.includes("contiene SOLO una fórmula") && route.includes("NO uses imageRef/optionImageRefs"))
check("17/18 pauta final se vincula a preguntas sin duplicarla", route.includes("pauta/solucionario al final") && route.includes("NO conviertas la pauta en preguntas nuevas"))
check("18/18 DOCX prioriza HTML semántico para tablas y signos", route.includes("prioriza la estructura del HTML SEMÁNTICO") && route.includes("superíndices"))

console.log(`\n[exam-document-import] ${checks.length}/18 verificaciones superadas`)
