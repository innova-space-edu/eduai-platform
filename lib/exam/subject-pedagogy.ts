export type PedagogicalModeKey =
  | "comprension"
  | "aplicacion"
  | "analisis_fuentes"
  | "interpretacion_datos"
  | "estudio_caso"
  | "argumentacion"
  | "investigacion"
  | "clasificacion"
  | "secuenciacion"
  | "creacion"

export type SelectedOAContext = {
  id?: string
  codigoOficial?: string
  texto?: string
  unidadNombre?: string
  habilidades?: string[]
  ejes?: string[]
}

export type SubjectPedagogyProfile = {
  family: string
  label: string
  purpose: string
  evidence: string[]
  recommendations: string[]
  avoid: string[]
  preferredModes: PedagogicalModeKey[]
  promptPlaceholder: string
}

export const PEDAGOGICAL_MODES: Array<{
  id: PedagogicalModeKey
  label: string
  description: string
}> = [
  {
    id: "comprension",
    label: "Comprensión",
    description: "Reconocer, explicar, inferir y relacionar conceptos o ideas.",
  },
  {
    id: "aplicacion",
    label: "Aplicación y resolución",
    description: "Usar conocimientos en ejercicios, situaciones o problemas nuevos.",
  },
  {
    id: "analisis_fuentes",
    label: "Análisis de fuentes",
    description: "Interpretar textos, documentos, imágenes, mapas, obras o evidencias.",
  },
  {
    id: "interpretacion_datos",
    label: "Datos, tablas y gráficos",
    description: "Leer, comparar, calcular o concluir a partir de datos y representaciones.",
  },
  {
    id: "estudio_caso",
    label: "Estudio de caso",
    description: "Tomar decisiones fundamentadas ante una situación auténtica.",
  },
  {
    id: "argumentacion",
    label: "Argumentación",
    description: "Sostener una postura con razones, evidencia y contraargumentos.",
  },
  {
    id: "investigacion",
    label: "Indagación e investigación",
    description: "Formular preguntas, hipótesis, procedimientos, variables o conclusiones.",
  },
  {
    id: "clasificacion",
    label: "Clasificación y relaciones",
    description: "Agrupar, comparar, asociar, distinguir o establecer correspondencias.",
  },
  {
    id: "secuenciacion",
    label: "Secuencias y procesos",
    description: "Ordenar etapas, hechos, procedimientos, ciclos o transformaciones.",
  },
  {
    id: "creacion",
    label: "Creación y producción",
    description: "Diseñar, proponer, escribir, modelar, ejecutar o elaborar un producto.",
  },
]

const DEFAULT_PROFILE: SubjectPedagogyProfile = {
  family: "general",
  label: "Evaluación interdisciplinaria",
  purpose: "Evaluar comprensión, aplicación, análisis y producción de evidencia observable.",
  evidence: [
    "respuestas precisas y vinculadas con el contenido",
    "aplicación del conocimiento en situaciones auténticas",
    "explicaciones o decisiones justificadas",
  ],
  recommendations: [
    "combinar preguntas breves con tareas de análisis y aplicación",
    "usar contextos cercanos al curso y lenguaje adecuado a la edad",
    "pedir evidencias verificables, no opiniones vagas",
  ],
  avoid: [
    "preguntas ambiguas o con más de una respuesta correcta no declarada",
    "alternativas absurdas o desiguales en extensión",
    "exigir fórmulas o LaTeX cuando la asignatura no lo necesita",
  ],
  preferredModes: ["comprension", "aplicacion", "estudio_caso", "argumentacion"],
  promptPlaceholder:
    "Describe contenidos, habilidades, contexto del curso, fuentes disponibles y qué evidencia esperas observar.",
}

