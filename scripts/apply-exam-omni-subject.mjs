import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/examen/crear/page.tsx"
const API = "app/api/agents/exam-generate/route.ts"
const PAGE_MARKER = "EXAM_OMNI_SUBJECT_PATCH_V1"
const API_MARKER = "EXAM_OMNI_SUBJECT_API_V1"

function load(path) {
  if (!existsSync(path)) throw new Error(`[exam-omni] No existe ${path}`)
  return readFileSync(path, "utf8")
}

function save(path, content) {
  writeFileSync(path, content)
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
    'import { getAvailableAsignaturas, getOAs, type NivelKey, type OA } from "@/lib/mineduc-oa";\nimport {\n  PEDAGOGICAL_MODES,\n  buildSubjectGenerationDirective,\n  getSubjectPedagogyProfile,\n  type PedagogicalModeKey,\n} from "@/lib/exam/subject-pedagogy";',
    "imports curriculares",
  )

  source = replaceRequired(
    source,
    "const AI_TOTAL_LIMIT = 36;",
    `const AI_TOTAL_LIMIT = 36;\nconst ${PAGE_MARKER} = true;`,
    "marcador del creador",
  )

  source = replaceRequired(
    source,
    '  const [selectedOAIds, setSelectedOAIds] = useState<string[]>([]);',
    `  const [selectedOAIds, setSelectedOAIds] = useState<string[]>([]);\n\n  const availableSubjects = useMemo(() => {\n    const subjects = getAvailableAsignaturas(curriculumNivel, curriculumCurso);\n    return subjects.length ? subjects : [subject || "Otra asignatura"];\n  }, [curriculumNivel, curriculumCurso, subject]);\n\n  const subjectProfile = useMemo(\n    () => getSubjectPedagogyProfile(subject),\n    [subject],\n  );\n\n  useEffect(() => {\n    if (!availableSubjects.length) return;\n    if (!availableSubjects.includes(subject)) {\n      setSubject(availableSubjects[0]);\n      setSelectedOAIds([]);\n    }\n  }, [availableSubjects, subject]);`,
    "catálogo dinámico de asignaturas",
  )

  source = replaceRequired(
    source,
    '  const [aiPrompt, setAiPrompt] = useState("");',
    `  const [aiPrompt, setAiPrompt] = useState("");\n  const [aiModeIds, setAiModeIds] = useState<PedagogicalModeKey[]>(\n    subjectProfile.preferredModes,\n  );\n  const [aiSkillFocus, setAiSkillFocus] = useState("");\n  const [aiSourceContext, setAiSourceContext] = useState("");\n  const [aiAuthenticContext, setAiAuthenticContext] = useState(true);\n  const [aiRequireOA, setAiRequireOA] = useState(true);`,
    "estados pedagógicos IA",
  )

  source = replaceRequired(
    source,
    "  const abortRef = useRef<AbortController | null>(null);",
    `  const abortRef = useRef<AbortController | null>(null);\n\n  useEffect(() => {\n    setAiModeIds(getSubjectPedagogyProfile(subject).preferredModes);\n  }, [subject]);\n\n  const toggleAIMode = (modeId: PedagogicalModeKey) => {\n    setAiModeIds((current) =>\n      current.includes(modeId)\n        ? current.filter((id) => id !== modeId)\n        : [...current, modeId],\n    );\n  };`,
    "control de modos pedagógicos",
  )

  source = replaceRegexRequired(
    source,
    /<select\s+value=\{subject\}[\s\S]*?<\/select>/,
    `<select\n                    value={subject}\n                    onChange={(e) => {\n                      setSubject(e.target.value);\n                      setSelectedOAIds([]);\n                    }}\n                    className="w-full rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main focus:outline-none focus:border-blue-500/40"\n                  >\n                    {availableSubjects.map((item) => (\n                      <option key={item} value={item}>\n                        {item}\n                      </option>\n                    ))}\n                  </select>`,
    "selector principal de asignatura",
  )

  source = source.replace(
    "md:grid-cols-[180px_180px_1fr]",
    "md:grid-cols-[170px_180px_240px_1fr]",
  )

  source = replaceRequired(
    source,
    `                    <div>\n                      <label className="mb-2 block text-xs font-bold text-slate-600">\n                        BUSCAR OA`,
    `                    <div>\n                      <label className="mb-2 block text-xs font-bold text-slate-600">\n                        ASIGNATURA\n                      </label>\n                      <select\n                        value={subject}\n                        onChange={(e) => {\n                          setSubject(e.target.value);\n                          setSelectedOAIds([]);\n                        }}\n                        className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"\n                      >\n                        {availableSubjects.map((item) => (\n                          <option key={item} value={item}>\n                            {item}\n                          </option>\n                        ))}\n                      </select>\n                    </div>\n                    <div>\n                      <label className="mb-2 block text-xs font-bold text-slate-600">\n                        BUSCAR OA`,
    "asignatura dentro del selector OA",
  )

  source = source.replace(
    "if (!query) return availableOAs.slice(0, 24);",
    "if (!query) return availableOAs;",
  )
  source = source.replace(
    `      )\n      .slice(0, 30);`,
    `      );`,
  )

  source = replaceRequired(
    source,
    `                texto: oa.texto,\n                unidadNombre: oa.unidadNombre,`,
    `                texto: oa.texto,\n                unidadNombre: oa.unidadNombre,\n                habilidades: oa.habilidades || [],\n                ejes: oa.ejes || [],`,
    "detalle de OA guardado",
  )

  source = replaceRequired(
    source,
    `            },\n            accessibility: {`,
    `            },\n            pedagogicalContext: {\n              profileFamily: subjectProfile.family,\n              profileLabel: subjectProfile.label,\n              selectedModes: aiModeIds,\n              skillFocus: aiSkillFocus.trim(),\n              sourceContext: aiSourceContext.trim(),\n              authenticContext: aiAuthenticContext,\n              requireSelectedOA: aiRequireOA,\n            },\n            accessibility: {`,
    "contexto pedagógico guardado",
  )

  source = replaceRegexRequired(
    source,
    /  const buildAIPrompt = \(\): string => \{[\s\S]*?\n  \};\n\n  const generateAI = async \(\) => \{/,
    `  const buildAIPrompt = (): string => {\n    const totalQ = aiMC + aiTF + aiDev + aiMixed;\n    const diffMap = {\n      facil: "fácil",\n      medio: "media",\n      dificil: "difícil",\n      mixto: "mixta",\n    };\n    const accessibility = pieMode\n      ? [\n          dyslexiaMode ? "dislexia: lectura clara, frases directas y espacio suficiente" : "",\n          adhdMode ? "TDAH: consignas breves, una tarea por vez y bajo ruido cognitivo" : "",\n          lowVisionMode ? "baja visión: información explícita y apoyos describibles" : "",\n          individualAdaptations.trim(),\n        ]\n          .filter(Boolean)\n          .join("\\n")\n      : individualAdaptations.trim();\n\n    const directive = buildSubjectGenerationDirective({\n      subject,\n      nivel: curriculumNivel,\n      curso: curriculumCurso,\n      topic: topic.trim(),\n      teacherPrompt: aiPrompt.trim(),\n      selectedOAs: aiRequireOA ? selectedOAs : [],\n      modeIds: aiModeIds,\n      sourceContext: aiSourceContext.trim(),\n      skillFocus: aiSkillFocus.trim(),\n      authenticContext: aiAuthenticContext,\n      difficulty: diffMap[aiDiff],\n      accessibility,\n    });\n\n    return \\`${"${directive}"}\n\nESTRUCTURA EXACTA DE LA TANDA\nTotal: ${"${totalQ}"} preguntas.\n- ${"${aiMC}"} multiple_choice: cuatro alternativas, una correcta y distractores basados en errores plausibles.\n- ${"${aiMixed}"} mixed_choice_development: alternativa automática más desarrollo o justificación con rúbrica.\n- ${"${aiTF}"} true_false: afirmación verificable, selección y justificación.\n- ${"${aiDev}"} development: respuesta extensa, breve, ensayo, caso, diseño, análisis o producción según el perfil disciplinar.\n\nREGLAS DE CALIDAD\n1. Devuelve SOLO JSON válido: {"title":"...","questions":[...]}.\n2. Respeta exactamente las cantidades; no generes un tipo con cantidad 0.\n3. La pregunta debe contener todo texto, dato, tabla descrita, fuente o situación indispensable para responder.\n4. No inventes citas, autores, leyes, datos históricos ni resultados experimentales atribuidos a fuentes reales. Si creas una fuente didáctica, identifícala como texto o datos simulados.\n5. Genera pregunta, respuesta, explanation, solutionSteps y pauta en el mismo objeto.\n6. En multiple_choice y mixed_choice_development: resuelve primero, crea la alternativa correcta exacta, diseña distractores plausibles, mezcla y verifica que answerText sea idéntico a options[correctAnswer].\n7. En development: crea modelAnswer y rúbrica específica para la evidencia solicitada; no uses siempre criterios matemáticos.\n8. Usa LaTeX solo cuando la disciplina o el contenido lo requieran, entre $...$ o $$...$$.\n9. Varía niveles cognitivos y modos pedagógicos sin repetir el mismo molde.\n10. Cada pregunta debe ser adecuada a ${"${curriculumCurso}"}, evaluable y coherente con los OA seleccionados.\n${"${title ? `Título sugerido: \\\"${title}\\\"` : \"\"}"}\\`;\n  };\n\n  const generateAI = async () => {`,
    "constructor de prompt multiasignatura",
  )

  source = replaceRequired(
    source,
    `    if (!aiPrompt.trim() && !topic.trim()) {\n      setAiError(\n        "Escribe un tema en el campo de descripción o en la información general.",\n      );\n      return;\n    }`,
    `    if (!aiPrompt.trim() && !topic.trim() && selectedOAs.length === 0) {\n      setAiError(\n        "Escribe un tema, agrega una descripción o selecciona al menos un OA.",\n      );\n      return;\n    }\n    if (aiRequireOA && availableOAs.length > 0 && selectedOAs.length === 0) {\n      setAiError(\n        "Selecciona al menos un Objetivo de Aprendizaje. La IA usará ese OA para construir y verificar las preguntas.",\n      );\n      setOaOpen(true);\n      return;\n    }\n    if (aiModeIds.length === 0) {\n      setAiError("Selecciona al menos un modo pedagógico de evaluación.");\n      return;\n    }`,
    "validación de OA y modos",
  )

  source = replaceRegexRequired(
    source,
    /      const singlePrompt = `Regenera UNA pregunta[\s\S]*?Usa el mismo esquema de calidad que antes\.`;/,
    `      const singlePrompt = \\`${"${buildAIPrompt()}"}\n\nREGENERACIÓN INDIVIDUAL\nRegenera EXACTAMENTE una pregunta de tipo ${"${q.type}"}.\nNo repitas el enunciado anterior: ${"${q.question}"}\nDevuelve SOLO JSON: {"question":{...}}.\nMantén el perfil de asignatura, curso, OA, modos pedagógicos, fuente docente y adaptaciones indicadas.\\`;`,
    "regeneración con contexto completo",
  )

  source = replaceRequired(
    source,
    `                    <textarea\n                      value={aiPrompt}\n                      onChange={(e) => setAiPrompt(e.target.value)}\n                      placeholder="Ej: Funciones cuadráticas para 2° medio, enfocado en discriminante y vértice. Incluye problemas contextualizados."`,
    `                    <textarea\n                      value={aiPrompt}\n                      onChange={(e) => setAiPrompt(e.target.value)}\n                      placeholder={subjectProfile.promptPlaceholder}`,
    "placeholder disciplinar",
  )

  source = replaceRequired(
    source,
    `                  {/* Cantidad de preguntas por tipo */}`,
    `                  <div className="rounded-3xl border border-violet-200 bg-white/80 p-4">\n                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">\n                      <div>\n                        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">\n                          Perfil pedagógico activo\n                        </p>\n                        <h3 className="mt-1 text-sm font-black text-slate-950">\n                          {subjectProfile.label}\n                        </h3>\n                        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">\n                          {subjectProfile.purpose}\n                        </p>\n                      </div>\n                      <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">\n                        {curriculumCurso}\n                      </span>\n                    </div>\n                    <div className="mt-3 grid gap-2 md:grid-cols-3">\n                      {subjectProfile.evidence.map((item) => (\n                        <div key={item} className="rounded-2xl bg-violet-50 px-3 py-2 text-[11px] leading-relaxed text-violet-900">\n                          ✓ {item}\n                        </div>\n                      ))}\n                    </div>\n                  </div>\n\n                  <div>\n                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">\n                      <label className="text-xs font-semibold text-sub">\n                        MODOS PEDAGÓGICOS\n                      </label>\n                      <span className="text-[11px] text-muted2">\n                        La IA combinará estos modos dentro de los formatos calificables.\n                      </span>\n                    </div>\n                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">\n                      {PEDAGOGICAL_MODES.map((mode) => {\n                        const selected = aiModeIds.includes(mode.id);\n                        return (\n                          <button\n                            key={mode.id}\n                            type="button"\n                            onClick={() => toggleAIMode(mode.id)}\n                            title={mode.description}\n                            className={\`rounded-2xl border px-3 py-2 text-left transition-all ${"${selected ? \\\"border-violet-500 bg-violet-100 text-violet-900 ring-2 ring-violet-100\\\" : \\\"border-slate-200 bg-white text-slate-600 hover:border-violet-300\\\"}"}\`}\n                          >\n                            <span className="block text-xs font-black">\n                              {selected ? "✓ " : ""}{mode.label}\n                            </span>\n                            <span className="mt-1 block line-clamp-2 text-[10px] leading-relaxed opacity-80">\n                              {mode.description}\n                            </span>\n                          </button>\n                        );\n                      })}\n                    </div>\n                  </div>\n\n                  <div className="grid gap-3 md:grid-cols-2">\n                    <div>\n                      <label className="mb-2 block text-xs font-semibold text-sub">\n                        HABILIDADES O ÉNFASIS\n                      </label>\n                      <textarea\n                        value={aiSkillFocus}\n                        onChange={(e) => setAiSkillFocus(e.target.value)}\n                        placeholder="Ej.: inferir, comparar, justificar con evidencia, diseñar un procedimiento, interpretar gráficos..."\n                        className="min-h-[96px] w-full rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm text-main outline-none focus:border-violet-500/40"\n                      />\n                    </div>\n                    <div>\n                      <label className="mb-2 block text-xs font-semibold text-sub">\n                        TEXTO, FUENTE, DATOS O CONTEXTO BASE\n                      </label>\n                      <textarea\n                        value={aiSourceContext}\n                        onChange={(e) => setAiSourceContext(e.target.value)}\n                        placeholder="Pega aquí un texto, caso, tabla, datos, descripción de imagen, experimento, obra o situación que la IA deba usar."\n                        className="min-h-[96px] w-full rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm text-main outline-none focus:border-violet-500/40"\n                      />\n                    </div>\n                  </div>\n\n                  <div className="grid gap-2 md:grid-cols-2">\n                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">\n                      <input\n                        type="checkbox"\n                        checked={aiAuthenticContext}\n                        onChange={(e) => setAiAuthenticContext(e.target.checked)}\n                        className="mt-0.5"\n                      />\n                      <span><strong>Contextos auténticos:</strong> usar situaciones cercanas al curso cuando ayuden a evaluar el aprendizaje.</span>\n                    </label>\n                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">\n                      <input\n                        type="checkbox"\n                        checked={aiRequireOA}\n                        disabled={availableOAs.length === 0}\n                        onChange={(e) => setAiRequireOA(e.target.checked)}\n                        className="mt-0.5"\n                      />\n                      <span><strong>Usar OA obligatoriamente:</strong> cada pregunta debe vincularse con los OA seleccionados.{availableOAs.length === 0 ? " No hay OA locales para esta combinación." : ""}</span>\n                    </label>\n                  </div>\n\n                  {/* Cantidad de preguntas por tipo */}`,
    "panel pedagógico IA",
  )

  source = source
    .replace("EXAMEN DOCENTE · CANVA + LATEX + PIE/NEE", "EXAMEN DOCENTE · MULTIASIGNATURA + OA + IA")
    .replace(
      "Diseña una evaluación clara y visual: datos, diseño accesible,\n            generación IA, preguntas con LaTeX y publicación segura.",
      "Diseña evaluaciones para cualquier asignatura: currículo, OA, habilidades,\n            fuentes, modos pedagógicos, accesibilidad y generación IA verificable.",
    )
    .replace("Cuaderno de desarrollo matemático", "Cuaderno de desarrollo y producción")
    .replace(
      "La pizarra convertirá los\n                        trazos a LaTeX y guardará el desarrollo oficial cuando\n                        el estudiante avance. La corrección automática revisará\n                        el LaTeX renderizado, no los trazos.",
      "La pizarra guardará el desarrollo oficial cuando el estudiante avance.\n                        En Matemática y Ciencias puede convertir expresiones a LaTeX;\n                        en otras asignaturas permite esquemas, procesos, borradores y producciones.",
    )
    .replace(
      "Para no saturar la pantalla, los OA quedan plegados. Abre el\n                    panel, busca por tema y selecciona solo los objetivos que\n                    evaluará el examen.",
      "Selecciona nivel, curso y asignatura desde el catálogo curricular real de EduAI.\n                    Los OA elegidos se enviarán completos a la IA y dirigirán la evaluación.",
    )
    .replace("OpenRouter → Groq fallback automático", "Motor pedagógico multiasignatura · OpenRouter/Groq")
    .replace("CANTIDAD DE PREGUNTAS", "ESTRUCTURA DE LA EVALUACIÓN")
    .replace("RESULTADO FINAL EN LATEX (OPCIONAL)", "RESULTADO FINAL EN LATEX (OPCIONAL, SOLO SI CORRESPONDE)")

  source = replaceRequired(
    source,
    `              <div className="space-y-5">\n                {questions.map((q, index) => (`,
    `              <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs leading-relaxed text-blue-900">\n                <strong>Formatos calificables:</strong> alternativas, alternativa + desarrollo, verdadero/falso y desarrollo.\n                El modo pedagógico puede ser comprensión, análisis de fuentes, datos, caso, investigación, argumentación, secuencia o creación.\n              </div>\n\n              <div className="space-y-5">\n                {questions.map((q, index) => (`,
    "explicación de formatos y modos",
  )

  source = replaceRequired(
    source,
    `                  { label: "Preguntas", value: questions.length },`,
    `                  { label: "Asignatura", value: subject },\n                  { label: "Curso", value: curriculumCurso },\n                  { label: "Preguntas", value: questions.length },`,
    "resumen curricular",
  )

  save(PAGE, source)
}

