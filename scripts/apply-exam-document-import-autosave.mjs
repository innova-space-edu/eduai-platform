import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/examen/crear/page.tsx"
const QUESTION_CARD = "components/exam/QuestionCard.tsx"
const EXAM_API = "app/api/agents/examen-docente/route.ts"
const MARKER = "EXAM_DOCUMENT_IMPORT_AUTOSAVE_V1"

function load(path) {
  if (!existsSync(path)) throw new Error(`[exam-document-import] No existe ${path}`)
  return readFileSync(path, "utf8")
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[exam-document-import] No se encontró ${label}`)
  return source.replace(from, to)
}

function patchCreatorPage() {
  let source = load(PAGE)
  if (source.includes(MARKER)) return

  source = replaceRequired(
    source,
    'import ExamMathText from "@/components/ui/ExamMathText";',
    `import ExamMathText from "@/components/ui/ExamMathText";\nimport ExamDocumentImporter, { type ExamDocumentImportResult } from "@/components/exam/ExamDocumentImporter";\n// ${MARKER}`,
    "import del importador",
  )

  source = source.replaceAll(
    "  imageUrl?: string;\n};",
    '  imageUrl?: string;\n  optionImageUrls?: string[];\n  answerSource?: "file" | "ai_inferred" | "missing";\n};',
  )

  source = replaceRequired(
    source,
    '    imageUrl: String(raw.imageUrl ?? raw.image_url ?? raw.image ?? "").trim(),',
    '    imageUrl: String(raw.imageUrl ?? raw.image_url ?? raw.image ?? "").trim(),\n    optionImageUrls: Array.isArray(raw.optionImageUrls) ? raw.optionImageUrls.map(String) : [],\n    answerSource: raw.answerSource === "file" || raw.answerSource === "ai_inferred" ? raw.answerSource : undefined,',
    "normalización de imágenes de alternativas",
  )

  source = source.replaceAll(
    '            imageUrl: q.imageUrl || "",\n            options: q.options,',
    '            imageUrl: q.imageUrl || "",\n            optionImageUrls: Array.isArray(q.optionImageUrls) ? q.optionImageUrls : [],\n            options: q.options,',
  )

  source = replaceRequired(
    source,
    "  const abortRef = useRef<AbortController | null>(null);",
    `  const abortRef = useRef<AbortController | null>(null);

  // ── Importación PDF/DOCX + autoguardado local ─────────────────────────────
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autosaveAt, setAutosaveAt] = useState<number | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftReadyRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDraftStorageKey = () => userId ? \`eduai:exam-creator:draft:v1:\${userId}\` : "";

  const buildDraftPayload = () => ({
    version: 1,
    savedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    data: {
      title,
      topic,
      instructions,
      difficulty,
      timeLimit,
      examPercentage,
      showResultToStudent,
      allowReview,
      isPublic,
      allowCalculator,
      developmentNotebookEnabled,
      developmentNotebookMode,
      securityMode,
      subject,
      examTheme,
      examFont,
      customColorsEnabled,
      examCustomColors,
      pieMode,
      dyslexiaMode,
      adhdMode,
      lowVisionMode,
      individualAdaptations,
      curriculumNivel,
      curriculumCurso,
      selectedOAIds,
      questions,
    },
  });

  const persistExamCreatorDraft = () => {
    const key = getDraftStorageKey();
    if (!key || typeof window === "undefined" || createdExam) return;
    try {
      const payload = buildDraftPayload();
      window.localStorage.setItem(key, JSON.stringify(payload));
      setAutosaveAt(payload.savedAt);
      setAutosaveState("saved");
    } catch {
      setAutosaveState("error");
    }
  };

  const clearExamCreatorDraft = () => {
    const key = getDraftStorageKey();
    if (key && typeof window !== "undefined") window.localStorage.removeItem(key);
    setDraftRestored(false);
    setAutosaveState("idle");
    setAutosaveAt(null);
  };

  useEffect(() => {
    if (!userId || draftReadyRef.current || typeof window === "undefined") return;
    const key = getDraftStorageKey();
    try {
      const raw = key ? window.localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed?.expiresAt || Number(parsed.expiresAt) < Date.now()) {
          window.localStorage.removeItem(key);
        } else if (parsed?.data && typeof parsed.data === "object") {
          const draft = parsed.data;
          if (typeof draft.title === "string") setTitle(draft.title);
          if (typeof draft.topic === "string") setTopic(draft.topic);
          if (typeof draft.instructions === "string") setInstructions(draft.instructions);
          if (["facil", "medio", "dificil", "mixto"].includes(draft.difficulty)) setDifficulty(draft.difficulty);
          if (Number.isFinite(Number(draft.timeLimit))) setTimeLimit(Number(draft.timeLimit));
          if (Number.isFinite(Number(draft.examPercentage))) setExamPercentage(Number(draft.examPercentage));
          if (typeof draft.showResultToStudent === "boolean") setShowResultToStudent(draft.showResultToStudent);
          if (typeof draft.allowReview === "boolean") setAllowReview(draft.allowReview);
          if (typeof draft.isPublic === "boolean") setIsPublic(draft.isPublic);
          if (typeof draft.allowCalculator === "boolean") setAllowCalculator(draft.allowCalculator);
          if (typeof draft.developmentNotebookEnabled === "boolean") setDevelopmentNotebookEnabled(draft.developmentNotebookEnabled);
          if (["development_only", "all_questions"].includes(draft.developmentNotebookMode)) setDevelopmentNotebookMode(draft.developmentNotebookMode);
          if (typeof draft.securityMode === "boolean") setSecurityMode(draft.securityMode);
          if (typeof draft.subject === "string") setSubject(draft.subject);
          if (typeof draft.examTheme === "string") setExamTheme(draft.examTheme as ExamTheme);
          if (typeof draft.examFont === "string") setExamFont(draft.examFont as ExamFont);
          if (typeof draft.customColorsEnabled === "boolean") setCustomColorsEnabled(draft.customColorsEnabled);
          if (draft.examCustomColors && typeof draft.examCustomColors === "object") setExamCustomColors(draft.examCustomColors);
          if (typeof draft.pieMode === "boolean") setPieMode(draft.pieMode);
          if (typeof draft.dyslexiaMode === "boolean") setDyslexiaMode(draft.dyslexiaMode);
          if (typeof draft.adhdMode === "boolean") setAdhdMode(draft.adhdMode);
          if (typeof draft.lowVisionMode === "boolean") setLowVisionMode(draft.lowVisionMode);
          if (typeof draft.individualAdaptations === "string") setIndividualAdaptations(draft.individualAdaptations);
          if (["parvularia", "basica", "media"].includes(draft.curriculumNivel)) setCurriculumNivel(draft.curriculumNivel);
          if (typeof draft.curriculumCurso === "string") setCurriculumCurso(draft.curriculumCurso);
          if (Array.isArray(draft.selectedOAIds)) setSelectedOAIds(draft.selectedOAIds.map(String));
          if (Array.isArray(draft.questions) && draft.questions.length > 0) setQuestions(draft.questions as Question[]);
          setDraftRestored(true);
          setAutosaveAt(Number(parsed.savedAt) || Date.now());
          setAutosaveState("saved");
        }
      }
    } catch {
      if (key) window.localStorage.removeItem(key);
      setAutosaveState("error");
    } finally {
      draftReadyRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId || !draftReadyRef.current || createdExam) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    setAutosaveState("saving");
    draftTimerRef.current = setTimeout(() => persistExamCreatorDraft(), 900);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userId, createdExam, title, topic, instructions, difficulty, timeLimit,
    examPercentage, showResultToStudent, allowReview, isPublic, allowCalculator,
    developmentNotebookEnabled, developmentNotebookMode, securityMode, subject,
    examTheme, examFont, customColorsEnabled, examCustomColors, pieMode,
    dyslexiaMode, adhdMode, lowVisionMode, individualAdaptations, curriculumNivel,
    curriculumCurso, selectedOAIds, questions,
  ]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const flush = () => {
      if (draftReadyRef.current && !createdExam) persistExamCreatorDraft();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userId, createdExam, title, topic, instructions, difficulty, timeLimit,
    examPercentage, showResultToStudent, allowReview, isPublic, allowCalculator,
    developmentNotebookEnabled, developmentNotebookMode, securityMode, subject,
    examTheme, examFont, customColorsEnabled, examCustomColors, pieMode,
    dyslexiaMode, adhdMode, lowVisionMode, individualAdaptations, curriculumNivel,
    curriculumCurso, selectedOAIds, questions,
  ]);

  const applyDocumentImport = (result: ExamDocumentImportResult, mode: "replace" | "append") => {
    const imported = (result.questions || []).map((raw: any) => {
      const normalized = normalizeAIQuestion(raw) as Question;
      return {
        ...normalized,
        optionImageUrls: Array.isArray(raw.optionImageUrls) ? raw.optionImageUrls.map(String) : [],
        answerSource: raw.answerSource,
      } as Question;
    });
    if (!imported.length) return;

    if (mode === "replace") setQuestions(imported);
    else setQuestions((current) => [...current, ...imported]);

    if (!title.trim() && result.exam?.title) setTitle(result.exam.title);
    if (!topic.trim() && result.exam?.topic) setTopic(result.exam.topic);
    if (!instructions.trim() && result.exam?.instructions) setInstructions(result.exam.instructions);

    if (imported.some((q) => q.type === "development" || q.type === "mixed_choice_development")) {
      setDevelopmentNotebookEnabled(true);
      setDevelopmentNotebookMode("development_only");
    }

    setErrorMsg("");
    setSuccessMsg(\`Evaluación importada: \${imported.length} pregunta\${imported.length !== 1 ? "s" : ""}. Puedes editarlas antes de publicar.\`);
  };`,
    "estado del importador/autoguardado",
  )

  source = replaceRequired(
    source,
    "      setCreatedExam({",
    "      clearExamCreatorDraft();\n      setCreatedExam({",
    "limpieza del borrador al crear",
  )

  const aiSection = `            <section
              id="exam-section-ia"
              className="scroll-mt-32 rounded-[30px] border border-violet-200 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-white p-5 md:p-6 shadow-sm"
            >`
  source = replaceRequired(
    source,
    aiSection,
    `${aiSection}
              <ExamDocumentImporter onApply={applyDocumentImport} />
              <div className="my-5 h-px bg-violet-200/70" />`,
    "sección IA/Archivo",
  )

  const saveButtonsAnchor = `              <div className="mt-6 space-y-3">
                <button
                  onClick={handleCreate}`
  source = replaceRequired(
    source,
    saveButtonsAnchor,
    `              <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">
                    {autosaveState === "saving"
                      ? "Guardando borrador..."
                      : autosaveState === "saved"
                        ? \`✓ Autoguardado\${autosaveAt ? \` · \${new Date(autosaveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}\` : ""}\`
                        : autosaveState === "error"
                          ? "⚠️ No se pudo autoguardar en este navegador"
                          : "Autoguardado activo"}
                  </span>
                  {draftRestored && (
                    <button
                      type="button"
                      onClick={clearExamCreatorDraft}
                      className="rounded-lg border border-sky-200 bg-white px-2 py-1 text-[10px] font-bold text-sky-700"
                    >
                      Descartar borrador
                    </button>
                  )}
                </div>
                {draftRestored && <p className="mt-1 text-[11px] text-sky-700">Borrador anterior recuperado automáticamente.</p>}
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleCreate}`,
    "estado de autoguardado en sidebar",
  )

  // Vista de imágenes dentro de alternativas importadas en el editor.
  source = source.replaceAll(
    `                            <input
                              value={option}`,
    `                            <div className="min-w-0">
                              <input
                              value={option}`,
  )
  source = source.replaceAll(
    `                              placeholder={\`Alternativa \${optIndex + 1}\`}
                            />
                            <label className="flex items-center gap-2 text-sm text-sub whitespace-nowrap">`,
    `                              placeholder={\`Alternativa \${optIndex + 1}\`}
                            />
                              {q.optionImageUrls?.[optIndex] && (
                                <div className="mt-2 overflow-hidden rounded-xl border border-soft bg-white">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={q.optionImageUrls[optIndex]} alt={\`Imagen alternativa \${optIndex + 1}\`} className="max-h-32 w-full object-contain" />
                                </div>
                              )}
                            </div>
                            <label className="flex items-center gap-2 text-sm text-sub whitespace-nowrap">`,
  )

  writeFileSync(PAGE, source)
}

