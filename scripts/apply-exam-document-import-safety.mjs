import { existsSync, readFileSync, writeFileSync } from "node:fs"

const ROUTE = "app/api/agents/exam-import/route.ts"
const PAGE = "app/examen/crear/page.tsx"
const COMPONENT = "components/exam/ExamDocumentImporter.tsx"
const ROUTE_MARKER = "EXAM_IMPORT_MISSING_ANSWER_GUARD_V1"
const PAGE_MARKER = "EXAM_IMPORT_EMPTY_STARTER_GUARD_V1"
const PROMPT_MARKER = "EXAM_IMPORT_REAL_FIXTURE_PROMPT_V1"
const RETRY_MARKER = "EXAM_IMPORT_ANSWER_RETRY_V1"
const UI_MARKER = "EXAM_IMPORT_MISSING_ANSWER_UI_V1"

function load(path) {
  if (!existsSync(path)) throw new Error(`[exam-import-safety] No existe ${path}`)
  return readFileSync(path, "utf8")
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[exam-import-safety] No se encontró ${label}`)
  return source.replace(from, to)
}

function patchRoute() {
  let source = load(ROUTE)
  if (source.includes(ROUTE_MARKER)) return

  source = replaceRequired(
    source,
    "    const stats = summarizeImportedQuestions(questions)\n    const imageAttachment = await attachPersistedImages(user.id, parsed, questions)",
    `    // ${ROUTE_MARKER}
    // Una respuesta solo cuenta como disponible si además existe el dato real.
    // Esto impide que un output incompleto de IA termine normalizado como índice 0/A.
    for (const question of questions) {
      const hasAnswer = question.type === "development"
        ? Boolean(String(question.modelAnswer || question.expectedLatex || "").trim())
        : question.correctAnswer !== null && question.correctAnswer !== undefined

      if (!hasAnswer) question.answerSource = "missing"
    }

    const stats = summarizeImportedQuestions(questions)
    const imageAttachment = await attachPersistedImages(user.id, parsed, questions)`,
    "guard de respuestas faltantes",
  )

  writeFileSync(ROUTE, source)
}

function patchAnswerRetry() {
  let source = load(ROUTE)
  if (source.includes(RETRY_MARKER)) return

  const helper = `// ${RETRY_MARKER}
function localizeImportWarning(value: string) {
  const warning = String(value || "").trim()
  const mismatch = warning.match(/^The calculated answer \\((.+)\\) does not match any of the provided options\\.?$/i)
  if (mismatch) {
    return "La respuesta calculada (" + mismatch[1] + ") no coincide con ninguna de las alternativas detectadas. EduAI la revisará de nuevo antes de asignar una respuesta."
  }
  return warning
}

async function resolveMissingImportedAnswers(model: any, questions: ImportedExamQuestion[]) {
  const pending = questions
    .map((question, index) => ({
      index,
      type: question.type,
      question: question.question,
      options: question.options || [],
    }))
    .filter((item) => questions[item.index].answerSource === "missing")

  if (!pending.length) return [] as string[]

  const retryPrompt = [
    "Eres el verificador final de respuestas del importador de evaluaciones de EduAI.",
    "Resuelve SOLO las preguntas pendientes. No cambies enunciados ni alternativas.",
    "Para multiple_choice y true_false devuelve correctAnswer como índice 0-based de una alternativa EXISTENTE.",
    "Para true_false: 0=Verdadero y 1=Falso.",
    "Para development devuelve modelAnswer no vacío y, si ayuda, explanation y solutionSteps.",
    "Si ninguna alternativa coincide matemáticamente con la respuesta correcta, usa resolved=false y NO inventes un índice.",
    "Devuelve JSON estricto: {\"answers\":[{\"index\":0,\"resolved\":true,\"correctAnswer\":0,\"modelAnswer\":\"\",\"explanation\":\"\",\"solutionSteps\":[]}]}",
    "PREGUNTAS PENDIENTES:",
    JSON.stringify(pending),
  ].join("\\n")

  try {
    const retryResult = await model.generateContent([{ text: retryPrompt }])
    const retryPayload = safeJson(retryResult.response.text())
    const answers = Array.isArray(retryPayload?.answers) ? retryPayload.answers : []
    const answerByIndex = new Map<number, any>()
    for (const answer of answers) {
      const index = Number(answer?.index)
      if (Number.isInteger(index)) answerByIndex.set(index, answer)
    }

    const warnings: string[] = []
    for (const item of pending) {
      const raw = answerByIndex.get(item.index)
      if (!raw || raw.resolved === false) {
        warnings.push("No se pudo determinar con suficiente confianza la respuesta de la pregunta " + (item.index + 1) + ".")
        continue
      }

      const current = questions[item.index]
      const candidate = normalizeImportedQuestion({
        ...current,
        correctAnswer: raw.correctAnswer ?? raw.answer ?? raw.answerText ?? null,
        modelAnswer: raw.modelAnswer ?? raw.answerText ?? "",
        expectedLatex: raw.expectedLatex ?? current.expectedLatex ?? "",
        explanation: raw.explanation ?? current.explanation ?? "",
        solutionSteps: Array.isArray(raw.solutionSteps) ? raw.solutionSteps : current.solutionSteps,
        answerSource: "ai_inferred",
      })

      const hasAnswer = candidate.type === "development"
        ? Boolean(String(candidate.modelAnswer || candidate.expectedLatex || "").trim())
        : candidate.correctAnswer !== null && candidate.correctAnswer !== undefined

      if (!hasAnswer) {
        warnings.push("No se pudo determinar con suficiente confianza la respuesta de la pregunta " + (item.index + 1) + ".")
        continue
      }

      current.correctAnswer = candidate.correctAnswer
      current.modelAnswer = candidate.modelAnswer
      current.expectedLatex = candidate.expectedLatex
      current.explanation = candidate.explanation
      current.solutionSteps = candidate.solutionSteps
      current.answerSource = "ai_inferred"
    }

    return warnings
  } catch {
    return ["La segunda verificación de respuestas con IA no pudo completarse; las respuestas dudosas permanecen sin asignar."]
  }
}`

  source = replaceRequired(
    source,
    "export async function POST(request: NextRequest) {",
    `${helper}\n\nexport async function POST(request: NextRequest) {`,
    "helper de segunda verificación",
  )

  source = replaceRequired(
    source,
    `      if (!hasAnswer) question.answerSource = "missing"
    }

    const stats = summarizeImportedQuestions(questions)`,
    `      if (!hasAnswer) question.answerSource = "missing"
    }

    if (inferAnswers && questions.some((question) => question.answerSource === "missing")) {
      const retryWarnings = await resolveMissingImportedAnswers(model, questions)
      parsed.warnings.push(...retryWarnings)
    }

    const stats = summarizeImportedQuestions(questions)`,
    "ejecución de segunda verificación",
  )

  source = source.replace(
    `...(Array.isArray(output?.warnings) ? output.warnings.map(String) : []),`,
    `...(Array.isArray(output?.warnings) ? output.warnings.map((warning: unknown) => localizeImportWarning(String(warning))) : []),`,
  )
  source = source.replace(
    `...questions.flatMap((q) => q.importWarnings || []),`,
    `...questions.flatMap((q) => q.importWarnings || []).map(localizeImportWarning),`,
  )

  writeFileSync(ROUTE, source)
}

function patchPrompt() {
  let source = load(ROUTE)
  if (source.includes(PROMPT_MARKER)) return

  source = replaceRequired(
    source,
    '- NUNCA uses la alternativa A/índice 0 como valor por defecto cuando no conozcas la respuesta.',
    `- NUNCA uses la alternativa A/índice 0 como valor por defecto cuando no conozcas la respuesta.