const SUBJECT_PROFILES: Array<{
  match: RegExp
  profile: SubjectPedagogyProfile
}> = [
  {
    match: /matem|cálculo|algebra|geometr|estad[ií]st|probabilidad/i,
    profile: {
      family: "matematica",
      label: "Matemática y razonamiento cuantitativo",
      purpose: "Evaluar comprensión conceptual, procedimientos, modelamiento, razonamiento y comunicación matemática.",
      evidence: [
        "procedimientos coherentes y resultados verificables",
        "interpretación de tablas, gráficos, expresiones y modelos",
        "justificación de estrategias y comprobación de resultados",
      ],
      recommendations: [
        "crear datos que produzcan soluciones consistentes",
        "combinar cálculo, interpretación y problemas contextualizados",
        "verificar internamente cada resultado antes de construir alternativas",
      ],
      avoid: [
        "usar correctAnswer por defecto sin resolver",
        "distractores numéricos aleatorios sin relación con errores comunes",
        "LaTeX fuera de $...$ o $$...$$",
      ],
      preferredModes: ["aplicacion", "interpretacion_datos", "comprension", "argumentacion"],
      promptPlaceholder:
        "Ej.: funciones cuadráticas, interpretación de parámetros y problemas contextualizados; incluir procedimientos y resultados verificables.",
    },
  },
  {
    match: /lengua|lenguaje|literatura|lectura|comunicaci[oó]n/i,
    profile: {
      family: "lenguaje",
      label: "Lengua, literatura y comunicación",
      purpose: "Evaluar comprensión lectora, interpretación, producción, vocabulario y argumentación con evidencia textual.",
      evidence: [
        "inferencias respaldadas por fragmentos o elementos del texto",
        "análisis de propósito, estructura, recursos y punto de vista",
        "producciones escritas coherentes con criterios explícitos",
      ],
      recommendations: [
        "incluir un texto, fragmento o situación comunicativa suficiente dentro del enunciado",
        "distinguir información explícita, inferencia, interpretación y evaluación crítica",
        "crear rúbricas de contenido, organización, evidencia y claridad",
      ],
      avoid: [
        "preguntar por un texto que no fue entregado",
        "convertir interpretación literaria en una única opinión arbitraria",
        "usar terminología matemática o LaTeX sin necesidad",
      ],
      preferredModes: ["analisis_fuentes", "comprension", "argumentacion", "creacion"],
      promptPlaceholder:
        "Ej.: comprensión de un texto argumentativo, inferencias, propósito comunicativo y producción de una respuesta respaldada por evidencia textual.",
    },
  },
  {
    match: /historia|geograf|ciudadan|sociocultural|sociedad/i,
    profile: {
      family: "ciencias_sociales",
      label: "Historia, geografía y ciudadanía",
      purpose: "Evaluar pensamiento temporal y espacial, análisis de fuentes, causalidad, ciudadanía y argumentación histórica o social.",
      evidence: [
        "uso crítico de fuentes y datos territoriales",
        "relaciones entre causas, consecuencias, continuidad y cambio",
        "posturas ciudadanas fundamentadas en principios y evidencia",
      ],
      recommendations: [
        "entregar fuentes breves, mapas descritos, testimonios, estadísticas o casos",
        "distinguir hechos, interpretaciones y perspectivas",
        "pedir comparaciones, explicaciones causales y decisiones fundamentadas",
      ],
      avoid: [
        "preguntas de memorización aislada como único nivel cognitivo",
        "presentar opiniones políticas como hechos indiscutibles",
        "fuentes inventadas atribuidas a personas reales sin advertencia",
      ],
      preferredModes: ["analisis_fuentes", "estudio_caso", "argumentacion", "secuenciacion"],
      promptPlaceholder:
        "Ej.: analizar dos fuentes sobre un proceso histórico, explicar causas y consecuencias y resolver un caso ciudadano con evidencia.",
    },
  },
  {
    match: /qu[ií]mica|f[ií]sica|biolog|ciencias naturales|ciencias para la ciudadan|entorno natural/i,
    profile: {
      family: "ciencias",
      label: "Ciencias naturales y experimentales",
      purpose: "Evaluar comprensión de fenómenos, uso de modelos, interpretación de evidencia, indagación y explicación científica.",
      evidence: [
        "explicaciones basadas en conceptos, modelos y evidencia",
        "interpretación de tablas, gráficos, observaciones y resultados experimentales",
        "diseños de investigación con variables y procedimientos coherentes",
      ],
      recommendations: [
        "incluir datos, observaciones o condiciones suficientes para responder",
        "diferenciar hipótesis, predicción, evidencia, conclusión y limitación",
        "verificar unidades, ecuaciones químicas, magnitudes y relaciones causales",
      ],
      avoid: [
        "experimentos peligrosos o instrucciones inseguras",
        "datos incompatibles con la conclusión esperada",
        "reducir toda pregunta científica a cálculo matemático",
      ],
      preferredModes: ["investigacion", "interpretacion_datos", "aplicacion", "estudio_caso"],
      promptPlaceholder:
        "Ej.: explicar un fenómeno, interpretar resultados experimentales, controlar variables y justificar conclusiones con evidencia.",
    },
  },
  {
    match: /ingl[eé]s|idioma|lengua extranjera/i,
    profile: {
      family: "idiomas",
      label: "Lengua extranjera",
      purpose: "Evaluar comprensión y uso del idioma en situaciones comunicativas auténticas y adecuadas al nivel.",
      evidence: [
        "comprensión de ideas generales y detalles",
        "uso funcional de vocabulario y estructuras",
        "producción escrita coherente con propósito y audiencia",
      ],
      recommendations: [
        "indicar el idioma esperado en instrucciones y respuestas",
        "usar diálogos, avisos, correos, descripciones o textos breves completos",
        "graduar vocabulario, extensión y complejidad según el curso",
      ],
      avoid: [
        "traducir literalmente como única habilidad",
        "mezclar idiomas sin propósito pedagógico",
        "usar vocabulario muy superior al nivel declarado",
      ],
      preferredModes: ["comprension", "analisis_fuentes", "aplicacion", "creacion"],
      promptPlaceholder:
        "Ej.: reading comprehension de un correo breve, vocabulario en contexto y producción de una respuesta en inglés adecuada al nivel.",
    },
  },
  {
    match: /tecnolog|computaci[oó]n|programaci[oó]n|diseño/i,
    profile: {
      family: "tecnologia",
      label: "Tecnología, diseño y resolución de problemas",
      purpose: "Evaluar identificación de necesidades, diseño, planificación, uso responsable de recursos y evaluación de soluciones.",
      evidence: [
        "criterios claros para comparar soluciones",
        "decisiones de diseño justificadas",
        "secuencias, prototipos o planes técnicamente coherentes",
      ],
      recommendations: [
        "usar desafíos con usuarios, restricciones, materiales y criterios",
        "pedir planificación, evaluación de impacto y mejora iterativa",
        "incorporar seguridad, sostenibilidad y ética cuando corresponda",
      ],
      avoid: [
        "suponer materiales o software no disponibles",
        "confundir creatividad con ausencia de criterios",
        "dar por correcta una única solución cuando existen varias válidas",
      ],
      preferredModes: ["estudio_caso", "creacion", "secuenciacion", "argumentacion"],
      promptPlaceholder:
        "Ej.: diseñar una solución tecnológica para una necesidad real, comparar alternativas y justificar materiales, etapas e impacto.",
    },
  },
  {
    match: /artes|m[uú]sica|lenguajes art[ií]sticos/i,
    profile: {
      family: "artes",
      label: "Artes y creación",
      purpose: "Evaluar apreciación, análisis, procesos creativos, decisiones expresivas y reflexión sobre producciones.",
      evidence: [
        "observación de elementos formales y expresivos",
        "decisiones creativas vinculadas con intención y contexto",
        "reflexión mediante criterios, referentes y proceso",
      ],
      recommendations: [
        "describir o incluir la obra, pieza, imagen o estímulo necesario",
        "usar rúbricas que valoren proceso, intención, técnica y reflexión",
        "aceptar diversidad de soluciones cuando estén fundamentadas",
      ],
      avoid: [
        "calificar gustos personales como correctos o incorrectos",
        "pedir análisis de una obra que no está disponible",
        "usar una pauta rígida que elimine la creatividad",
      ],
      preferredModes: ["analisis_fuentes", "creacion", "argumentacion", "clasificacion"],
      promptPlaceholder:
        "Ej.: analizar elementos visuales o musicales de una obra descrita y proponer una creación con intención, técnica y reflexión justificadas.",
    },
  },
  {
    match: /educaci[oó]n f[ií]sica|corporalidad|movimiento|salud/i,
    profile: {
      family: "educacion_fisica",
      label: "Educación física, movimiento y salud",
      purpose: "Evaluar comprensión del movimiento, autocuidado, planificación de actividad física, convivencia y toma de decisiones saludables.",
      evidence: [
        "selección segura de acciones y hábitos",
        "aplicación de reglas, estrategias y principios del movimiento",
        "planes personales realistas y fundamentados",
      ],
      recommendations: [
        "usar casos de práctica, seguridad, estrategia y hábitos saludables",
        "diferenciar evaluación conceptual de desempeño motor presencial",
        "considerar diversidad corporal, inclusión y condiciones de seguridad",
      ],
      avoid: [
        "diagnósticos médicos o prescripciones clínicas",
        "comparaciones humillantes de rendimiento físico",
        "evaluar una habilidad motriz real solo mediante una pregunta escrita",
      ],
      preferredModes: ["estudio_caso", "aplicacion", "secuenciacion", "argumentacion"],
      promptPlaceholder:
        "Ej.: resolver casos de seguridad y estrategia, planificar actividad física y justificar hábitos de autocuidado adecuados al curso.",
    },
  },
  {
    match: /orientaci[oó]n|identidad|autonom[ií]a|convivencia/i,
    profile: {
      family: "orientacion",
      label: "Orientación, convivencia y desarrollo personal",
      purpose: "Promover reflexión, toma de decisiones, convivencia y autocuidado sin invadir la privacidad del estudiante.",
      evidence: [
        "identificación de alternativas y consecuencias",
        "uso de criterios de respeto, seguridad y bienestar",
        "propuestas de acción realistas y responsables",
      ],
      recommendations: [
        "usar casos ficticios y situaciones protectoras",
        "evaluar decisiones y fundamentos, no experiencias íntimas",
        "permitir más de una respuesta válida cuando los criterios estén claros",
      ],
      avoid: [
        "pedir confesiones, diagnósticos o información familiar sensible",
        "convertir valores personales en una única respuesta obligatoria",
        "situaciones que expongan o estigmaticen al estudiante",
      ],
      preferredModes: ["estudio_caso", "argumentacion", "comprension", "creacion"],
      promptPlaceholder:
        "Ej.: analizar un caso ficticio de convivencia, comparar decisiones y proponer una respuesta respetuosa, segura y fundamentada.",
    },
  },
  {
    match: /parvular|pensamiento matem[aá]tico|lenguaje verbal|entorno sociocultural/i,
    profile: {
      family: "parvularia",
      label: "Educación parvularia",
      purpose: "Observar aprendizajes mediante situaciones breves, concretas, lúdicas y mediadas por un adulto.",
      evidence: [
        "reconocimiento, elección, descripción o acción observable",
        "uso de lenguaje simple y apoyos visuales",
        "desempeño contextualizado en juego, exploración o rutina",
      ],
      recommendations: [
        "redactar consignas muy breves y una acción por vez",
        "priorizar observación, selección visual, clasificación y secuencias",
        "indicar al adulto cómo presentar el estímulo y registrar la evidencia",
      ],
      avoid: [
        "pruebas extensas de lectura o escritura autónoma",
        "alternativas abstractas sin apoyo concreto",
        "lenguaje técnico o instrucciones múltiples",
      ],
      preferredModes: ["clasificacion", "secuenciacion", "comprension", "creacion"],
      promptPlaceholder:
        "Ej.: actividades breves de observación, clasificación y secuencia con instrucciones para mediación adulta y evidencia observable.",
    },
  },
]