function patchQuestionCard() {
  let source = load(QUESTION_CARD)
  if (source.includes("EXAM_OPTION_IMAGES_V1")) return

  source = replaceRequired(
    source,
    "  imageUrl?: string;",
    '  imageUrl?: string;\n  optionImageUrls?: string[]; // EXAM_OPTION_IMAGES_V1',
    "tipo de imágenes por alternativa",
  )

  source = replaceRequired(
    source,
    `                <span className="min-w-0 flex-1 pt-0.5">
                  <ExamMathText text={option} />
                </span>`,
    `                <span className="min-w-0 flex-1 pt-0.5">
                  <ExamMathText text={option} />
                  {q.optionImageUrls?.[i] && (
                    <span className="mt-2 block overflow-hidden rounded-xl border border-[var(--exam-border)] bg-[var(--exam-surface)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.optionImageUrls[i]} alt={\`Imagen de la alternativa \${String.fromCharCode(65 + i)}\`} className="max-h-52 w-full object-contain" />
                    </span>
                  )}
                </span>`,
    "render de imagen en alternativa",
  )

  writeFileSync(QUESTION_CARD, source)
}

function patchExamApi() {
  let source = load(EXAM_API)
  if (source.includes("EXAM_OPTION_IMAGES_API_V1")) return

  const needle = '    imageUrl: q.imageUrl || "",'
  if (!source.includes(needle)) throw new Error("[exam-document-import] No se encontró imageUrl en examen-docente")
  source = source.replaceAll(
    needle,
    `${needle}\n    optionImageUrls: Array.isArray(q.optionImageUrls) ? q.optionImageUrls.map(String) : [], // EXAM_OPTION_IMAGES_API_V1`,
  )
  writeFileSync(EXAM_API, source)
}

patchCreatorPage()
patchQuestionCard()
patchExamApi()
console.log("[exam-document-import] PDF/DOCX, imágenes por alternativa y autoguardado conectados")