- Si existe una pauta/solucionario al final del archivo, vincula cada respuesta con su pregunta por numeración y contenido. NO conviertas la pauta en preguntas nuevas.`,
    "regla de pauta final",
  )

  source = replaceRequired(
    source,
    '- Después de este texto se adjuntan imágenes extraídas y cada una está precedida por [IMAGE_REF:n]. Si una imagen corresponde a una pregunta, devuelve imageRef:n.',
    `- Después de este texto se adjuntan imágenes extraídas y cada una está precedida por [IMAGE_REF:n]. Si una imagen corresponde a una pregunta, devuelve imageRef:n.
- ${PROMPT_MARKER}: si una imagen contiene SOLO una fórmula, expresión matemática, texto o una lista de alternativas, TRANSCRÍBELA a question/options con texto + LaTeX y NO uses imageRef/optionImageRefs para conservarla como imagen.
- Reserva imageRef/optionImageRefs para contenido visual cuyo significado se perdería al transcribirlo: gráficos, diagramas, figuras geométricas, fotografías, esquemas o tablas visuales imprescindibles.`,
    "regla de fórmulas rasterizadas",
  )

  source = replaceRequired(
    source,
    '- No devuelvas markdown alrededor del JSON.',
    `- No devuelvas markdown alrededor del JSON.
