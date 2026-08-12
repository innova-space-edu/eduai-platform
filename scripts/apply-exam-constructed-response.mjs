import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/examen/crear/page.tsx"
const API = "app/api/agents/examen-docente/route.ts"
const PUBLIC_PAGE = "app/examen/p/[code]/page.tsx"
const MARKER = "EXAM_CONSTRUCTED_RESPONSE_V1"
const API_MARKER = "EXAM_CONSTRUCTED_RESPONSE_API_V1"

function block(lines) {
  return lines.join("\n")
}

function load(path) {
  if (!existsSync(path)) throw new Error(`[exam-constructed] No existe ${path}`)
  return readFileSync(path, "utf8")
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`[exam-constructed] No se encontró: ${label}`)
  }
  return source.replace(from, to)
}

function replaceRegexRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`[exam-constructed] No se encontró patrón: ${label}`)
  }
  pattern.lastIndex = 0
  return source.replace(pattern, replacement)
}

function patchPage() {
  let source = load(PAGE)
  if (source.includes(MARKER)) return
  if (!source.includes("EXAM_OMNI_SUBJECT_PATCH_V1")) {
    throw new Error("[exam-constructed] Ejecuta primero apply-exam-omni-subject.mjs")
  }
  if (!source.includes("EXAM_QUESTION_PEDAGOGY_META_V1")) {
    throw new Error("[exam-constructed] Ejecuta primero apply-exam-question-pedagogy.mjs")
  }

  source = replaceRequired(
    source,
    block([
      "type Question = (",
      "  | MultipleChoiceQuestion",
      "  | TrueFalseQuestion",
      "  | DevelopmentQuestion",
      "  | MixedChoiceDevelopmentQuestion",
      ") & QuestionPedagogyMeta;",
    ]),
    block([
      `// ${MARKER}`,
      'type ResponseMode = "short_text" | "long_text" | "math" | "text_math" | "math_steps";',
      'type StimulusKind = "text" | "source" | "case" | "data" | "experiment";',
      "",
      "type ConstructedResponseMeta = {",
      "  responseMode?: ResponseMode;",
      "  acceptedAnswers?: string[];",
      "  stimulusKind?: StimulusKind;",
      "  stimulusTitle?: string;",
      "  stimulusText?: string;",
      "  showStimulusToStudent?: boolean;",
      "};",
      "",
      "type Question = (",
      "  | MultipleChoiceQuestion",
      "  | TrueFalseQuestion",
      "  | DevelopmentQuestion",
      "  | MixedChoiceDevelopmentQuestion",
      ") & QuestionPedagogyMeta & ConstructedResponseMeta;",
    ]),
    "metadatos de respuesta construida",
  )

  source = replaceRequired(
    source,
    "const AI_TOTAL_LIMIT = 36;\n// EXAM_OMNI_SUBJECT_PATCH_V1",
    block([
      "const AI_TOTAL_LIMIT = 36;",
      "",
      "const RESPONSE_MODE_OPTIONS: { value: ResponseMode; label: string; icon: string; desc: string }[] = [",
      '  { value: "short_text", label: "Respuesta corta", icon: "Aa", desc: "Una palabra, concepto, valor o frase breve" },',
      '  { value: "long_text", label: "Respuesta abierta", icon: "¶", desc: "Explicar, analizar, argumentar o concluir" },',
      '  { value: "math", label: "Matemática", icon: "fx", desc: "Expresión, fórmula, ecuación o resultado" },',
      '  { value: "text_math", label: "Texto + matemática", icon: "Aa+fx", desc: "Explicación escrita combinada con ecuaciones" },',
      '  { value: "math_steps", label: "Procedimiento", icon: "≡", desc: "Desarrollo paso a paso, cálculo o transformación" },',
      "];",
      "",
      "function normalizeConstructedResponseMode(value: unknown): ResponseMode {",
      '  const mode = String(value || "").trim();',
      '  if (["short_text", "long_text", "math", "text_math", "math_steps"].includes(mode)) return mode as ResponseMode;',
      '  return "long_text";',
      "}",
      "",
      "function isMathResponseMode(mode?: ResponseMode) {",
      '  return mode === "math" || mode === "text_math" || mode === "math_steps";',
      "}",
      "",
      "function getResponseModeLabel(mode?: ResponseMode) {",
      '  return RESPONSE_MODE_OPTIONS.find((item) => item.value === normalizeConstructedResponseMode(mode))?.label || "Respuesta abierta";',
      "}",
      "",
      "// EXAM_OMNI_SUBJECT_PATCH_V1",
    ]),
    "opciones de forma de respuesta",
  )

  source = replaceRequired(
    source,
    block([
      '      type: "mixed_choice_development",',
      '      question: "",',
      '      options: ["", "", "", ""],',
    ]),
    block([
      '      type: "mixed_choice_development",',
      '      question: "",',
      '      responseMode: "long_text",',
      "      acceptedAnswers: [],",
      '      stimulusKind: "text",',
      '      stimulusTitle: "",',
      '      stimulusText: "",',
      "      showStimulusToStudent: false,",
      '      options: ["", "", "", ""],',
    ]),
    "valores iniciales alternativa + respuesta",
  )

  source = replaceRequired(
    source,
    block([
      '    type: "development",',
      '    question: "",',
      '    modelAnswer: "",',
    ]),
    block([
      '    type: "development",',
      '    question: "",',
      '    responseMode: "long_text",',
      "    acceptedAnswers: [],",
      '    stimulusKind: "text",',
      '    stimulusTitle: "",',
      '    stimulusText: "",',
      "    showStimulusToStudent: false,",
      '    modelAnswer: "",',
    ]),
    "valores iniciales respuesta construida",
  )

  source = replaceRequired(
    source,
    block([
      '    evidence: String(raw.evidence ?? raw.evidencia ?? "").trim(),',
      "  };",
    ]),
    block([
      '    evidence: String(raw.evidence ?? raw.evidencia ?? "").trim(),',
      "    responseMode:",
      '      ["development", "desarrollo", "mixed_choice_development", "alternativa_desarrollo"].includes(String(raw.type || ""))',
      "        ? normalizeConstructedResponseMode(raw.responseMode ?? raw.response_mode ?? raw.answerMode)",
      "        : undefined,",
      "    acceptedAnswers: Array.isArray(raw.acceptedAnswers ?? raw.accepted_answers)",
      "      ? (raw.acceptedAnswers ?? raw.accepted_answers).map(String).map((item: string) => item.trim()).filter(Boolean)",
      "      : [],",
      '    stimulusKind: (["text", "source", "case", "data", "experiment"].includes(String(raw.stimulusKind ?? raw.stimulus_kind)) ? String(raw.stimulusKind ?? raw.stimulus_kind) : "text") as StimulusKind,',
      '    stimulusTitle: String(raw.stimulusTitle ?? raw.stimulus_title ?? "").trim(),',
      '    stimulusText: String(raw.stimulusText ?? raw.stimulus_text ?? raw.sourceText ?? "").trim(),',
      "    showStimulusToStudent: raw.showStimulusToStudent === true || raw.show_stimulus_to_student === true,",
      "  };",
    ]),
    "normalización de respuesta y estímulo IA",
  )

  source = replaceRequired(
    source,
    block([
      "function getQuestionPoints(q: Question): number {",
    ]),
    block([
      "function getConstructedResponsePayload(q: Question) {",
      "  return {",
      "    responseMode:",
      '      q.type === "development" || q.type === "mixed_choice_development"',
      "        ? normalizeConstructedResponseMode(q.responseMode)",
      "        : undefined,",
      "    acceptedAnswers:",
      "      q.type === \"development\" || q.type === \"mixed_choice_development\"",
      "        ? (Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.map((item) => item.trim()).filter(Boolean) : [])",
      "        : undefined,",
      '    stimulusKind: q.stimulusKind || "text",',
      '    stimulusTitle: q.stimulusTitle || "",',
      '    stimulusText: q.stimulusText || "",',
      "    showStimulusToStudent: q.showStimulusToStudent === true && Boolean(q.stimulusText?.trim()),",
      "  };",
      "}",
      "",
      "function getQuestionPoints(q: Question): number {",
    ]),
    "serialización de respuesta construida",
  )

  source = source.replaceAll(
    "            ...getQuestionPedagogyPayload(q),\n            type: q.type,",
    "            ...getQuestionPedagogyPayload(q),\n            ...getConstructedResponsePayload(q),\n            type: q.type,",
  )
  source = source.replace(
    "          ...getQuestionPedagogyPayload(q),\n          type: q.type,",
    "          ...getQuestionPedagogyPayload(q),\n          ...getConstructedResponsePayload(q),\n          type: q.type,",
  )

  source = replaceRequired(
    source,
    block([
      "  const [questionAddType, setQuestionAddType] =",
      '    useState<QuestionType>("multiple_choice");',
    ]),
    block([
      "  const [questionAddType, setQuestionAddType] =",
      '    useState<QuestionType>("multiple_choice");',
      "  const [questionAddResponseMode, setQuestionAddResponseMode] =",
      '    useState<ResponseMode>("long_text");',
    ]),
    "estado de respuesta manual",
  )

  source = replaceRequired(
    source,
    '  const [aiMixed, setAiMixed] = useState(0);',
    block([
      '  const [aiMixed, setAiMixed] = useState(0);',
      "  const [aiResponseModes, setAiResponseModes] = useState<ResponseMode[]>([",
      '    "short_text",',
      '    "long_text",',
      '    "math",',
      '    "text_math",',
      "  ]);",
      "  const [aiShowSourceToStudent, setAiShowSourceToStudent] = useState(false);",
    ]),
    "estados IA de formas de respuesta",
  )

  source = replaceRequired(
    source,
    block([
      "  const toggleAIMode = (modeId: PedagogicalModeKey) => {",
      "    setAiModeIds((current) =>",
      "      current.includes(modeId)",
      "        ? current.filter((id) => id !== modeId)",
      "        : [...current, modeId],",
      "    );",
      "  };",
    ]),
    block([
      "  const toggleAIMode = (modeId: PedagogicalModeKey) => {",
      "    setAiModeIds((current) =>",
      "      current.includes(modeId)",
      "        ? current.filter((id) => id !== modeId)",
      "        : [...current, modeId],",
      "    );",
      "  };",
      "",
      "  const toggleAIResponseMode = (mode: ResponseMode) => {",
      "    setAiResponseModes((current) =>",
      "      current.includes(mode)",
      "        ? current.filter((item) => item !== mode)",
      "        : [...current, mode],",
      "    );",
      "  };",
    ]),
    "selector múltiple de formas de respuesta IA",
  )

  source = replaceRequired(
    source,
    block([
      "  const addQuestion = (type: QuestionType) => {",
      '    if (type === "development" || type === "mixed_choice_development") {',
      "      setDevelopmentNotebookEnabled(true);",
      '      setDevelopmentNotebookMode("development_only");',
      "    }",
      "    setQuestions((p) => [...p, defaultQuestion(type)]);",
      "  };",
    ]),
    block([
      "  const addQuestion = (type: QuestionType, responseMode: ResponseMode = questionAddResponseMode) => {",
      "    const baseQuestion = defaultQuestion(type);",
      "    const nextQuestion: Question =",
      '      type === "development" || type === "mixed_choice_development"',
      "        ? { ...baseQuestion, responseMode, acceptedAnswers: [] }",
      "        : baseQuestion;",
      "",
      '    if ((type === "development" || type === "mixed_choice_development") && isMathResponseMode(responseMode)) {',
      "      setDevelopmentNotebookEnabled(true);",
      '      setDevelopmentNotebookMode("development_only");',
      "    }",
      "    setQuestions((p) => [...p, nextQuestion]);",
      "  };",
    ]),
    "agregar pregunta con forma de respuesta",
  )

  source = replaceRequired(
    source,
    block([
      '      if (q.type === "development") {',
      "        if (!q.rubric.length)",
      '          return `La pregunta ${i + 1} de desarrollo debe tener rúbrica.`;',
      "        if (q.rubric.some((r) => !r.criteria.trim() || Number(r.points) <= 0))",
      '          return `La rúbrica de la pregunta ${i + 1} tiene elementos inválidos.`;',
      "      }",
    ]),
    block([
      '      if (q.type === "development") {',
      "        const responseMode = normalizeConstructedResponseMode(q.responseMode);",
      '        if (responseMode === "short_text") {',
      "          const hasAcceptedAnswer = Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.some((item) => item.trim());",
      "          if (!hasAcceptedAnswer && !(q.modelAnswer || \"\").trim())",
      '            return `La pregunta ${i + 1} de respuesta corta necesita una respuesta modelo o respuestas aceptadas.`;',
      "        } else {",
      "          if (!q.rubric.length)",
      '            return `La pregunta ${i + 1} de respuesta construida debe tener rúbrica.`;',
      "          if (q.rubric.some((r) => !r.criteria.trim() || Number(r.points) <= 0))",
      '            return `La rúbrica de la pregunta ${i + 1} tiene elementos inválidos.`;',
      "        }",
      "      }",
    ]),
    "validación por forma de respuesta",
  )

  source = replaceRequired(
    source,
    block([
      "      const normalized: Question[] = (data.questions ?? []).map((raw: any) =>",
      "        normalizeAIQuestion(raw),",
      "      );",
    ]),
    block([
      "      const normalized: Question[] = (data.questions ?? []).map((raw: any, index: number) => {",
      "        const normalizedQuestion = normalizeAIQuestion(raw);",
      '        if (normalizedQuestion.type === "development" || normalizedQuestion.type === "mixed_choice_development") {',
      "          normalizedQuestion.responseMode = raw?.responseMode || raw?.response_mode",
      "            ? normalizeConstructedResponseMode(raw.responseMode ?? raw.response_mode)",
      '            : (aiResponseModes[index % Math.max(1, aiResponseModes.length)] || "long_text");',
      "        }",
      "        if (aiShowSourceToStudent && aiSourceContext.trim()) {",
      '          normalizedQuestion.stimulusKind = normalizedQuestion.stimulusKind || "text";',
      '          normalizedQuestion.stimulusTitle = normalizedQuestion.stimulusTitle || "Texto, fuente o contexto base";',
      "          normalizedQuestion.stimulusText = normalizedQuestion.stimulusText || aiSourceContext.trim();",
      "          normalizedQuestion.showStimulusToStudent = true;",
      "        }",
      "        return normalizedQuestion;",
      "      });",
    ]),
    "normalización contextual de preguntas IA",
  )

  source = replaceRequired(
    source,
    block([
      "  const importAIQuestions = () => {",
      "    if (aiPreview.length === 0) return;",
      '    if (aiImportMode === "replace") setQuestions(aiPreview);',
      "    else setQuestions((prev) => [...prev, ...aiPreview]);",
      "    setAiPreview([]);",
      '    setAiStatus("idle");',
      "  };",
    ]),
    block([
      "  const importAIQuestions = () => {",
      "    if (aiPreview.length === 0) return;",
      "    if (aiPreview.some((q) => isMathResponseMode(q.responseMode))) {",
      "      setDevelopmentNotebookEnabled(true);",
      '      setDevelopmentNotebookMode("development_only");',
      "    }",
      '    if (aiImportMode === "replace") setQuestions(aiPreview);',
      "    else setQuestions((prev) => [...prev, ...aiPreview]);",
      "    setAiPreview([]);",
      '    setAiStatus("idle");',
      "  };",
    ]),
    "activar cuaderno para respuestas matemáticas IA",
  )

  source = replaceRequired(
    source,
    '      "- " + aiDev + " development: respuesta breve, ensayo, caso, diseño, análisis o producción según el perfil disciplinar.",',
    block([
      '      "- " + aiDev + " development: respuesta construida con una forma de respuesta explícita.",',
      '      "- Formas permitidas para development y la parte abierta de mixed_choice_development: " + aiResponseModes.join(", ") + ". Distribúyelas de forma pertinente; short_text es palabra/frase breve, long_text es explicación, math es expresión/ecuación, text_math combina texto y matemática, math_steps exige procedimiento.",',
      '      aiShowSourceToStudent && aiSourceContext.trim() ? "- La fuente/contexto entregado DEBE aparecer visible al estudiante en stimulusText y showStimulusToStudent:true cuando sea necesaria para responder." : "",',
    ]),
    "contrato IA de formas de respuesta",
  )

  source = replaceRequired(
    source,
    '      "7. En desarrollo: crea modelAnswer y rúbrica específica para la evidencia; no uses siempre criterios matemáticos.",',
    block([
      '      "7. En respuesta construida: incluye responseMode, modelAnswer y pauta. Para short_text agrega acceptedAnswers con variantes válidas; para long_text usa rúbrica; para math/text_math/math_steps incluye expectedLatex cuando corresponda y rúbrica de procedimiento si aplica.",',
      '      "7b. Si una pregunta depende de una lectura, fuente, caso, datos o experimento visible, devuelve stimulusKind, stimulusTitle, stimulusText y showStimulusToStudent:true. El mismo estímulo puede acompañar alternativas, V/F o respuestas construidas.",',
    ]),
    "reglas IA de respuesta y estímulo",
  )

  source = replaceRequired(
    source,
    '        "Regenera EXACTAMENTE una pregunta de tipo " + q.type + ".",',
    block([
      '        "Regenera EXACTAMENTE una pregunta de tipo " + q.type + ".",',
      '        (q.type === "development" || q.type === "mixed_choice_development") ? "Mantén o mejora responseMode: " + normalizeConstructedResponseMode(q.responseMode) + "." : "",',
      '        q.showStimulusToStudent && q.stimulusText ? "Mantén un estímulo visible y autosuficiente para el estudiante." : "",',
    ]),
    "regeneración individual con forma de respuesta",
  )

  source = replaceRequired(
    source,
    block([
      "                    <div>",
      '                      <label className="mb-2 block text-xs font-semibold text-sub">',
      "                        TEXTO, FUENTE, DATOS O CONTEXTO BASE",
      "                      </label>",
      "                      <textarea",
      "                        value={aiSourceContext}",
      "                        onChange={(e) => setAiSourceContext(e.target.value)}",
      '                        placeholder="Pega aquí un texto, caso, tabla, datos, descripción de imagen, experimento, obra o situación que la IA deba usar."',
      '                        className="min-h-[96px] w-full rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm text-main outline-none focus:border-violet-500/40"',
      "                      />",
      "                    </div>",
      "                  </div>",
      "",
      '                  <div className="grid gap-2 md:grid-cols-2">',
    ]),
    block([
      "                    <div>",
      '                      <label className="mb-2 block text-xs font-semibold text-sub">',
      "                        TEXTO, FUENTE, DATOS O CONTEXTO BASE",
      "                      </label>",
      "                      <textarea",
      "                        value={aiSourceContext}",
      "                        onChange={(e) => setAiSourceContext(e.target.value)}",
      '                        placeholder="Pega aquí un texto, caso, tabla, datos, descripción de imagen, experimento, obra o situación que la IA deba usar."',
      '                        className="min-h-[96px] w-full rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm text-main outline-none focus:border-violet-500/40"',
      "                      />",
      '                      <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-900">',
      "                        <input",
      '                          type="checkbox"',
      "                          checked={aiShowSourceToStudent}",
      "                          onChange={(e) => setAiShowSourceToStudent(e.target.checked)}",
      '                          className="mt-0.5"',
      "                        />",
      "                        <span><strong>Mostrar al estudiante:</strong> el texto, fuente, datos o caso aparecerá antes de las preguntas que lo utilicen.</span>",
      "                      </label>",
      "                    </div>",
      "                  </div>",
      "",
      '                  <div className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-4">',
      '                    <div className="mb-3">',
      '                      <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-800">FORMATOS DE RESPUESTA CONSTRUIDA</p>',
      '                      <p className="mt-1 text-[11px] leading-relaxed text-indigo-700">Selecciona las formas que la IA puede usar en preguntas abiertas. Puedes combinar texto, matemática y procedimientos en la misma evaluación.</p>',
      "                    </div>",
      '                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">',
      "                      {RESPONSE_MODE_OPTIONS.map((mode) => {",
      "                        const selected = aiResponseModes.includes(mode.value);",
      "                        return (",
      "                          <button",
      "                            key={mode.value}",
      '                            type="button"',
      "                            onClick={() => toggleAIResponseMode(mode.value)}",
      '                            className={["rounded-2xl border px-3 py-2 text-left transition-all", selected ? "border-indigo-500 bg-white text-indigo-950 ring-2 ring-indigo-100" : "border-indigo-100 bg-white/60 text-slate-600 hover:border-indigo-300"].join(" ")}',
      "                          >",
      '                            <span className="block text-xs font-black">{selected ? "✓ " : ""}{mode.icon} {mode.label}</span>',
      '                            <span className="mt-1 block text-[10px] leading-relaxed opacity-80">{mode.desc}</span>',
      "                          </button>",
      "                        );",
      "                      })}",
      "                    </div>",
      "                  </div>",
      "",
      '                  <div className="grid gap-2 md:grid-cols-2">',
    ]),
    "controles IA de estímulo y forma de respuesta",
  )

  source = source.replace('label: "Desarrollo",', 'label: "Resp. construida",')

  source = replaceRequired(
    source,
    block([
      '                    <option value="multiple_choice">Alternativas</option>',
      '                    <option value="mixed_choice_development">',
      "                      Alternativa + desarrollo",
      "                    </option>",
      '                    <option value="true_false">Verdadero/Falso</option>',
      '                    <option value="development">Desarrollo</option>',
      "                  </select>",
      "                  <button",
    ]),
    block([
      '                    <option value="multiple_choice">Alternativas</option>',
      '                    <option value="mixed_choice_development">',
      "                      Alternativa + respuesta construida",
      "                    </option>",
      '                    <option value="true_false">Verdadero/Falso</option>',
      '                    <option value="development">Respuesta construida</option>',
      "                  </select>",
      '                  {(questionAddType === "development" || questionAddType === "mixed_choice_development") && (',
      "                    <select",
      "                      value={questionAddResponseMode}",
      "                      onChange={(e) => setQuestionAddResponseMode(e.target.value as ResponseMode)}",
      '                      className="rounded-2xl bg-card-soft-theme border border-soft px-4 py-2 text-sm text-main focus:outline-none focus:border-indigo-500/40"',
      "                    >",
      "                      {RESPONSE_MODE_OPTIONS.map((mode) => (",
      '                        <option key={mode.value} value={mode.value}>{mode.label}</option>',
      "                      ))}",
      "                    </select>",
      "                  )}",
      "                  <button",
    ]),
    "selector manual de respuesta construida",
  )

  source = replaceRequired(
    source,
    block([
      "                            {q.type === \"multiple_choice\"",
      '                              ? "Alternativas"',
      '                              : q.type === "mixed_choice_development"',
      '                                ? "Alternativa + desarrollo"',
      '                                : q.type === "true_false"',
      '                                  ? "Verdadero/Falso"',
      '                                  : "Desarrollo"}',
    ]),
    block([
      "                            {q.type === \"multiple_choice\"",
      '                              ? "Alternativas"',
      '                              : q.type === "mixed_choice_development"',
      '                                ? `Alternativa + ${getResponseModeLabel(q.responseMode)}`',
      '                                : q.type === "true_false"',
      '                                  ? "Verdadero/Falso"',
      '                                  : getResponseModeLabel(q.responseMode)}',
    ]),
    "etiqueta manual de forma de respuesta",
  )

  const questionControls = block([
    '                    {/* Material base / estímulo visible */}',
    '                    <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">',
    '                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">',
    '                        <div>',
    '                          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-800">Texto, fuente, datos o contexto para esta pregunta</p>',
    '                          <p className="mt-1 text-[11px] text-sky-700">Opcional. Sirve para lectura comprensiva, análisis de fuentes, casos, tablas, datos o experimentos.</p>',
    '                        </div>',
    '                        <label className="flex items-center gap-2 text-[11px] font-bold text-sky-900">',
    '                          <input',
    '                            type="checkbox"',
    '                            checked={q.showStimulusToStudent === true}',
    '                            onChange={(e) => updateQuestion(q.id, (prev) => ({ ...prev, showStimulusToStudent: e.target.checked }))}',
    '                          />',
    '                          Mostrar al estudiante',
    '                        </label>',
    '                      </div>',
    '                      <div className="grid gap-3 md:grid-cols-[180px_1fr]">',
    '                        <select',
    '                          value={q.stimulusKind || "text"}',
    '                          onChange={(e) => updateQuestion(q.id, (prev) => ({ ...prev, stimulusKind: e.target.value as StimulusKind }))}',
    '                          className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs text-slate-900"',
    '                        >',
    '                          <option value="text">Texto base</option>',
    '                          <option value="source">Fuente / documento</option>',
    '                          <option value="case">Caso / situación</option>',
    '                          <option value="data">Datos / tabla</option>',
    '                          <option value="experiment">Experimento</option>',
    '                        </select>',
    '                        <input',
    '                          value={q.stimulusTitle || ""}',
    '                          onChange={(e) => updateQuestion(q.id, (prev) => ({ ...prev, stimulusTitle: e.target.value }))}',
    '                          placeholder="Título opcional del texto o fuente"',
    '                          className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs text-slate-900"',
    '                        />',
    '                      </div>',
    '                      <textarea',
    '                        value={q.stimulusText || ""}',
    '                        onChange={(e) => updateQuestion(q.id, (prev) => ({ ...prev, stimulusText: e.target.value }))}',
    '                        placeholder="Pega o escribe aquí el texto, fuente, caso, datos, tabla descrita o situación que el estudiante deberá leer y analizar."',
    '                        className="mt-3 min-h-[120px] w-full rounded-xl border border-sky-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-sky-400"',
    '                      />',
    '                    </div>',
    '',
    '                    {(q.type === "development" || q.type === "mixed_choice_development") && (',
    '                      <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">',
    '                        <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-800">Forma de respuesta del estudiante</p>',
    '                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">',
    '                          {RESPONSE_MODE_OPTIONS.map((mode) => {',
    '                            const selected = normalizeConstructedResponseMode(q.responseMode) === mode.value;',
    '                            return (',
    '                              <button',
    '                                key={mode.value}',
    '                                type="button"',
    '                                onClick={() => updateQuestion(q.id, (prev) => ({ ...prev, responseMode: mode.value }))}',
    '                                className={["rounded-xl border px-3 py-2 text-left transition", selected ? "border-indigo-500 bg-white text-indigo-950 ring-2 ring-indigo-100" : "border-indigo-100 bg-white/60 text-slate-600"].join(" ")}',
    '                              >',
    '                                <span className="block text-[11px] font-black">{selected ? "✓ " : ""}{mode.icon} {mode.label}</span>',
    '                                <span className="mt-1 block text-[9px] leading-relaxed opacity-80">{mode.desc}</span>',
    '                              </button>',
    '                            );',
    '                          })}',
    '                        </div>',
    '                        {normalizeConstructedResponseMode(q.responseMode) === "short_text" && (',
    '                          <div className="mt-3">',
    '                            <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700">Respuestas aceptadas</label>',
    '                            <input',
    '                              value={(q.acceptedAnswers || []).join(" | ")}',
    '                              onChange={(e) => updateQuestion(q.id, (prev) => ({ ...prev, acceptedAnswers: e.target.value.split("|").map((item) => item.trim()).filter(Boolean) }))}',
    '                              placeholder="Ej.: mitocondria | la mitocondria | Mitocondria"',
    '                              className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs text-slate-900"',
    '                            />',
    '                            <p className="mt-1 text-[10px] text-indigo-700">Separa variantes válidas con |. La respuesta modelo también se usa como referencia.</p>',
    '                          </div>',
    '                        )}',
    '                      </div>',
    '                    )}',
    '',
  ])

  source = replaceRequired(
    source,
    "                    {/* Imagen opcional */}",
    `${questionControls}                    {/* Imagen opcional */}`,
    "controles de estímulo y respuesta por pregunta",
  )

  source = source.replace(
    "                <strong>Formatos calificables:</strong> alternativas, alternativa + desarrollo, verdadero/falso y desarrollo.",
    "                <strong>Formatos calificables:</strong> alternativas, verdadero/falso y respuestas construidas. Las respuestas construidas pueden ser cortas, abiertas, matemáticas, texto + matemática o procedimientos; cualquiera puede usar un texto, fuente, caso, datos o experimento como estímulo visible.",
  )

  writeFileSync(PAGE, source)
}

