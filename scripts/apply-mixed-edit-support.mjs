import { readFileSync, writeFileSync, existsSync } from "node:fs";

function patch(path, edits) {
  if (!existsSync(path)) return;
  let s = readFileSync(path, "utf8");
  for (const edit of edits) {
    const [from, to] = edit;
    if (s.includes(from)) s = s.split(from).join(to);
  }
  writeFileSync(path, s);
}

function regexPatch(path, edits) {
  if (!existsSync(path)) return;
  let s = readFileSync(path, "utf8");
  for (const edit of edits) {
    const [from, to] = edit;
    s = s.replace(from, to);
  }
  writeFileSync(path, s);
}

patch("app/examen/crear/page.tsx", [
  ['  const [aiDev, setAiDev] = useState(2);', '  const [aiDev, setAiDev] = useState(2);\n  const [aiMixed, setAiMixed] = useState(0);'],
  ['const totalQ = aiMC + aiTF + aiDev;', 'const totalQ = aiMC + aiTF + aiDev + aiMixed;'],
  ['const totalAIQuestions = aiMC + aiTF + aiDev;', 'const totalAIQuestions = aiMC + aiTF + aiDev + aiMixed;'],
  ['{aiMC + aiTF + aiDev}', '{aiMC + aiTF + aiDev + aiMixed}'],
  ['- ${aiDev} preguntas de DESARROLLO (tipo development, con rúbrica de criterios, maxPoints ~5)', '- ${aiDev} preguntas de DESARROLLO (tipo development, con rúbrica de criterios, maxPoints ~5)\n- ${aiMixed} preguntas de ALTERNATIVA + DESARROLLO (tipo mixed_choice_development, 4 opciones, alternativa automática y desarrollo con rúbrica)'],
  ['6. development: modelAnswer, expectedLatex si corresponde, explanation, solutionSteps, rubric:[{criteria,points}], maxPoints:suma', '6. development: modelAnswer, expectedLatex si corresponde, explanation, solutionSteps, rubric:[{criteria,points}], maxPoints:suma\n6b. mixed_choice_development: options[4], correctAnswer índice 0-3, answerText igual a options[correctAnswer], explanation, solutionSteps, distractorRationales[4], selectionPoints, developmentMaxPoints, modelAnswer, expectedLatex y rubric'],
  ['label: "Permitir revisión",', 'label: "Activar retroalimentación y revisión detallada",'],
  ['allowReview,\n            isPublic,', 'allowReview,\n            feedbackEnabled: allowReview,\n            isPublic,'],
  ['                    <div className="grid grid-cols-3 gap-3">', '                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">'],
  ['                          label: "Verdadero/Falso",', '                          label: "Alt. + desarrollo",\n                          tone: "bg-amber-50 border-amber-100",\n                          labelClass: "text-amber-700",\n                          val: aiMixed,\n                          set: setAiMixed,\n                        },\n                        {\n                          label: "Verdadero/Falso",'],
  ['            mc: aiMC,\n            tf: aiTF,\n            dev: aiDev,', '            mc: aiMC,\n            tf: aiTF,\n            dev: aiDev,\n            mixed: aiMixed,'],
  ['mixed: aiMixed,\n            mixed: aiMixed,', 'mixed: aiMixed,'],
  ['Si es development: modelAnswer, expectedLatex si corresponde, explanation, solutionSteps y rubric.', 'Si es development: modelAnswer, expectedLatex si corresponde, explanation, solutionSteps y rubric. Si es mixed_choice_development: 4 options, correctAnswer, answerText, explanation, selectionPoints, developmentMaxPoints, modelAnswer, expectedLatex, rubric y distractorRationales.'],
  ['  if (raw.type === "development" || raw.type === "desarrollo") {', '  if (raw.type === "mixed_choice_development" || raw.type === "alternativa_desarrollo") {\n    const options = Array.isArray(raw.options) ? raw.options.map((o: any) => String(typeof o === "string" ? o : o.text ?? o.opcion ?? o).replace(/^[A-Da-d][).]\\s*/u, "").trim()) : ["", "", "", ""];\n    const letters = ["a", "b", "c", "d", "e", "f"];\n    const rawCorrect = raw.correctAnswer ?? raw.respuestaCorrecta ?? 0;\n    const correct = typeof rawCorrect === "number" ? Math.round(rawCorrect) : letters.includes(String(rawCorrect).trim().toLowerCase()) ? letters.indexOf(String(rawCorrect).trim().toLowerCase()) : Number.isFinite(Number(rawCorrect)) ? Math.round(Number(rawCorrect)) : Math.max(0, options.findIndex((opt: string) => opt.trim().toLowerCase() === String(rawCorrect).trim().toLowerCase()));\n    const rubric = Array.isArray(raw.rubric) ? raw.rubric.map((r: any) => ({ criteria: r.criteria ?? r.criterion ?? r.criterio ?? "Procedimiento", points: Number(r.points ?? r.puntos ?? 1) })) : [{ criteria: "Procedimiento correcto", points: 1 }, { criteria: "Presentación clara", points: 1 }];\n    const selectionPoints = Number(raw.selectionPoints ?? raw.puntosSeleccion ?? 3);\n    const developmentMaxPoints = Number(raw.developmentMaxPoints ?? raw.puntosDesarrollo ?? Math.max(0, rubric.reduce((a: number, r: any) => a + Number(r.points || 0), 0) || 2));\n    return enrichQuestionAnswerKey({ ...base, type: "mixed_choice_development", options, correctAnswer: Math.max(0, Math.min(correct, options.length - 1)), answerText: raw.answerText ?? raw.correctAnswerText ?? "", explanation: raw.explanation ?? raw.explicacion ?? "", solutionSteps: raw.solutionSteps ?? raw.steps ?? [], distractorRationales: raw.distractorRationales ?? raw.distractor_reasons ?? [], selectionPoints, developmentMaxPoints, modelAnswer: raw.modelAnswer ?? raw.expectedAnswer ?? raw.respuestaModelo ?? "", expectedLatex: raw.expectedLatex ?? raw.expected_latex ?? "", rubric, showRubricToStudent: raw.showRubricToStudent === true, maxPoints: selectionPoints + developmentMaxPoints }) as MixedChoiceDevelopmentQuestion;\n  }\n\n  if (raw.type === "development" || raw.type === "desarrollo") {'],
  ['                                     q.type === "multiple_choice"\n                                      ? "Alt"\n                                      : q.type === "true_false"\n                                        ? "V/F"\n                                        : "Des"', '                                     q.type === "multiple_choice"\n                                      ? "Alt"\n                                      : q.type === "mixed_choice_development"\n                                        ? "Alt+Des"\n                                        : q.type === "true_false"\n                                          ? "V/F"\n                                          : "Des"'],
  ['                             {q.type === "multiple_choice" && (', '                             {(q.type === "multiple_choice" || q.type === "mixed_choice_development") && ('],
  ['                             {q.type === "development" && (', '                             {(q.type === "development" || q.type === "mixed_choice_development") && ('],
  ['                                   q.type === "multiple_choice"\n                                     ? q.options[q.correctAnswer] ||\n                                       q.answerText ||\n                                       ""\n                                     : q.type === "true_false"', '                                   q.type === "multiple_choice"\n                                     ? q.options[q.correctAnswer] ||\n                                       q.answerText ||\n                                       ""\n                                     : q.type === "mixed_choice_development"\n                                       ? `Alternativa: ${q.options[q.correctAnswer] || q.answerText || ""}\\nDesarrollo: ${q.modelAnswer || ""}`\n                                       : q.type === "true_false"'],
]);

