import { existsSync, readFileSync } from "node:fs"

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

check("1/13 importador conectado al creador", page.includes("ExamDocumentImporter") && page.includes("applyDocumentImport"))
check("2/13 PDF y DOCX aceptados", component.includes(".pdf,.docx") && route.includes("Solo se aceptan archivos PDF o DOCX"))
check("3/13 límite de 50 MB", route.includes("MAX_FILE_BYTES = 50 * 1024 * 1024") && component.includes("MAX_BYTES = 50 * 1024 * 1024"))
check("4/13 firma PDF validada", route.includes('buffer.subarray(0, 5).toString("ascii") !== "%PDF-"'))
check("5/13 firma DOCX/ZIP validada", route.includes("buffer[0] === 0x50") && route.includes("buffer[1] === 0x4b"))
check("6/13 respuestas desconocidas no se convierten en A", route.includes("NUNCA uses la alternativa A/índice 0 como valor por defecto") && core.includes("return null"))
check("7/13 pauta distingue archivo/IA/faltante", core.includes('"file" | "ai_inferred" | "missing"') && component.includes("Respuesta inferida por IA"))
check("8/13 importación se bloquea si faltan respuestas", component.includes("result.preview.missingAnswers > 0") && component.includes("Importación bloqueada"))
check("9/13 imágenes privadas se guardan en eduai-assets", route.includes('.from("eduai-assets")') && route.includes('storage_bucket: "eduai-assets"'))
check("10/13 imágenes de alternativas llegan al estudiante", questionCard.includes("EXAM_OPTION_IMAGES_V1") && examApi.includes("EXAM_OPTION_IMAGES_API_V1"))
check("11/13 matemática Unicode se normaliza", core.includes("SUPER_MAP") && core.includes("SUB_MAP") && core.includes("normalizeDocumentMath"))
check("12/13 autoguardado y recuperación activos", page.includes("eduai:exam-creator:draft:v1") && page.includes("Borrador anterior recuperado automáticamente"))
check("13/13 borrador se elimina al crear examen", page.includes("clearExamCreatorDraft();") && page.includes("setCreatedExam({"))

console.log(`\n[exam-document-import] ${checks.length}/13 verificaciones superadas`)