function patchApi() {
  let source = load(API)
  if (source.includes(API_MARKER)) return

  source = replaceRequired(
    source,
    "function sanitizeQuestion(question: any) {",
    block([
      `// ${API_MARKER}`,
      "function normalizeConstructedResponseMode(value: unknown) {",
      '  const mode = String(value || "").trim()',
      '  return ["short_text", "long_text", "math", "text_math", "math_steps"].includes(mode) ? mode : "long_text"',
      "}",
      "",
      "function sanitizeQuestion(question: any) {",
    ]),
    "helper de forma de respuesta en API",
  )

  source = replaceRequired(
    source,
    block([
      "  const sanitized: any = {",
      "    ...question,",
      "    type,",
      '    question: String(question?.question || "Pregunta generada por IA"),',
      '    explanation: String(question?.explanation || ""),',
      "  }",
    ]),
    block([
      "  const sanitized: any = {",
      "    ...question,",
      "    type,",
      '    question: String(question?.question || "Pregunta generada por IA"),',
      '    explanation: String(question?.explanation || ""),',
      "    responseMode:",
      '      type === "development" || type === "mixed_choice_development"',
      "        ? normalizeConstructedResponseMode(question?.responseMode ?? question?.response_mode)",
      "        : undefined,",
      "    acceptedAnswers: Array.isArray(question?.acceptedAnswers ?? question?.accepted_answers)",
      "      ? (question?.acceptedAnswers ?? question?.accepted_answers).map(String).map((item: string) => item.trim()).filter(Boolean)",
      "      : [],",
      '    stimulusKind: String(question?.stimulusKind || "text"),',
      '    stimulusTitle: String(question?.stimulusTitle || ""),',
      '    stimulusText: String(question?.stimulusText || ""),',
      "    showStimulusToStudent: question?.showStimulusToStudent === true && Boolean(String(question?.stimulusText || \"\").trim()),",
      "  }",
    ]),
    "sanitización de respuesta y estímulo",
  )

  source = source.replaceAll(
    block([
      "    imageUrl: q.imageUrl || \"\",",
      "    maxPoints: getQuestionMaxPoints(q),",
    ]),
    block([
      "    imageUrl: q.imageUrl || \"\",",
      "    maxPoints: getQuestionMaxPoints(q),",
      "    responseMode: q.responseMode,",
      '    stimulusKind: q.stimulusKind || "text",',
      '    stimulusTitle: q.stimulusTitle || "",',
      '    stimulusText: q.showStimulusToStudent === true ? q.stimulusText || "" : "",',
      "    showStimulusToStudent: q.showStimulusToStudent === true,",
    ]),
  )

  source = source.replace(
    '        modelAnswer: q.modelAnswer || q.expectedLatex || "",',
    '        modelAnswer: Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length ? q.acceptedAnswers.join(" | ") : q.modelAnswer || q.expectedLatex || "",',
  )
  source = source.replace(
    '        modelAnswer: q.modelAnswer || q.expectedLatex || "",',
    '        modelAnswer: Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length ? q.acceptedAnswers.join(" | ") : q.modelAnswer || q.expectedLatex || "",',
  )

  writeFileSync(API, source)
}

function patchPublicPage() {
  let source = load(PUBLIC_PAGE)
  if (source.includes("EXAM_CONSTRUCTED_PUBLIC_V1")) return

  source = replaceRequired(
    source,
    block([
      "function isNotebookQuestion(question: any) {",
      "  return (",
      '    question?.type === "development" ||',
      '    question?.type === "mixed_choice_development"',
      "  );",
      "}",
    ]),
    block([
      "// EXAM_CONSTRUCTED_PUBLIC_V1",
      "function isNotebookQuestion(question: any) {",
      "  const isConstructed =",
      '    question?.type === "development" ||',
      '    question?.type === "mixed_choice_development";',
      "  if (!isConstructed) return false;",
      "",
      "  // Compatibilidad: exámenes antiguos sin responseMode conservan el cuaderno.",
      "  if (!question?.responseMode) return true;",
      '  return ["math", "text_math", "math_steps"].includes(String(question.responseMode));',
      "}",
    ]),
    "selección de cuaderno según forma de respuesta",
  )

  writeFileSync(PUBLIC_PAGE, source)
}

patchPage()
patchApi()
patchPublicPage()
console.log("[exam-constructed] respuestas cortas, abiertas, matemáticas y estímulos visibles listos")
