import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/examen/crear/page.tsx"
const API = "app/api/agents/exam-generate/route.ts"
const PAGE_MARKER = "EXAM_OMNI_SUBJECT_PATCH_V1"
const API_MARKER = "EXAM_OMNI_SUBJECT_API_V1"

function block(lines) {
  return lines.join("\n")
}

function load(path) {
  if (!existsSync(path)) throw new Error(`[exam-omni] No existe ${path}`)
  return readFileSync(path, "utf8")
}

function replaceRequired(content, from, to, label) {
  if (!content.includes(from)) {
    throw new Error(`[exam-omni] No se encontró el bloque requerido: ${label}`)
  }
  return content.replace(from, to)
}

function replaceRegexRequired(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`[exam-omni] No se encontró el patrón requerido: ${label}`)
  }
  pattern.lastIndex = 0
  return content.replace(pattern, replacement)
}

function patchPage() {
  let source = load(PAGE)
  if (source.includes(PAGE_MARKER)) return

  if (!source.includes("const [aiMixed, setAiMixed]")) {
    throw new Error("[exam-omni] Ejecuta apply-mixed-edit-support.mjs antes de este parche")
  }

  source = replaceRequired(
    source,
    'import { getOAs, type NivelKey, type OA } from "@/lib/mineduc-oa";',
    block([
      'import { getAvailableAsignaturas, getOAs, type NivelKey, type OA } from "@/lib/mineduc-oa";',
      'import {',
      '  PEDAGOGICAL_MODES,',
      '  buildSubjectGenerationDirective,',
      '  getSubjectPedagogyProfile,',
      '  type PedagogicalModeKey,',
      '} from "@/lib/exam/subject-pedagogy";',
    ]),
    "imports curriculares",
  )

  source = replaceRequired(
    source,
    "const AI_TOTAL_LIMIT = 36;",
    block(["const AI_TOTAL_LIMIT = 36;", `// ${PAGE_MARKER}`]),
    "marcador del creador",
  )

  source = replaceRequired(
    source,
    '  const [selectedOAIds, setSelectedOAIds] = useState<string[]>([]);',
    block([
      '  const [selectedOAIds, setSelectedOAIds] = useState<string[]>([]);',
      "",
      "  const availableSubjects = useMemo(() => {",
      "    const subjects = getAvailableAsignaturas(curriculumNivel, curriculumCurso);",
      '    return subjects.length ? subjects : [subject || "Otra asignatura"];',
      "  }, [curriculumNivel, curriculumCurso, subject]);",
      "",
      "  const subjectProfile = useMemo(",
      "    () => getSubjectPedagogyProfile(subject),",
      "    [subject],",
      "  );",
      "",
      "  useEffect(() => {",
      "    if (!availableSubjects.length) return;",
      "    if (!availableSubjects.includes(subject)) {",
      "      setSubject(availableSubjects[0]);",
      "      setSelectedOAIds([]);",
      "    }",
      "  }, [availableSubjects, subject]);",
    ]),
    "catálogo dinámico de asignaturas",
  )

  source = replaceRequired(
    source,
    '  const [aiPrompt, setAiPrompt] = useState("");',
    block([
      '  const [aiPrompt, setAiPrompt] = useState("");',
      "  const [aiModeIds, setAiModeIds] = useState<PedagogicalModeKey[]>(",
      "    subjectProfile.preferredModes,",
      "  );",
      '  const [aiSkillFocus, setAiSkillFocus] = useState("");',
      '  const [aiSourceContext, setAiSourceContext] = useState("");',
      "  const [aiAuthenticContext, setAiAuthenticContext] = useState(true);",
      "  const [aiRequireOA, setAiRequireOA] = useState(true);",
    ]),
    "estados pedagógicos IA",
  )

  source = replaceRequired(
    source,
    "  const abortRef = useRef<AbortController | null>(null);",
    block([
      "  const abortRef = useRef<AbortController | null>(null);",
      "",
      "  useEffect(() => {",
      "    setAiModeIds(getSubjectPedagogyProfile(subject).preferredModes);",
      "  }, [subject]);",
      "",
      "  const toggleAIMode = (modeId: PedagogicalModeKey) => {",
      "    setAiModeIds((current) =>",
      "      current.includes(modeId)",
      "        ? current.filter((id) => id !== modeId)",
      "        : [...current, modeId],",
      "    );",
      "  };",
    ]),
    "control de modos pedagógicos",
  )

  source = replaceRegexRequired(
    source,
    /<select\s+value=\{subject\}[\s\S]*?<\/select>/,
    block([
      "<select",
      "                    value={subject}",
      "                    onChange={(e) => {",
      "                      setSubject(e.target.value);",
      "                      setSelectedOAIds([]);",
      "                    }}",
      '                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"',
      "                  >",
      "                    {availableSubjects.map((item) => (",
      "                      <option key={item} value={item}>",
      "                        {item}",
      "                      </option>",
      "                    ))}",
      "                  </select>",
    ]),
    "selector principal de asignatura",
  )

  source = source.replace(
    "md:grid-cols-[180px_180px_1fr]",
    "md:grid-cols-[170px_180px_240px_1fr]",
  )

  source = replaceRequired(
    source,
    block([
      "                    <div>",
      '                      <label className="mb-2 block text-xs font-bold text-slate-600">',
      "                        BUSCAR OA",
    ]),
    block([
      "                    <div>",
      '                      <label className="mb-2 block text-xs font-bold text-slate-600">',
      "                        ASIGNATURA",
      "                      </label>",
      "                      <select",
      "                        value={subject}",
      "                        onChange={(e) => {",
      "                          setSubject(e.target.value);",
      "                          setSelectedOAIds([]);",
      "                        }}",
      '                        className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"',
      "                      >",
      "                        {availableSubjects.map((item) => (",
      "                          <option key={item} value={item}>",
      "                            {item}",
      "                          </option>",
      "                        ))}",
      "                      </select>",
      "                    </div>",
      "                    <div>",
      '                      <label className="mb-2 block text-xs font-bold text-slate-600">',
      "                        BUSCAR OA",
    ]),
    "asignatura dentro del selector OA",
  )

  source = source.replace(
    "if (!query) return availableOAs.slice(0, 24);",
    "if (!query) return availableOAs;",
  )
  source = source.replace(
    block(["      )", "      .slice(0, 30);"]),
    "      );",
  )

  source = replaceRequired(
    source,
    block([
      "                texto: oa.texto,",
      "                unidadNombre: oa.unidadNombre,",
    ]),
    block([
      "                texto: oa.texto,",
      "                unidadNombre: oa.unidadNombre,",
      "                habilidades: oa.habilidades || [],",
      "                ejes: oa.ejes || [],",
    ]),
    "detalle de OA guardado",
  )

  source = replaceRequired(
    source,
    block(["            },", "            accessibility: {"]),
    block([
      "            },",
      "            pedagogicalContext: {",
      "              profileFamily: subjectProfile.family,",
      "              profileLabel: subjectProfile.label,",
      "              selectedModes: aiModeIds,",
      "              skillFocus: aiSkillFocus.trim(),",
      "              sourceContext: aiSourceContext.trim(),",
      "              authenticContext: aiAuthenticContext,",
      "              requireSelectedOA: aiRequireOA,",
      "            },",
      "            accessibility: {",
    ]),
    "contexto pedagógico guardado",
  )

  const promptReplacement = block([
    "  const buildAIPrompt = (): string => {",
    "    const totalQ = aiMC + aiTF + aiDev + aiMixed;",
    "    const diffMap = {",
    '      facil: "fácil",',
    '      medio: "media",',
    '      dificil: "difícil",',
    '      mixto: "mixta",',
    "    };",
    "    const accessibility = pieMode",
    "      ? [",
    '          dyslexiaMode ? "dislexia: lectura clara, frases directas y espacio suficiente" : "",',
    '          adhdMode ? "TDAH: consignas breves, una tarea por vez y bajo ruido cognitivo" : "",',
    '          lowVisionMode ? "baja visión: información explícita y apoyos describibles" : "",',
    "          individualAdaptations.trim(),",
    "        ]",
    "          .filter(Boolean)",
    '          .join("\\n")',
    "      : individualAdaptations.trim();",
    "",
    "    const directive = buildSubjectGenerationDirective({",
    "      subject,",
    "      nivel: curriculumNivel,",
    "      curso: curriculumCurso,",
    "      topic: topic.trim(),",
    "      teacherPrompt: aiPrompt.trim(),",
    "      selectedOAs: aiRequireOA ? selectedOAs : [],",
    "      modeIds: aiModeIds,",
    "      sourceContext: aiSourceContext.trim(),",
    "      skillFocus: aiSkillFocus.trim(),",
    "      authenticContext: aiAuthenticContext,",
    "      difficulty: diffMap[aiDiff],",
    "      accessibility,",
    "    });",
    "",
    "    return [",
    "      directive,",
    '      "",',
    '      "ESTRUCTURA EXACTA DE LA TANDA",',
    '      "Total: " + totalQ + " preguntas.",',
    '      "- " + aiMC + " multiple_choice: cuatro alternativas, una correcta y distractores basados en errores plausibles.",',
    '      "- " + aiMixed + " mixed_choice_development: alternativa automática más desarrollo o justificación con rúbrica.",',
    '      "- " + aiTF + " true_false: afirmación verificable, selección y justificación.",',
    '      "- " + aiDev + " development: respuesta breve, ensayo, caso, diseño, análisis o producción según el perfil disciplinar.",',
    '      "",',
    '      "REGLAS DE CALIDAD",',
    '      "1. Devuelve SOLO JSON válido: {\\\"title\\\":\\\"...\\\",\\\"questions\\\":[...]}.",',
    '      "2. Respeta exactamente las cantidades; no generes un tipo con cantidad 0.",',
    '      "3. La pregunta debe contener todo texto, dato, tabla descrita, fuente o situación indispensable para responder.",',
    '      "4. No inventes citas, autores, leyes, datos históricos ni resultados experimentales atribuidos a fuentes reales. Si creas una fuente didáctica, identifícala como simulada.",',
    '      "5. Genera pregunta, respuesta, explanation, solutionSteps y pauta en el mismo objeto.",',
    '      "6. En alternativas: resuelve primero, crea la opción correcta exacta, diseña distractores plausibles, mezcla y verifica answerText.",',
    '      "7. En desarrollo: crea modelAnswer y rúbrica específica para la evidencia; no uses siempre criterios matemáticos.",',
    '      "8. Usa LaTeX solo cuando la disciplina o el contenido lo requieran, entre $...$ o $$...$$.",',
    '      "9. Varía niveles cognitivos y modos pedagógicos sin repetir el mismo molde.",',
    '      "10. Cada pregunta debe ser adecuada a " + curriculumCurso + ", evaluable y coherente con los OA seleccionados.",',
    '      title ? "Título sugerido: \\\"" + title + "\\\"" : "",',
    "    ]",
    '      .filter(Boolean)',
    '      .join("\\n");',
    "  };",
    "",
    "  const generateAI = async () => {",
  ])

  source = replaceRegexRequired(
    source,
    /  const buildAIPrompt = \(\): string => \{[\s\S]*?\n  \};\n\n  const generateAI = async \(\) => \{/,
    promptReplacement,
    "constructor de prompt multiasignatura",
  )

  source = replaceRequired(
    source,
    block([
      "    if (!aiPrompt.trim() && !topic.trim()) {",
      "      setAiError(",
      '        "Escribe un tema en el campo de descripción o en la información general.",',
      "      );",
      "      return;",
      "    }",
    ]),
    block([
      "    if (!aiPrompt.trim() && !topic.trim() && selectedOAs.length === 0) {",
      "      setAiError(",
      '        "Escribe un tema, agrega una descripción o selecciona al menos un OA.",',
      "      );",
      "      return;",
      "    }",
      "    if (aiRequireOA && availableOAs.length > 0 && selectedOAs.length === 0) {",
      "      setAiError(",
      '        "Selecciona al menos un Objetivo de Aprendizaje. La IA usará ese OA para construir y verificar las preguntas.",',
      "      );",
      "      setOaOpen(true);",
      "      return;",
      "    }",
      "    if (aiModeIds.length === 0) {",
      '      setAiError("Selecciona al menos un modo pedagógico de evaluación.");',
      "      return;",
      "    }",
    ]),
    "validación de OA y modos",
  )

  source = replaceRegexRequired(
    source,
    /      const singlePrompt = `Regenera UNA pregunta[\s\S]*?Usa el mismo esquema de calidad que antes\.`;/,
    block([
      "      const singlePrompt = [",
      "        buildAIPrompt(),",
      '        "",',
      '        "REGENERACIÓN INDIVIDUAL",',
      '        "Regenera EXACTAMENTE una pregunta de tipo " + q.type + ".",',
      '        "No repitas el enunciado anterior: " + q.question,',
      '        "Devuelve SOLO JSON: {\\\"question\\\":{...}}.",',
      '        "Mantén el perfil de asignatura, curso, OA, modos pedagógicos, fuente docente y adaptaciones indicadas.",',
      '      ].join("\\n");',
    ]),
    "regeneración con contexto completo",
  )

  source = replaceRequired(
    source,
    block([
      "                    <textarea",
      "                      value={aiPrompt}",
      "                      onChange={(e) => setAiPrompt(e.target.value)}",
      '                      placeholder="Ej: Funciones cuadráticas para 2° medio, enfocado en discriminante y vértice. Incluye problemas contextualizados."',
    ]),
    block([
      "                    <textarea",
      "                      value={aiPrompt}",
      "                      onChange={(e) => setAiPrompt(e.target.value)}",
      "                      placeholder={subjectProfile.promptPlaceholder}",
    ]),
    "placeholder disciplinar",
  )

  const pedagogyPanel = block([
    '                  <div className="rounded-3xl border border-violet-200 bg-white/80 p-4">',
    '                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">',
    "                      <div>",
    '                        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">',
    "                          Perfil pedagógico activo",
    "                        </p>",
    '                        <h3 className="mt-1 text-sm font-black text-slate-950">',
    "                          {subjectProfile.label}",
    "                        </h3>",
    '                        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">',
    "                          {subjectProfile.purpose}",
    "                        </p>",
    "                      </div>",
    '                      <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">',
    "                        {curriculumCurso}",
    "                      </span>",
    "                    </div>",
    '                    <div className="mt-3 grid gap-2 md:grid-cols-3">',
    "                      {subjectProfile.evidence.map((item) => (",
    '                        <div key={item} className="rounded-2xl bg-violet-50 px-3 py-2 text-[11px] leading-relaxed text-violet-900">',
    "                          ✓ {item}",
    "                        </div>",
    "                      ))}",
    "                    </div>",
    "                  </div>",
    "",
    "                  <div>",
    '                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">',
    '                      <label className="text-xs font-semibold text-sub">',
    "                        MODOS PEDAGÓGICOS",
    "                      </label>",
    '                      <span className="text-[11px] text-muted2">',
    "                        La IA combinará estos modos dentro de los formatos calificables.",
    "                      </span>",
    "                    </div>",
    '                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">',
    "                      {PEDAGOGICAL_MODES.map((mode) => {",
    "                        const selected = aiModeIds.includes(mode.id);",
    "                        return (",
    "                          <button",
    "                            key={mode.id}",
    '                            type="button"',
    "                            onClick={() => toggleAIMode(mode.id)}",
    "                            title={mode.description}",
    '                            className={["rounded-2xl border px-3 py-2 text-left transition-all", selected ? "border-violet-500 bg-violet-100 text-violet-900 ring-2 ring-violet-100" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"].join(" ")}',
    "                          >",
    '                            <span className="block text-xs font-black">',
    "                              {selected ? \"✓ \" : \"\"}{mode.label}",
    "                            </span>",
    '                            <span className="mt-1 block line-clamp-2 text-[10px] leading-relaxed opacity-80">',
    "                              {mode.description}",
    "                            </span>",
    "                          </button>",
    "                        );",
    "                      })}",
    "                    </div>",
    "                  </div>",
    "",
    '                  <div className="grid gap-3 md:grid-cols-2">',
    "                    <div>",
    '                      <label className="mb-2 block text-xs font-semibold text-sub">',
    "                        HABILIDADES O ÉNFASIS",
    "                      </label>",
    "                      <textarea",
    "                        value={aiSkillFocus}",
    "                        onChange={(e) => setAiSkillFocus(e.target.value)}",
    '                        placeholder="Ej.: inferir, comparar, justificar con evidencia, diseñar un procedimiento, interpretar gráficos..."',
    '                        className="min-h-[96px] w-full rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm text-main outline-none focus:border-violet-500/40"',
    "                      />",
    "                    </div>",
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
    '                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">',
    "                      <input",
    '                        type="checkbox"',
    "                        checked={aiAuthenticContext}",
    "                        onChange={(e) => setAiAuthenticContext(e.target.checked)}",
    '                        className="mt-0.5"',
    "                      />",
    "                      <span><strong>Contextos auténticos:</strong> usar situaciones cercanas al curso cuando ayuden a evaluar el aprendizaje.</span>",
    "                    </label>",
    '                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">',
    "                      <input",
    '                        type="checkbox"',
    "                        checked={aiRequireOA}",
    "                        disabled={availableOAs.length === 0}",
    "                        onChange={(e) => setAiRequireOA(e.target.checked)}",
    '                        className="mt-0.5"',
    "                      />",
    "                      <span><strong>Usar OA obligatoriamente:</strong> cada pregunta debe vincularse con los OA seleccionados.{availableOAs.length === 0 ? \" No hay OA locales para esta combinación.\" : \"\"}</span>",
    "                    </label>",
    "                  </div>",
    "",
    "                  {/* Cantidad de preguntas por tipo */}",
  ])

  source = replaceRequired(
    source,
    "                  {/* Cantidad de preguntas por tipo */}",
    pedagogyPanel,
    "panel pedagógico IA",
  )

  source = source
    .replace("EXAMEN DOCENTE · CANVA + LATEX + PIE/NEE", "EXAMEN DOCENTE · MULTIASIGNATURA + OA + IA")
    .replace(
      block([
        "Diseña una evaluación clara y visual: datos, diseño accesible,",
        "            generación IA, preguntas con LaTeX y publicación segura.",
      ]),
      block([
        "Diseña evaluaciones para cualquier asignatura: currículo, OA, habilidades,",
        "            fuentes, modos pedagógicos, accesibilidad y generación IA verificable.",
      ]),
    )
    .replace("Cuaderno de desarrollo matemático", "Cuaderno de desarrollo y producción")
    .replace(
      block([
        "La pizarra convertirá los",
        "                        trazos a LaTeX y guardará el desarrollo oficial cuando",
        "                        el estudiante avance. La corrección automática revisará",
        "                        el LaTeX renderizado, no los trazos.",
      ]),
      block([
        "La pizarra guardará el desarrollo oficial cuando el estudiante avance.",
        "                        En Matemática y Ciencias puede convertir expresiones a LaTeX;",
        "                        en otras asignaturas permite esquemas, procesos, borradores y producciones.",
      ]),
    )
    .replace(
      block([
        "Para no saturar la pantalla, los OA quedan plegados. Abre el",
        "                    panel, busca por tema y selecciona solo los objetivos que",
        "                    evaluará el examen.",
      ]),
      block([
        "Selecciona nivel, curso y asignatura desde el catálogo curricular real de EduAI.",
        "                    Los OA elegidos se enviarán completos a la IA y dirigirán la evaluación.",
      ]),
    )
    .replace("OpenRouter → Groq fallback automático", "Motor pedagógico multiasignatura · OpenRouter/Groq")
    .replace("CANTIDAD DE PREGUNTAS", "ESTRUCTURA DE LA EVALUACIÓN")
    .replace("RESULTADO FINAL EN LATEX (OPCIONAL)", "RESULTADO FINAL EN LATEX (OPCIONAL, SOLO SI CORRESPONDE)")

  source = replaceRequired(
    source,
    block([
      '              <div className="space-y-5">',
      "                {questions.map((q, index) => (",
    ]),
    block([
      '              <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs leading-relaxed text-blue-900">',
      "                <strong>Formatos calificables:</strong> alternativas, alternativa + desarrollo, verdadero/falso y desarrollo.",
      "                El modo pedagógico puede ser comprensión, análisis de fuentes, datos, caso, investigación, argumentación, secuencia o creación.",
      "              </div>",
      "",
      '              <div className="space-y-5">',
      "                {questions.map((q, index) => (",
    ]),
    "explicación de formatos y modos",
  )

  source = replaceRequired(
    source,
    '                  { label: "Preguntas", value: questions.length },',
    block([
      '                  { label: "Asignatura", value: subject },',
      '                  { label: "Curso", value: curriculumCurso },',
      '                  { label: "Preguntas", value: questions.length },',
    ]),
    "resumen curricular",
  )

  writeFileSync(PAGE, source)
}

function patchApi() {
  let source = load(API)
  if (source.includes(API_MARKER)) return

  source = replaceRequired(
    source,
    "export const maxDuration = 120",
    block(["export const maxDuration = 120", `// ${API_MARKER}`]),
    "marcador de API",
  )

  const systemPrompt = block([
    "const SYSTEM = `Eres un especialista en evaluación escolar multiasignatura para el sistema educativo chileno.",
    "Devuelve SOLO JSON válido, sin markdown ni texto fuera del objeto.",
    'Formato: {"title":"...","questions":[...]}.',
    "Tipos permitidos: multiple_choice, mixed_choice_development, true_false y development.",
    "Respeta EXACTAMENTE las cantidades solicitadas y no generes tipos con cantidad 0.",
    "",
    "PRINCIPIOS OBLIGATORIOS",
    "- Lee primero asignatura, nivel, curso, OA, habilidades, modos pedagógicos, fuente docente y adaptaciones.",
    "- Cada pregunta debe evaluar evidencia observable y adecuada a la disciplina; no conviertas todas las asignaturas en ejercicios matemáticos.",
    "- Incluye dentro del enunciado todo texto, fuente, datos, descripción de imagen, caso o información indispensable.",
    "- No inventes citas, autores, leyes, datos científicos o hechos atribuidos a una fuente real. Los materiales creados deben declararse simulados.",
    "- Genera pregunta, respuesta, explicación, procedimiento o fundamento y pauta en el mismo objeto.",
    "- Verifica internamente exactitud conceptual, coherencia disciplinar, nivel de dificultad y correspondencia con los OA.",
    "",
    "multiple_choice: 4 opciones distintas y comparables; una correcta; correctAnswer es el índice final; answerText idéntico a options[correctAnswer]; distractorRationales explica cada opción.",
    "mixed_choice_development: 4 opciones, respuesta automática y una justificación/desarrollo con modelAnswer y rúbrica específica.",
    "true_false: afirmación verificable, answerText, explanation, selectionPoints y justificationMaxPoints.",
    "development: puede ser respuesta breve, ensayo, análisis, caso, diseño, indagación, producción o resolución; incluye modelAnswer, explanation, solutionSteps y rúbrica pertinente.",
    "",
    "DISCIPLINA",
    "- Matemática: resuelve y comprueba; distractores basados en errores reales; LaTeX entre $...$ o $$...$$.",
    "- Lenguaje/idiomas: entrega el texto o situación comunicativa; usa evidencia textual y criterios de producción.",
    "- Ciencias: usa modelos, datos, variables, evidencia y seguridad; no reduzcas todo a cálculo.",
    "- Historia/ciudadanía: diferencia hechos, fuentes y perspectivas; evita sesgo partidista.",
    "- Artes/música: admite diversidad de respuestas fundamentadas y evalúa proceso, intención y elementos formales.",
    "- Tecnología: usa necesidades, usuarios, restricciones, criterios, impacto y mejora.",
    "- Educación física/orientación/parvularia: usa casos seguros, inclusivos y apropiados a la edad; no solicites información íntima ni diagnósticos.",
    "",
    "Antes de responder revisa que no haya preguntas ambiguas, alternativas absurdas, respuestas no sustentadas ni rúbricas genéricas desconectadas de la tarea.",
    "`",
    "const PROVIDER_BATCH",
  ])

  source = replaceRegexRequired(
    source,
    /const SYSTEM = `[\s\S]*?`\nconst PROVIDER_BATCH/,
    systemPrompt,
    "sistema multiasignatura",
  )

  source = source.replace(/slice\(0, 1800\)/g, "slice(0, 6000)")
  source = source.replace(
    "Contexto del examen: ${context.slice(0, 1200)}",
    "Contexto del examen: ${context.slice(0, 5000)}",
  )

  writeFileSync(API, source)
}

patchPage()
patchApi()
console.log("[exam-omni] creador multiasignatura y API pedagógica listos")