function normalize(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function getSubjectPedagogyProfile(subject: string): SubjectPedagogyProfile {
  const value = normalize(subject)
  return SUBJECT_PROFILES.find((item) => item.match.test(value))?.profile || DEFAULT_PROFILE
}

export function getPedagogicalModeLabel(id: string) {
  return PEDAGOGICAL_MODES.find((mode) => mode.id === id)?.label || id
}

export function buildSubjectGenerationDirective(input: {
  subject: string
  nivel?: string
  curso?: string
  topic?: string
  teacherPrompt?: string
  selectedOAs?: SelectedOAContext[]
  modeIds?: string[]
  sourceContext?: string
  skillFocus?: string
  authenticContext?: boolean
  difficulty?: string
  accessibility?: string
}) {
  const profile = getSubjectPedagogyProfile(input.subject)
  const selectedOAs = Array.isArray(input.selectedOAs) ? input.selectedOAs : []
  const modeIds = Array.isArray(input.modeIds) && input.modeIds.length
    ? input.modeIds
    : profile.preferredModes
  const modeLines = modeIds
    .map((id) => PEDAGOGICAL_MODES.find((mode) => mode.id === id))
    .filter(Boolean)
    .map((mode) => `- ${mode!.label}: ${mode!.description}`)
    .join("\n")
  const oaLines = selectedOAs.length
    ? selectedOAs
        .map((oa, index) => {
          const code = oa.codigoOficial || oa.id || `OA ${index + 1}`
          const extras = [
            oa.unidadNombre ? `Unidad: ${oa.unidadNombre}` : "",
            oa.ejes?.length ? `Ejes: ${oa.ejes.join(", ")}` : "",
            oa.habilidades?.length ? `Habilidades: ${oa.habilidades.join(", ")}` : "",
          ].filter(Boolean)
          return `${index + 1}. ${code}: ${oa.texto || ""}${extras.length ? `\n   ${extras.join(" · ")}` : ""}`
        })
        .join("\n")
    : "No se seleccionaron OA. Usa el tema y las indicaciones docentes, sin inventar códigos curriculares."

  return `PERFIL PEDAGÓGICO OBLIGATORIO
Asignatura: ${input.subject || "No especificada"}
Nivel: ${input.nivel || "No especificado"}
Curso: ${input.curso || "No especificado"}
Familia disciplinar: ${profile.label}
Propósito: ${profile.purpose}
Dificultad solicitada: ${input.difficulty || "mixta"}
Tema central: ${input.topic || "No especificado"}
Indicaciones del docente: ${input.teacherPrompt || "Usar el tema y los OA seleccionados"}

OBJETIVOS DE APRENDIZAJE QUE DEBEN SER EVALUADOS
${oaLines}

EVIDENCIAS ESPERADAS EN ESTA ASIGNATURA
${profile.evidence.map((item) => `- ${item}`).join("\n")}

MODOS PEDAGÓGICOS SOLICITADOS
${modeLines}

CRITERIOS DISCIPLINARES
${profile.recommendations.map((item) => `- ${item}`).join("\n")}

EVITAR
${profile.avoid.map((item) => `- ${item}`).join("\n")}

${input.authenticContext !== false ? "Usa situaciones auténticas, cercanas y adecuadas al curso cuando aporten al OA." : "No agregues contexto artificial si no ayuda a evaluar el OA."}
${input.skillFocus ? `Habilidades o énfasis adicionales: ${input.skillFocus}` : ""}
${input.sourceContext ? `FUENTE, TEXTO, DATOS O CONTEXTO ENTREGADO POR EL DOCENTE:\n${input.sourceContext}` : ""}
${input.accessibility ? `ADAPTACIONES Y ACCESIBILIDAD:\n${input.accessibility}` : ""}

REGLA CENTRAL: cada pregunta debe vincularse explícitamente con al menos un OA o con el tema docente cuando no existan OA disponibles. La respuesta, explicación, pauta y rúbrica deben generarse en el mismo objeto y ser verificadas antes de responder.`
}