patch("app/api/agents/exam-generate/route.ts", [
  ['import { buildAnswerKey, enrichQuestionAnswerKey, findBlockingQualityIssues } from "@/lib/exam/question-quality"', 'import { buildAnswerKey, enrichQuestionAnswerKey, findBlockingQualityIssues } from "@/lib/exam/question-quality"\nimport { autoFixQuestionMath } from "@/lib/exam/math-autofix"'],
  ['type: "multiple_choice" | "true_false" | "development"', 'type: "multiple_choice" | "true_false" | "development" | "mixed_choice_development"'],
  ['q.type === "true_false" || q.type === "development" ? q.type : "multiple_choice"', 'q.type === "true_false" || q.type === "development" || q.type === "mixed_choice_development" ? q.type : "multiple_choice"'],
  ['Types permitidos: multiple_choice, true_false, development.', 'Tipos permitidos: multiple_choice, true_false, development, mixed_choice_development.'],
  ['Tipos permitidos: multiple_choice, true_false, development.', 'Tipos permitidos: multiple_choice, true_false, development, mixed_choice_development.'],
  ['validateQuestionConsistency(repairQuestionStructure(sanitizeQuestionLatex(q)))', 'autoFixQuestionMath(validateQuestionConsistency(repairQuestionStructure(sanitizeQuestionLatex(q))))'],
  ['type BatchPlan = { total: number; mc: number; tf: number; dev: number }', 'type BatchPlan = { total: number; mc: number; tf: number; dev: number; mixed: number }'],
  ['function makeBatchPlans(totalQ: number, mc: number, tf: number, dev: number): BatchPlan[] {', 'function makeBatchPlans(totalQ: number, mc: number, tf: number, dev: number, mixed = 0): BatchPlan[] {'],
  ['const explicit = mc > 0 || tf > 0 || dev > 0', 'const explicit = mc > 0 || tf > 0 || dev > 0 || mixed > 0'],
  ['? { mc: Math.max(0, mc), tf: Math.max(0, tf), dev: Math.max(0, dev) }', '? { mc: Math.max(0, mc), tf: Math.max(0, tf), dev: Math.max(0, dev), mixed: Math.max(0, mixed) }'],
  [': { mc: Math.max(1, totalQ), tf: 0, dev: 0 }', ': { mc: Math.max(1, totalQ), tf: 0, dev: 0, mixed: 0 }'],
  ['total: initial.mc + initial.tf + initial.dev,', 'total: initial.mc + initial.tf + initial.dev + initial.mixed,'],
  ['let bDev = 0', 'let bDev = 0\n    let bMixed = 0'],
  ['bDev = Math.min(remaining.dev, Math.floor((take * remaining.dev) / remaining.total))', 'bDev = Math.min(remaining.dev, Math.floor((take * remaining.dev) / remaining.total))\n      bMixed = Math.min(remaining.mixed, Math.floor((take * remaining.mixed) / remaining.total))'],
  ['let left = take - bMc - bTf - bDev', 'let left = take - bMc - bTf - bDev - bMixed'],
  ['const order: ("mc" | "tf" | "dev")[] = ["mc", "tf", "dev"]', 'const order: ("mc" | "tf" | "dev" | "mixed")[] = ["mc", "mixed", "tf", "dev"]'],
  ['const current = key === "mc" ? bMc : key === "tf" ? bTf : bDev', 'const current = key === "mc" ? bMc : key === "tf" ? bTf : key === "dev" ? bDev : bMixed'],
  ['if (key === "dev") bDev++', 'if (key === "dev") bDev++\n              if (key === "mixed") bMixed++'],
  ['const total = bMc + bTf + bDev', 'const total = bMc + bTf + bDev + bMixed'],
  ['plans.push({ total, mc: bMc, tf: bTf, dev: bDev })', 'plans.push({ total, mc: bMc, tf: bTf, dev: bDev, mixed: bMixed })'],
  ['remaining.dev -= bDev\n    remaining.total -= total', 'remaining.dev -= bDev\n    remaining.mixed -= bMixed\n    remaining.total -= total'],
  ['- ${batch.tf} true_false\n- ${batch.dev} development', '- ${batch.tf} true_false\n- ${batch.dev} development\n- ${batch.mixed} mixed_choice_development'],
  ['totalQ: number,\n  mc: number,\n  tf: number,\n  dev: number,', 'totalQ: number,\n  mc: number,\n  tf: number,\n  dev: number,\n  mixed: number,'],
  ['makeBatchPlans(totalQ, mc, tf, dev)', 'makeBatchPlans(totalQ, mc, tf, dev, mixed)'],
  ['const { prompt, mode = "full", mc = 0, tf = 0, dev = 0, designTemplateId } = body', 'const { prompt, mode = "full", mc = 0, tf = 0, dev = 0, mixed = 0, designTemplateId } = body'],
  ['Number(mc) + Number(tf) + Number(dev) ||', 'Number(mc) + Number(tf) + Number(dev) + Number(mixed) ||'],
  ['groqFull(enhancedPrompt, totalQ, Number(mc), Number(tf), Number(dev), GROQ_KEY)', 'groqFull(enhancedPrompt, totalQ, Number(mc), Number(tf), Number(dev), Number(mixed), GROQ_KEY)'],
  ['openRouterFull(enhancedPrompt, totalQ, Number(mc), Number(tf), Number(dev), OR_KEY)', 'openRouterFull(enhancedPrompt, totalQ, Number(mc), Number(tf), Number(dev), Number(mixed), OR_KEY)'],
]);