function patchApi() {
  let source = load(API)
  if (source.includes(API_MARKER)) return

  source = replaceRequired(
    source,
    'export const maxDuration = 120',
    `export const maxDuration = 120\nconst ${API_MARKER} = true`,
    "marcador de API",
  )

  source = replaceRegexRequired(
    source,
    /const SYSTEM = `[\s\S]*?`\nconst PROVIDER_BATCH/,
    `const SYSTEM = \\`Eres un especialista en evaluación escolar multiasignatura para el sistema educativo chileno.\nDevuelve SOLO JSON válido, sin markdown ni texto fuera del objeto.\nFormato: {"title":"...","questions":[...]}.\nTipos permitidos: multiple_choice, mixed_choice_development, true_false y development.\nRespeta EXACTAMENTE las cantidades solicitadas y no generes tipos con cantidad 0.\n\nPRINCIPIOS OBLIGATORIOS\n- Lee primero asignatura, nivel, curso, OA, habilidades, modos pedagógicos, fuente docente y adaptaciones.\n- Cada pregunta debe evaluar evidencia observable y adecuada a la disciplina; no conviertas todas las asignaturas en ejercicios matemáticos.\n- Incluye dentro del enunciado todo texto, fuente, datos, descripción de imagen, caso o información indispensable.\n- No inventes citas, autores, leyes, datos científicos o hechos atribuidos a una fuente real. Los materiales creados deben declararse simulados.\n- Genera pregunta, respuesta, explicación, procedimiento o fundamento y pauta en el mismo objeto.\n- Verifica internamente exactitud conceptual, coherencia disciplinar, nivel de dificultad y correspondencia con los OA.\n\nmultiple_choice: 4 opciones distintas y comparables; una correcta; correctAnswer es el índice final; answerText idéntico a options[correctAnswer]; distractorRationales explica cada opción.\nmixed_choice_development: 4 opciones, respuesta automática y una justificación/desarrollo con modelAnswer y rúbrica específica.\ntrue_false: afirmación verificable, answerText, explanation, selectionPoints y justificationMaxPoints.\ndevelopment: puede ser respuesta breve, ensayo, análisis, caso, diseño, indagación, producción o resolución; incluye modelAnswer, explanation, solutionSteps y rúbrica pertinente.\n\nDISCIPLINA\n- Matemática: resuelve y comprueba; distractores basados en errores reales; LaTeX entre $...$ o $$...$$.\n- Lenguaje/idiomas: entrega el texto o situación comunicativa; usa evidencia textual y criterios de producción.\n- Ciencias: usa modelos, datos, variables, evidencia y seguridad; no reduzcas todo a cálculo.\n- Historia/ciudadanía: diferencia hechos, fuentes y perspectivas; evita sesgo partidista.\n- Artes/música: admite diversidad de respuestas fundamentadas y evalúa proceso, intención y elementos formales.\n- Tecnología: usa necesidades, usuarios, restricciones, criterios, impacto y mejora.\n- Educación física/orientación/parvularia: usa casos seguros, inclusivos y apropiados a la edad; no solicites información íntima ni diagnósticos.\n\nAntes de responder revisa que no haya preguntas ambiguas, alternativas absurdas, respuestas no sustentadas ni rúbricas genéricas desconectadas de la tarea.\n\`\nconst PROVIDER_BATCH`,
    "sistema multiasignatura",
  )

  source = source.replace(/slice\(0, 1800\)/g, "slice(0, 6000)")
  source = source.replace(
    "Contexto del examen: ${context.slice(0, 1200)}",
    "Contexto del examen: ${context.slice(0, 5000)}",
  )

  save(API, source)
}

patchPage()
patchApi()
console.log("[exam-omni] creador multiasignatura y API pedagógica listos")
