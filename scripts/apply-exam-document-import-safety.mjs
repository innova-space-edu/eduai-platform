import { existsSync, readFileSync, writeFileSync } from "node:fs"

const ROUTE = "app/api/agents/exam-import/route.ts"
const PAGE = "app/examen/crear/page.tsx"
const ROUTE_MARKER = "EXAM_IMPORT_MISSING_ANSWER_GUARD_V1"
const PAGE_MARKER = "EXAM_IMPORT_EMPTY_STARTER_GUARD_V1"
const PROMPT_MARKER = "EXAM_IMPORT_REAL_FIXTURE_PROMPT_V1"

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
patchPrompt()
patchPage()
console.log("[exam-import-safety] respuestas, pauta, fórmulas rasterizadas, DOCX y pregunta inicial protegidos")
