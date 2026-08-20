import fs from "node:fs"
import path from "node:path"

const saveRoutePath = path.join(process.cwd(), "app", "api", "examen", "developments", "route.ts")
const reviewRoutePath = path.join(process.cwd(), "app", "api", "examen", "developments", "by-submission", "route.ts")

function patchFile(filePath, transform) {
  if (!fs.existsSync(filePath)) throw new Error(`[exam-development-security] ruta no encontrada: ${filePath}`)
  const source = fs.readFileSync(filePath, "utf8")
  const next = transform(source)
  if (next !== source) fs.writeFileSync(filePath, next)
}

function replaceRequired(source, marker, replacement, label) {
  if (!source.includes(marker)) throw new Error(`[exam-development-security] marker no encontrado: ${label}`)
  return source.replace(marker, replacement)
}

patchFile(saveRoutePath, (source) => {
  let next = source

  const gradingImport = 'import { getQuestionMaxPoints } from "@/lib/exam/grading";'
  if (!next.includes(gradingImport)) {
    next = replaceRequired(
      next,
      'import { createClient } from "@supabase/supabase-js";',
      `import { createClient } from "@supabase/supabase-js";\n${gradingImport}`,
      "grading import",
    )
  }

  if (!next.includes("Intento de examen no encontrado.")) {
    const marker = "    const supabase = getAdminClient();"
    const block = `${marker}
    const requestedSubmissionId = String(body.submissionId || "").trim();
    const { data: draft, error: draftError } = await supabase
      .from("exam_attempt_drafts")
      .select("id, status, submission_id")
      .eq("exam_id", examId)
      .eq("client_attempt_id", clientAttemptId)
      .maybeSingle();

    if (draftError) throw draftError;
    if (!draft) {
      return NextResponse.json({ error: "Intento de examen no encontrado." }, { status: 404 });
    }

    const draftSubmissionId = String(draft.submission_id || "").trim();
    const isActiveAttempt = draft.status === "in_progress";
    const isSubmittedRetry =
      draft.status === "submitted" &&
      Boolean(requestedSubmissionId) &&
      requestedSubmissionId === draftSubmissionId;

    if (!isActiveAttempt && !isSubmittedRetry) {
      return NextResponse.json({ error: "El intento ya no acepta cambios de desarrollo." }, { status: 403 });
    }

    if (requestedSubmissionId && requestedSubmissionId !== draftSubmissionId) {
      return NextResponse.json({ error: "La entrega no corresponde al intento indicado." }, { status: 403 });
    }`

    next = replaceRequired(next, marker, block, "save admin client")
    next = replaceRequired(
      next,
      "      submission_id: body.submissionId || null,",
      "      submission_id: requestedSubmissionId || null,",
      "normalized submission id",
    )
  }

  if (!next.includes("Pauta oficial de la pregunta no encontrada.")) {
    const oldQuestionId = '    const questionId = String(body.questionId || `question-${questionIndex + 1}`).trim();'
    const requestedQuestionId = '    const requestedQuestionId = String(body.questionId || "").trim();'
    next = replaceRequired(next, oldQuestionId, requestedQuestionId, "requested question id")

    const marker = '    const basePath = `${safeSegment(examId, "exam")}/${safeSegment(clientAttemptId, "attempt")}/${questionIndex}`;'
    const officialBlock = `    const { data: officialExam, error: officialExamError } = await supabase
      .from("teacher_exams")
      .select("questions")
      .eq("id", examId)
      .maybeSingle();
    if (officialExamError) throw officialExamError;

    const officialQuestions = Array.isArray(officialExam?.questions) ? officialExam.questions : [];
    const officialQuestion = officialQuestions[questionIndex] as any;
    if (!officialQuestion || typeof officialQuestion !== "object") {
      return NextResponse.json({ error: "Pauta oficial de la pregunta no encontrada." }, { status: 404 });
    }

    const officialQuestionId = String(officialQuestion.id || \`question-\${questionIndex + 1}\`).trim();
    if (requestedQuestionId && requestedQuestionId !== officialQuestionId) {
      return NextResponse.json({ error: "La pregunta no corresponde al examen indicado." }, { status: 403 });
    }

    const officialQuestionText = String(officialQuestion.question || officialQuestion.statement || "");
    const officialExpectedLatex = String(
      officialQuestion.modelAnswer || officialQuestion.expectedAnswer || officialQuestion.expectedLatex || "",
    );
    const officialExpectedSteps = Array.isArray(officialQuestion.expectedSteps)
      ? officialQuestion.expectedSteps
      : [];
    const officialRubric = Array.isArray(officialQuestion.rubric) ? officialQuestion.rubric : [];
    const officialMaxPoints = getQuestionMaxPoints(officialQuestion);

${marker}`
    next = replaceRequired(next, marker, officialBlock, "official question")

    next = replaceRequired(
      next,
      "      questionId,",
      "      questionId: officialQuestionId,",
      "artifact question id",
    )
    next = replaceRequired(
      next,
      "    const evaluation = await evaluateLatex(body, latex, pages);",
      `    const evaluation = await evaluateLatex(
      {
        ...body,
        questionId: officialQuestionId,
        questionText: officialQuestionText,
        expectedLatex: officialExpectedLatex,
        expectedSteps: officialExpectedSteps,
        rubric: officialRubric,
        maxPoints: officialMaxPoints,
      },
      latex,
      pages,
    );`,
      "server-authoritative evaluator",
    )
    next = replaceRequired(
      next,
      "      question_id: questionId,",
      "      question_id: officialQuestionId,",
      "stored question id",
    )
  }

  return next
})

patchFile(reviewRoutePath, (source) => {
  let next = source

  const authImport = 'import { createClient as createServerClient } from "@/lib/supabase/server"'
  if (!next.includes(authImport)) {
    next = replaceRequired(
      next,
      'import { createClient } from "@supabase/supabase-js"',
      `import { createClient } from "@supabase/supabase-js"\n${authImport}`,
      "review auth import",
    )
  }

  if (!next.includes("Acceso docente requerido")) {
    const marker = "    const supabase = getAdminClient()"
    const block = `${marker}
    const auth = await createServerClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Acceso docente requerido", developments: [] }, { status: 401 })
    }`
    next = replaceRequired(next, marker, block, "review session")
  }

  if (!next.includes("Entrega no encontrada para este docente")) {
    const marker = `    const { data: rows, error } = await supabase`
    const ownershipBlock = `    const { data: ownedExam, error: ownershipError } = await supabase
      .from("teacher_exams")
      .select("id")
      .eq("id", examId)
      .eq("teacher_id", user.id)
      .maybeSingle()

    if (ownershipError) throw ownershipError
    if (!ownedExam) {
      return NextResponse.json(
        { error: "Entrega no encontrada para este docente", developments: [] },
        { status: 404 },
      )
    }

${marker}`
    next = replaceRequired(next, marker, ownershipBlock, "review ownership")
  }

  return next
})

console.log("[exam-development-security] attempt capability + official rubric + teacher ownership hardened")
