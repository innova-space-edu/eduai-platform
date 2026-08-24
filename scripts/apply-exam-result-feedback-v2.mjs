import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/examen/p/[code]/page.tsx"
const LATEX_FIX = "components/exam/ExamLatexAnswerFix.tsx"
const MARKER = "EXAM_RESULT_FEEDBACK_V2"
const EVIDENCE_MARKER = "EXAM_RESULT_EVIDENCE_SCOPE_V2"

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
  if (source.includes(MARKER)) return

  source = replaceRequired(
    source,
    `    const fallbackSummary = calculateScoreSummary(reviewQs, graded);`,
    `    // ${MARKER}\n    const answeredReviewCount = reviewQs.reduce((count: number, question: any, index: number) => {\n      const answer = graded[index] || {};\n      if (question?.type === "development") {\n        return count + (String(answer?.devText || "").trim() || String(answer?.developmentLatex || "").trim() ? 1 : 0);\n      }\n      if (question?.type === "mixed_choice_development") {\n        const selected = Number(answer?.selectedAnswer);\n        const hasSelection = Number.isInteger(selected) && selected >= 0;\n        const hasDevelopment = Boolean(String(answer?.devText || "").trim() || String(answer?.developmentLatex || "").trim());\n        return count + (hasSelection || hasDevelopment ? 1 : 0);\n      }\n      const selected = Number(answer?.selectedAnswer);\n      return count + (Number.isInteger(selected) && selected >= 0 ? 1 : 0);\n    }, 0);\n    const fallbackSummary = calculateScoreSummary(reviewQs, graded);`,
    "contador de respuestas",
  )

  source = replaceRequired(
    source,
    `                <div className="flex justify-center gap-8 mt-4">`,
    `                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">`,
    "resumen de resultado",
  )

  source = replaceRequired(
    source,
    `                  <div>\n                    <p className="text-muted2 text-xs">Tiempo</p>`,
    `                  <div>\n                    <p className="text-muted2 text-xs">Respondidas</p>\n                    <p className="text-blue-600 font-bold text-xl">\n                      {answeredReviewCount}/{reviewQs.length}\n                    </p>\n                  </div>\n                  <div>\n                    <p className="text-muted2 text-xs">Tiempo</p>`,
    "métrica respondidas",
  )

  source = replaceRequired(
    source,
    `                const baseCorrect = g.isCorrect === true;\n                const tfSelPts =`,
    `                const baseCorrect = g.isCorrect === true;\n                const selectedIndex = Number(g.selectedAnswer);\n                const hasSelection = Number.isInteger(selectedIndex) && selectedIndex >= 0;\n                const tfSelPts =`,
    "detección de respuesta",
  )

  source = replaceRequired(
    source,
    `                    : baseCorrect\n                      ? "full"\n                      : "wrong";`,
    `                    : !hasSelection\n                      ? "unanswered"\n                      : baseCorrect\n                        ? "full"\n                        : "wrong";`,
    "estado sin responder",
  )

  source = replaceRequired(
    source,
    `                  wrong: "border-red-200 bg-red-50",\n                }[state];`,
    `                  wrong: "border-red-200 bg-red-50",\n                  unanswered: "border-slate-200 bg-slate-50",\n                }[state];`,
    "color sin responder",
  )

  source = replaceRequired(
    source,
    `                  wrong: "✗ Incorrecta",\n                }[state];`,
    `                  wrong: "✗ Incorrecta",\n                  unanswered: "○ Sin responder",\n                }[state];`,
    "etiqueta sin responder",
  )

  source = replaceRequired(
    source,
    `                  wrong: "bg-red-100 text-red-700",\n                }[state];`,
    `                  wrong: "bg-red-100 text-red-700",\n                  unanswered: "bg-slate-100 text-slate-700",\n                }[state];`,
    "badge sin responder",
  )

  source = replaceRequired(
    source,
    `                const studentAnswer = isDev\n                  ? g.devText || "—"\n                  : isTF\n                    ? item.options?.[g.selectedAnswer] || "—"\n                    : item.options?.[g.selectedAnswer] || "—";`,
    `                const studentAnswer = isDev\n                  ? g.devText || "No registraste una respuesta de desarrollo."\n                  : hasSelection\n                    ? item.options?.[g.selectedAnswer] || "Respuesta registrada"\n                    : "No respondiste esta pregunta.";`,
    "texto de respuesta del estudiante",
  )

  source = source.replace(
    `                            ? "Respuesta modelo registrada"\n                            : "Respuesta correcta registrada"}`,
    `                            ? "Respuesta modelo"\n                            : "Respuesta esperada"}`,
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
  if (source.includes(EVIDENCE_MARKER)) return

  source = replaceRequired(
    source,
    `function getArtifactFromStorage(examId: string, attemptId: string, index: number) {\n  if (typeof window === "undefined") return null\n  const exactKey = \`eduai-exam-notebook:\${examId}:\${attemptId}:\${index}\`\n  const exact = parseJsonSafe(window.localStorage.getItem(exactKey))\n  if (exact) return exact\n\n  const suffix = \`:\${index}\`\n  const candidates: any[] = []\n  for (let i = 0; i < window.localStorage.length; i++) {\n    const key = window.localStorage.key(i) || ""\n    if (!key.startsWith("eduai-exam-notebook:") || !key.endsWith(suffix)) continue\n    const parsed = parseJsonSafe(window.localStorage.getItem(key))\n    if (parsed) candidates.push(parsed)\n  }\n\n  candidates.sort((a, b) => Date.parse(String(b?.updatedAt || 0)) - Date.parse(String(a?.updatedAt || 0)))\n  return candidates[0] || null\n}`,
    `// ${EVIDENCE_MARKER}\nfunction artifactHasContent(artifact: any) {\n  if (!artifact || typeof artifact !== "object") return false\n  if (String(artifact?.latex || artifact?.ocrText || "").trim()) return true\n  if (typeof artifact?.previewPngDataUrl === "string" && artifact.previewPngDataUrl.trim()) return true\n  const pages = Array.isArray(artifact?.pages) ? artifact.pages : []\n  return pages.some((page: any) => Array.isArray(page?.strokes) && page.strokes.length > 0)\n}\n\nfunction getArtifactFromStorage(examId: string, attemptId: string, index: number) {\n  if (typeof window === "undefined") return null\n  const exactKey = \`eduai-exam-notebook:\${examId}:\${attemptId}:\${index}\`\n  const exact = parseJsonSafe(window.localStorage.getItem(exactKey))\n  return artifactHasContent(exact) ? exact : null\n}`,
    "scope exacto del artefacto",
  )

  source = replaceRequired(
    source,
    `  if (!latex && !readable && !pages.length && !previewPngDataUrl) return answer`,
    `  const hasStrokes = pages.some((page: any) => Array.isArray(page?.strokes) && page.strokes.length > 0)\n  if (!latex && !readable && !hasStrokes && !previewPngDataUrl) return answer`,
    "artefacto vacío",
  )

  source = replaceRequired(
    source,
    `function findArtifactForQuestion(index: number) {\n  const latest = getLatestArtifactsFromWindow()\n  if (latest[index]) return latest[index]\n\n  if (typeof window === "undefined") return null\n  const candidates: any[] = []\n  const suffix = \`:\${index}\`\n  for (let i = 0; i < window.localStorage.length; i++) {\n    const key = window.localStorage.key(i) || ""\n    if (!key.startsWith("eduai-exam-notebook:") || !key.endsWith(suffix)) continue\n    const parsed = parseJsonSafe(window.localStorage.getItem(key))\n    if (parsed) candidates.push(parsed)\n  }\n  candidates.sort((a, b) => Date.parse(String(b?.updatedAt || 0)) - Date.parse(String(a?.updatedAt || 0)))\n  return candidates[0] || null\n}`,
    `function findArtifactForQuestion(index: number) {\n  const latest = getLatestArtifactsFromWindow()\n  const artifact = latest[index]\n  return artifactHasContent(artifact) ? artifact : null\n}`,
    "artefacto de la entrega actual",
  )

  source = replaceRequired(
    source,
    `    const card = findSmallestQuestionCard(index + 1)\n    if (!card || card.querySelector(\`[data-eduai-dev-evidence="\${index}"]\`)) continue`,
    `    const card = findSmallestQuestionCard(index + 1)\n    if (!card || card.querySelector(\`[data-eduai-dev-evidence="\${index}"]\`)) continue\n    const cardText = (card.textContent || "").toLowerCase()\n    if (!cardText.includes("desarrollo")) continue`,
    "evidencia solo en desarrollo",
  )

  writeFileSync(LATEX_FIX, source)
}

patchResultPage()
patchDevelopmentEvidence()
console.log("[exam-result-feedback-v2] estados, retroalimentación y lienzos de resultados corregidos")