- En DOCX, prioriza la estructura del HTML SEMÁNTICO de Mammoth para conservar tablas, filas, columnas y el orden lógico. Si el texto plano reordena signos como −, ≈, superíndices o elementos de una tabla, usa el HTML y el contexto semántico como fuente principal.`,
    "regla de estructura DOCX",
  )

  writeFileSync(ROUTE, source)
}

function patchComponent() {
  let source = load(COMPONENT)
  if (source.includes(UI_MARKER)) return

  source = replaceRequired(
    source,
    `<strong>Importación bloqueada:</strong> hay {result.preview.missingAnswers} pregunta{result.preview.missingAnswers !== 1 ? "s" : ""} sin respuesta conocida. Activa “Resolver respuestas faltantes con IA” y vuelve a analizar, o agrega la pauta en el archivo.`,
    `<strong>Importación bloqueada:</strong> hay {result.preview.missingAnswers} pregunta{result.preview.missingAnswers !== 1 ? "s" : ""} sin respuesta conocida. {/* ${UI_MARKER} */}
              {inferAnswers
                ? " EduAI ya hizo una segunda verificación y no pudo determinar esas respuestas con suficiente confianza. No asignará una alternativa por defecto: revisa las preguntas marcadas o corrige/agrega la pauta."
                : " Activa “Resolver respuestas faltantes con IA” y vuelve a analizar, o agrega la pauta en el archivo."}`,
    "mensaje de respuestas aún faltantes",
  )

  writeFileSync(COMPONENT, source)
}

function patchPage() {
  let source = load(PAGE)
  if (source.includes(PAGE_MARKER)) return

  source = replaceRequired(
    source,
    `    if (mode === "replace") setQuestions(imported);
    else setQuestions((current) => [...current, ...imported]);`,
    `    // ${PAGE_MARKER}
    if (mode === "replace") {
      setQuestions(imported);
    } else {
      setQuestions((current) => {
        const onlyEmptyStarter =
          current.length === 1 &&
          !current[0]?.question?.trim() &&
          (current[0]?.type !== "multiple_choice" || current[0].options.every((option) => !option.trim()));
        return onlyEmptyStarter ? imported : [...current, ...imported];
      });
    }`,
    "append de preguntas importadas",
  )

  writeFileSync(PAGE, source)
}

patchRoute()
patchAnswerRetry()
patchPrompt()
patchComponent()
patchPage()
console.log("[exam-import-safety] respuestas, segunda verificación IA, pauta, fórmulas rasterizadas, DOCX y UI protegidos")