patch("app/api/agents/examen-docente/route.ts", [
  ['const showResultToStudent = officialExam.settings?.showResultToStudent !== false\n      const reviewQuestions = showResultToStudent\n        ? sanitizedQuestions.map(buildStudentReviewQuestion)\n        : []', 'const showResultToStudent = officialExam.settings?.showResultToStudent !== false\n      const feedbackEnabled = showResultToStudent && officialExam.settings?.allowReview !== false && officialExam.settings?.feedbackEnabled !== false\n      const reviewQuestions = feedbackEnabled\n        ? sanitizedQuestions.map(buildStudentReviewQuestion)\n        : []'],
]);

patch("app/examen/p/[code]/page.tsx", [
  ['import ExamAudioButton from "@/components/exam/ExamAudioButton";\n', ''],
  ['const showRes = exam?.settings?.showResultToStudent !== false;\n  const allowCalculator', 'const showRes = exam?.settings?.showResultToStudent !== false;\n  const showFeedback = showRes && exam?.settings?.allowReview !== false && exam?.settings?.feedbackEnabled !== false;\n  const allowCalculator'],
  ['// Generate AI feedback for each question\n        generateFeedback(data.submission, exam);', '// Generate AI feedback only when the teacher enabled detailed review\n        if (showFeedback) generateFeedback(data.submission, exam);\n        else setFeedbackDone(true);'],
  ['{feedbackLoading && (', '{showFeedback && feedbackLoading && ('],
  ['{showRes && reviewQs.length > 0 && (', '{showFeedback && reviewQs.length > 0 && ('],
  ['{feedbackDone && (', '{(feedbackDone || (showRes && !showFeedback)) && ('],
  ['Retroalimentación completa', '{showFeedback ? "Retroalimentación completa" : "Nota entregada"}'],
  ['Has revisado todas tus preguntas. Puedes cerrar esta página.', '{showFeedback ? "Has revisado todas tus preguntas. Puedes cerrar esta página." : "La retroalimentación detallada fue desactivada por el docente."}'],
]);

regexPatch("app/examen/p/[code]/page.tsx", [
  [/\n\s*\{\/\* Botón narrar pregunta — PIE\/accesibilidad \*\/\}\s*\n\s*\{exam\?\.settings\?\.accessibility\?\.pieMode && \(\s*\n\s*<div className="flex w-full justify-end">\s*\n\s*<ExamAudioButton[\s\S]*?<\/div>\s*\n\s*\)\}/, ""],
]);

await import("./apply-pdf-export.mjs");
