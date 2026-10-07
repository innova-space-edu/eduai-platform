import type { SupabaseClient } from "@supabase/supabase-js"

export type EduAIPlatformKnowledgeItem = {
  knowledge_key: string
  category: string
  title: string
  content: string
  facts?: Record<string, unknown> | null
  source_refs?: string[] | null
  priority?: number | null
  detail_level?: number | null
  keywords?: string[] | null
}

type ConversationMessage = {
  role: "user" | "assistant" | "system"
  content: string
}

export const EDUAI_PLATFORM_KNOWLEDGE_FALLBACK: EduAIPlatformKnowledgeItem[] = [
  {
    knowledge_key: "platform_identity",
    category: "identity",
    title: "Identidad de EDUAI",
    content:
      "EDUAI Platform es un ecosistema educativo multiagente y multimodal desarrollado por Innova Space Education SpA. Integra planificación, investigación con fuentes, notebooks, Creator Hub, evaluación digital, audio, imagen, video, colaboración y herramientas de inteligencia artificial. Su arquitectura está diseñada para evolucionar de forma continua.",
    facts: {
      product: "EDUAI Platform",
      organization: "Innova Space Education SpA",
      project_year: 2026,
      scope: "ecosistema educativo multiagente y multimodal",
    },
    source_refs: ["innova_2027.pdf", "README.md"],
    priority: 10,
    detail_level: 1,
    keywords: ["eduai", "plataforma", "que es eduai"],
  },
  {
    knowledge_key: "company_identity",
    category: "company",
    title: "Innova Space Education SpA",
    content:
      "Innova Space Education SpA es la empresa responsable del desarrollo de EDUAI y de otros prototipos, plataformas y servicios digitales vinculados con educación, ciencia, inteligencia artificial e innovación tecnológica. Su documentación institucional la ubica en Antofagasta, Chile.",
    facts: {
      company: "Innova Space Education SpA",
      location: "Antofagasta, Chile",
      areas: ["educación", "software", "inteligencia artificial", "innovación tecnológica"],
    },
    source_refs: ["innova_2027.pdf"],
    priority: 20,
    detail_level: 1,
    keywords: ["empresa", "innova space", "organizacion"],
  },
  {
    knowledge_key: "founder_identity",
    category: "founder",
    title: "Fundador y dirección",
    content:
      "La documentación institucional identifica a Esthefano Morales Campaña como fundador, propietario y Director Ejecutivo (CEO) de Innova Space Education SpA, con participación directa en el diseño, desarrollo y dirección tecnológica de prototipos, plataformas y servicios digitales de la empresa.",
    facts: {
      founder: "Esthefano Morales Campaña",
      roles: ["Fundador", "Propietario", "Director Ejecutivo (CEO)"],
    },
    source_refs: ["innova_2027.pdf"],
    priority: 25,
    detail_level: 1,
    keywords: ["fundador", "creador", "quien creo", "quien hizo", "ceo", "esthefano morales"],
  },
  {
    knowledge_key: "founder_academic_path",
    category: "trajectory",
    title: "Formación académica del fundador",
    content:
      "Esthefano Morales Campaña inició en 2013 la Licenciatura en Física con mención en Astronomía en la Universidad Católica del Norte. Su formación incluye física experimental, análisis de datos, computación científica, astronomía, instrumentación y modelamiento. En 2019 ingresó al Doctorado en Física con mención en Física Matemática de la Universidad de Antofagasta y desde 2020 fue beneficiario de la Beca de Doctorado Nacional ANID.",
    facts: {
      undergraduate: "Licenciatura en Física con mención en Astronomía, Universidad Católica del Norte",
      doctorate: "Doctorado en Física con mención en Física Matemática, Universidad de Antofagasta",
      anid_scholarship: 2020,
    },
    source_refs: ["resena trayectria 2027 (1)(1).pdf"],
    priority: 30,
    detail_level: 2,
    keywords: ["formacion", "estudios", "universidad", "doctorado", "trayectoria"],
  },
  {
    knowledge_key: "founder_scientific_trajectory",
    category: "trajectory",
    title: "Trayectoria científica",
    content:
      "Su trayectoria científica combina astronomía observacional, física de plasmas, electromagnetismo, física matemática, métodos numéricos e instrumentación. Trabajó en análisis espectroscópico y fotométrico de NGC 2453/NGC 2452, modeló la dinámica de Plasma Focus Sumaj Lauray 720-J, realizó caracterización de emisiones iónicas y desarrolló experiencia experimental en plasmas producidos por láser mediante shadowgrafía, interferometría Mach-Zehnder, imágenes rápidas y espectroscopía resuelta en el tiempo.",
    facts: {
      fields: ["astronomía", "física de plasmas", "electromagnetismo", "física matemática", "métodos numéricos", "instrumentación"],
      plasma_focus: "Sumaj Lauray 720-J",
    },
    source_refs: ["resena trayectria 2027 (1)(1).pdf"],
    priority: 35,
    detail_level: 2,
    keywords: ["investigacion cientifica", "plasma focus", "astronomia", "plasmas", "trayectoria cientifica"],
  },
  {
    knowledge_key: "founder_publications",
    category: "trajectory",
    title: "Publicaciones y producción científica",
    content:
      "La trayectoria declarada incluye cuatro artículos publicados en revistas internacionales con revisión por pares: dos trabajos en The European Physical Journal C sobre objetos compactos anisotrópicos y desacoplamiento gravitacional (2018), un artículo en Astronomy & Astrophysics sobre NGC 2453 y NGC 2452 (2019), y el artículo “MPQA method applied to the plasma dispersion function” en AIP Advances 14, 025142 (2024). También incluye un preprint de 2020 sobre modelamiento bidimensional de Plasma Focus y contribuciones en congresos nacionales e internacionales.",
    facts: {
      peer_reviewed_articles: 4,
      journals: ["The European Physical Journal C", "Astronomy & Astrophysics", "AIP Advances"],
      plasma_focus_preprint_year: 2020,
    },
    source_refs: ["resena trayectria 2027 (1)(1).pdf"],
    priority: 40,
    detail_level: 3,
    keywords: ["publicaciones", "papers", "articulos", "aip advances", "astronomy astrophysics", "epjc"],
  },
  {
    knowledge_key: "postdoctoral_research",
    category: "research",
    title: "Línea de investigación en plasma y micropropulsión",
    content:
      "La línea postdoctoral propuesta estudia una arquitectura ultraminiaturizada derivada de Plasma Focus para propulsión pulsada. Busca determinar cómo la geometría y la extensión axial relativa entre electrodos modifican el breakdown y el acoplamiento temporal circuito-plasma, caracterizar la formación y evolución de la current sheath, relacionarla con ablación, ionización y distribución del plume, cuantificar el impulse bit y evaluar repetibilidad, degradación y emisiones electromagnéticas con proyección a integración CubeSat.",
    facts: {
      field: "física de plasmas y micropropulsión",
      targets: ["breakdown", "circuito-plasma", "current sheath", "plume", "impulse bit", "CubeSat"],
    },
    source_refs: ["resena trayectria 2027 (1)(1).pdf"],
    priority: 45,
    detail_level: 2,
    keywords: ["postdoctorado", "micropropulsion", "cubesat", "current sheath", "impulse bit", "breakdown"],
  },
  {
    knowledge_key: "project_portfolio",
    category: "projects",
    title: "Portafolio tecnológico",
    content:
      "Los proyectos institucionales documentados incluyen EDUAI Platform, Sello Tecnológico, Model Lab Experimental I+D y Brain AI. EDUAI es el ecosistema educativo; Sello Tecnológico gestiona y documenta proyectos tecnológicos, científicos y STEAM; Model Lab compara e integra modelos, agentes y pipelines de IA; Brain AI explora memoria contextual, razonamiento multiagente, reflexión, síntesis de experiencias y generación de hipótesis.",
    facts: {
      projects: ["EDUAI Platform", "Sello Tecnológico", "Model Lab Experimental I+D", "Brain AI"],
    },
    source_refs: ["innova_2027.pdf"],
    priority: 50,
    detail_level: 1,
    keywords: ["proyectos", "portafolio", "productos", "ecosistema"],
  },
  {
    knowledge_key: "project_eduai",
    category: "projects",
    title: "EDUAI Platform",
    content:
      "EDUAI Platform está en evolución como ecosistema educativo multiagente y multimodal. Combina planificación, investigación con fuentes, notebooks, Creator Hub, evaluación digital, audio, imagen, video, colaboración, agentes especializados y una arquitectura multiproveedor de IA.",
    facts: {
      status: "en evolución",
      capabilities: ["planificación", "investigación", "notebooks", "Creator Hub", "evaluación", "audio", "imagen", "video", "colaboración"],
    },
    source_refs: ["innova_2027.pdf", "README.md"],
    priority: 55,
    detail_level: 2,
    keywords: ["eduai platform", "funciones eduai", "capacidades eduai"],
  },
  {
    knowledge_key: "project_sello",
    category: "projects",
    title: "Sello Tecnológico",
    content:
      "Sello Tecnológico es una plataforma para crear, desarrollar, documentar, evaluar y publicar proyectos tecnológicos, científicos y STEAM. Incluye roles institucionales, evidencias, seguimiento, rúbricas, comunidad y trazabilidad sobre infraestructura Supabase/Vercel. Su trayectoria incluye uso aplicado en un entorno educativo real.",
    facts: {
      status: "producción",
      focus: "proyectos tecnológicos, científicos y STEAM",
    },
    source_refs: ["innova_2027.pdf", "resena trayectria 2027 (1)(1).pdf"],
    priority: 60,
    detail_level: 2,
    keywords: ["sello tecnologico", "steam", "proyectos escolares"],
  },
  {
    knowledge_key: "project_model_lab",
    category: "projects",
    title: "Model Lab Experimental I+D",
    content:
      "Model Lab es un entorno experimental de I+D para comparar, integrar y evaluar modelos, agentes y pipelines de inteligencia artificial antes de incorporarlos a productos. Considera inferencia, RAG, contexto, multimodalidad, ejecución local y en nube, datasets, entrenamiento/adaptación y prototipos.",
    facts: {
      status: "I+D experimental",
      areas: ["inferencia", "RAG", "multimodalidad", "local/nube", "datasets", "prototipos"],
    },
    source_refs: ["innova_2027.pdf", "README.md"],
    priority: 65,
    detail_level: 2,
    keywords: ["model lab", "laboratorio modelos", "modelos ia"],
  },
  {
    knowledge_key: "project_brain_ai",
    category: "projects",
    title: "Brain AI",
    content:
      "Brain AI es una arquitectura experimental vinculada a Model Lab que explora memoria contextual, razonamiento multiagente, reflexión, síntesis de experiencias y generación de hipótesis. Evalúa aprendizaje y adaptación iterativa bajo supervisión humana; no debe presentarse como un sistema consciente ni como una cognición biológica equivalente.",
    facts: {
      status: "I+D experimental",
      areas: ["memoria contextual", "razonamiento multiagente", "reflexión", "síntesis", "hipótesis"],
    },
    source_refs: ["innova_2027.pdf"],
    priority: 70,
    detail_level: 2,
    keywords: ["brain ai", "memoria contextual", "razonamiento multiagente"],
  },
  {
    knowledge_key: "technology_stack",
    category: "technology",
    title: "Tecnologías principales",
    content:
      "El ecosistema documenta desarrollo con Next.js, React, TypeScript, Node.js, Python, REST APIs y PWA; nube y datos con Supabase, PostgreSQL, RLS, Realtime, Vercel, Cloudflare y GitHub; integración de IA con Gemini, Groq, OpenRouter, Hugging Face, Cerebras, Llama, Qwen y DeepSeek; y capacidades multimedia con modelos multimodales, TTS/STT, ElevenLabs, imagen, audio y video.",
    facts: {
      development: ["Next.js", "React", "TypeScript", "Node.js", "Python", "REST APIs", "PWA"],
      cloud_data: ["Supabase", "PostgreSQL", "RLS", "Realtime", "Vercel", "Cloudflare", "GitHub"],
      ai: ["Gemini", "Groq", "OpenRouter", "Hugging Face", "Cerebras", "Llama", "Qwen", "DeepSeek"],
      multimedia: ["TTS/STT", "ElevenLabs", "imagen", "audio", "video"],
    },
    source_refs: ["innova_2027.pdf", "README.md", "package.json"],
    priority: 75,
    detail_level: 1,
    keywords: ["tecnologias", "stack", "framework", "nube", "supabase", "vercel", "modelos"],
  },
  {
    knowledge_key: "services",
    category: "services",
    title: "Servicios y capacidades",
    content:
      "Las capacidades de Innova Space Education SpA abarcan desarrollo de software y soluciones educativas digitales, plataformas y automatización de procesos, integración de inteligencia artificial y agentes, infraestructura cloud y bases de datos, investigación y análisis de información, creación de recursos y herramientas multimedia, planificación y evaluación educativa, prototipado tecnológico y acompañamiento de proyectos científicos y STEAM.",
    facts: {
      services: [
        "desarrollo de software educativo",
        "integración de IA y agentes",
        "infraestructura cloud y datos",
        "investigación y análisis",
        "multimedia",
        "planificación y evaluación",
        "prototipado tecnológico",
        "proyectos científicos y STEAM"
      ],
    },
    source_refs: ["innova_2027.pdf", "resena trayectria 2027 (1)(1).pdf", "README.md"],
    priority: 80,
    detail_level: 1,
    keywords: ["servicios", "que hacen", "soluciones", "clientes"],
  },
  {
    knowledge_key: "research_fields",
    category: "research",
    title: "Campos de investigación y desarrollo",
    content:
      "Las líneas de trabajo combinan física de plasmas, micropropulsión y tecnología espacial; modelamiento físico y métodos numéricos; inteligencia artificial educativa; agentes y orquestación; RAG y memoria; modelos locales y cuantizados; entrenamiento y adaptación de modelos; multimodalidad; voz, audio, imagen y video; visualización científica; evaluación educativa, currículo y accesibilidad PIE/NEE.",
    facts: {
      fields: [
        "física de plasmas",
        "micropropulsión",
        "tecnología espacial",
        "modelamiento y métodos numéricos",
        "IA educativa",
        "agentes",
        "RAG y memoria",
        "modelos locales",
        "multimodalidad",
        "visualización científica",
        "tecnología educativa"
      ],
    },
    source_refs: ["innova_2027.pdf", "resena trayectria 2027 (1)(1).pdf", "README.md"],
    priority: 85,
    detail_level: 1,
    keywords: ["investigacion", "i+d", "campos de trabajo", "lineas de investigacion"],
  },
  {
    knowledge_key: "innovation_outreach",
    category: "trajectory",
    title: "Innovación y vinculación",
    content:
      "La trayectoria combina investigación, docencia, divulgación científica y desarrollo tecnológico. Incluye participación en actividades de física y astronomía, comunicación científica, experiencias experimentales y desarrollo de herramientas digitales aplicadas a usuarios finales. Desde 2025 se incorporaron de manera sistemática desarrollo de software, bases de datos, infraestructura cloud e integración de inteligencia artificial al perfil profesional.",
    facts: {
      areas: ["investigación", "docencia", "divulgación", "desarrollo tecnológico"],
      software_ai_since: 2025,
    },
    source_refs: ["resena trayectria 2027 (1)(1).pdf"],
    priority: 90,
    detail_level: 2,
    keywords: ["innovacion", "divulgacion", "vinculacion", "transferencia tecnologica"],
  },
  {
    knowledge_key: "malecns_overview",
    category: "malecns",
    title: "MaleCNS AI: objetivo y sustrato",
    content:
      "MaleCNS AI es una línea experimental que estudia si una topología neuronal real, combinada con plasticidad y mecanismos de memoria, puede sostener aprendizaje persistente sin depender de un modelo de lenguaje como sustrato cognitivo principal. El runtime histórico usa la topología estructural Male Drosophila CNS v1.0 con 165.122 neuronas y 25.563.096 conexiones. Es un runtime sparse de ingeniería, no spiking, y sus resultados no implican consciencia ni equivalencia fisiológica con Drosophila.",
    facts: {
      topology: "Male Drosophila CNS v1.0",
      neurons: 165122,
      connections: 25563096,
      nature: "runtime sparse de ingeniería",
    },
    source_refs: ["Informe_MaleCNS_AI_estado_V29.pdf", "Pasted text(20260916-024210).txt"],
    priority: 100,
    detail_level: 1,
    keywords: ["malecns", "modelo neuronas", "connectoma", "165122", "drosophila"],
  },
  {
    knowledge_key: "malecns_validated_results",
    category: "malecns",
    title: "MaleCNS: resultados validados hasta V29",
    content:
      "El informe V29 registra como hitos validados V20 (memoria episódica y novedad), V22 (recuperación asociativa), V24 (self-state/metacognition) y V28b (routing sparse aprendido memoria→acción). En V28b el router alcanzó 80,5% held-out frente a controles cercanos a 50%. V29-fix1 mostró query accuracy de 86,1%, pero READ recall de 36,1%, por lo que el gate autónomo WRITE/HOLD/READ no quedó validado estrictamente. El principal cuello de botella identificado era decidir autónomamente cuándo escribir, mantener o leer memoria.",
    facts: {
      validated: ["V20 episodic memory", "V22 associative retrieval", "V24 self monitor", "V28b sparse learned routing"],
      v28b_heldout_accuracy: 0.805,
      v29_fix1_query_accuracy: 0.861,
      v29_fix1_read_recall: 0.361,
      v29_strict_validated: false,
    },
    source_refs: ["Informe_MaleCNS_AI_estado_V29.pdf"],
    priority: 105,
    detail_level: 2,
    keywords: ["resultados malecns", "v20", "v22", "v24", "v28", "v29", "validacion", "read recall"],
  },
  {
    knowledge_key: "malecns_architecture",
    category: "malecns",
    title: "MaleCNS: arquitectura que emerge de los experimentos",
    content:
      "La hipótesis refinada separa tres escalas funcionales: un estado rápido para percepción/acción que puede volver a basal en fronteras de evento; memorias o trazas persistentes fuera del recurrente global; y un sistema de gating/routing que decide WRITE, HOLD o READ. El ciclo objetivo es observar → estado rápido → autoevaluación → gate → lectura/escritura de memoria → router → acción → recompensa/error → plasticidad → consolidación/replay cuando corresponda.",
    facts: {
      layers: ["estado rápido", "memoria persistente", "gate y routing"],
      gate_actions: ["WRITE", "HOLD", "READ"],
      learning: ["reward/error", "plasticidad", "consolidación", "replay"],
    },
    source_refs: ["Informe_MaleCNS_AI_estado_V29.pdf"],
    priority: 110,
    detail_level: 2,
    keywords: ["arquitectura malecns", "write hold read", "memoria", "routing", "consolidacion", "plasticidad"],
  },
  {
    knowledge_key: "malecns_scaling_v45c",
    category: "malecns",
    title: "MaleCNS V45C Scalable",
    content:
      "V45C Scalable es el protocolo de escalamiento actualmente preparado para continuar MaleCNS sin usar modelos de IA externos. El notebook define entrenamiento regional de 160→192→224→256 asociaciones y gates de capacidad/retención. Sólo si ese bloque pasa, construye una expansión real de 4.161→8.192 neuronas usando el connectoma MaleCNS y transfiere el checkpoint. Las expansiones 16k→32k→65k→131k→165k quedan explícitamente bloqueadas hasta revisar 8.192. El notebook disponible define el procedimiento, pero no contiene una ejecución final registrada que permita afirmar que 8.192 o 165k ya fueron validados.",
    facts: {
      regional_associations: [160, 192, 224, 256],
      first_real_expansion: [4161, 8192],
      later_targets: [16384, 32768, 65536, 131072, 165122],
      external_ai_used: false,
      validation_status: "protocol prepared; final V45C run not evidenced in the notebook",
    },
    source_refs: ["MaleCNS_V45C_Colab.ipynb"],
    priority: 115,
    detail_level: 2,
    keywords: ["v45c", "escalar", "escalabilidad", "256 asociaciones", "8192", "165k", "165122"],
  },
  {
    knowledge_key: "malecns_future_research",
    category: "malecns",
    title: "MaleCNS: líneas experimentales siguientes",
    content:
      "Las líneas propuestas para etapas posteriores incluyen plasticidad sináptica multiescala fast→slow, protección de sinapsis importantes, eligibility traces y aprendizaje online; parametrización progresiva para no hacer plásticas las 25,5 millones de conexiones desde el inicio; un piloto de memoria asociativa en Mushroom Body con sinapsis KC→MBON moduladas por neuronas dopaminérgicas; memoria multi-item con interferencia y recuperación por contenido; controles matched-null del connectoma; y e-prop/learning signals locales. Estas ideas son hipótesis y planes experimentales, no resultados ya validados.",
    facts: {
      proposed: [
        "plasticidad fast→slow",
        "importancia sináptica",
        "eligibility traces",
        "pools plásticos progresivos",
        "Mushroom Body KC→MBON + DAN",
        "memoria multi-item",
        "matched-null controls",
        "e-prop"
      ],
      status: "propuestas de I+D",
    },
    source_refs: ["Texto pegado(20261004-223944).txt", "Informe_MaleCNS_AI_estado_V29.pdf"],
    priority: 120,
    detail_level: 3,
    keywords: ["mushroom body", "eligibility", "sinapsis", "plasticidad multiescala", "e-prop", "futuro malecns"],
  },
  {
    knowledge_key: "institution_neutrality",
    category: "positioning",
    title: "Alcance institucional",
    content:
      "EDUAI se presenta para personas e instituciones educativas en general. Claw no debe asumir Colegio Providencia ni ninguna institución, ciudad o país concreto salvo que el usuario lo indique. Cuando exista contexto institucional explícito, puede adaptar lenguaje, currículo, herramientas y referencias locales.",
    facts: {
      default_scope: "personas e instituciones educativas",
      assume_specific_institution: false,
    },
    source_refs: ["product_policy"],
    priority: 200,
    detail_level: 1,
    keywords: ["institucion", "colegio", "universidad", "pais"],
  },
]

const PLATFORM_KNOWLEDGE_QUERY =
  /(eduai|innova\s+space|esthefano\s+morales|fundador|creador|empresa|organizaci[oó]n|tecnolog[ií]a|stack|proyecto|investigaci[oó]n|i\+d|campo\s+de\s+trabajo|servicio|plataforma|sitio\s+web|p[aá]gina\s+web|malecns|connectoma|drosophila|neuronas?|v2[089]|v4[45]|mushroom\s+body|plasticidad|eligibility|micropropulsi[oó]n|plasma\s+focus|publicaciones?)/i

const FOLLOW_UP_QUERY =
  /^(y\s+)?(m[aá]s|cu[eé]ntame\s+m[aá]s|dame\s+m[aá]s|profundiza|ampl[ií]a|contin[uú]a|qu[eé]\s+m[aá]s|y\s+eso|y\s+despu[eé]s|detalles?|m[aá]s\s+detalles?)\b/i

function normalize(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function previousRelevantUserMessage(
  current: string,
  history: ConversationMessage[] = [],
) {
  const reversed = [...history].reverse()
  let skippedCurrent = false

  for (const item of reversed) {
    if (item.role !== "user") continue
    const content = String(item.content || "").trim()
    if (!content) continue

    if (!skippedCurrent && content === current.trim()) {
      skippedCurrent = true
      continue
    }

    if (PLATFORM_KNOWLEDGE_QUERY.test(content)) return content
  }

  return ""
}

function resolveKnowledgeQuery(
  userMessage: string,
  history: ConversationMessage[] = [],
) {
  const current = String(userMessage || "").trim()
  if (PLATFORM_KNOWLEDGE_QUERY.test(current)) return current

  if (FOLLOW_UP_QUERY.test(current)) {
    const previous = previousRelevantUserMessage(current, history)
    if (previous) return `${previous} · seguimiento: ${current}`
  }

  return current
}

export function shouldLoadEduAIPlatformKnowledge(
  message: string,
  history: ConversationMessage[] = [],
) {
  return PLATFORM_KNOWLEDGE_QUERY.test(resolveKnowledgeQuery(message, history))
}

function selectKnowledgeKeys(query: string) {
  const q = normalize(query)
  const deep = /(mas|detalle|profund|amplia|completo|continua|trayectoria|resultados|arquitectura|como funciona)/.test(q)
  const keys: string[] = []

  const add = (...values: string[]) => {
    for (const value of values) {
      if (!keys.includes(value)) keys.push(value)
    }
  }

  const isMaleCns = /(malecns|connectoma|drosophila|165122|165k|neuronas|v29|v45c|mushroom body|eligibility)/.test(q)
  if (isMaleCns) {
    if (/(v45c|escal|256|512|1024|8192|165k|165122|capacidad)/.test(q)) {
      add("malecns_scaling_v45c", "malecns_overview")
    } else if (/(resultado|valid|v20|v22|v24|v28|v29|recall|accuracy|gate)/.test(q)) {
      add("malecns_validated_results", "malecns_overview")
    } else if (/(arquitect|write|hold|read|routing|memoria|consolid|plasticidad)/.test(q)) {
      add("malecns_architecture", "malecns_validated_results")
    } else if (/(futuro|siguiente|mushroom|eligibility|e-prop|sinaps|pool)/.test(q)) {
      add("malecns_future_research", "malecns_architecture")
    } else {
      add("malecns_overview", "malecns_validated_results")
    }

    if (deep) {
      add("malecns_architecture", "malecns_scaling_v45c", "malecns_future_research")
    }
  }

  if (/(quien\s+(creo|hizo|desarrollo)|fundador|creador|ceo|esthefano morales)/.test(q)) {
    add("founder_identity")
    if (deep || /(trayectoria|estudio|formacion|investigacion|publicacion)/.test(q)) {
      add("founder_academic_path", "founder_scientific_trajectory")
    }
    if (/(publicacion|paper|articulo)/.test(q)) add("founder_publications")
  }

  if (/(empresa|innova space|organizacion)/.test(q)) {
    add("company_identity")
    if (/(fundador|creador|quien)/.test(q)) add("founder_identity")
    if (/(servicio|que hacen|solucion)/.test(q)) add("services")
  }

  if (/(postdoctor|micropropulsion|cubesat|current sheath|impulse bit|breakdown|plasma focus)/.test(q)) {
    add("postdoctoral_research", "founder_scientific_trajectory")
  }

  if (/(publicacion|papers?|articulos?|aip advances|astronomy|epjc)/.test(q)) {
    add("founder_publications", "founder_scientific_trajectory")
  }

  if (/(investigacion|i\+d|campos? de trabajo|lineas? de investigacion)/.test(q) && !isMaleCns) {
    add("research_fields")
    if (deep) add("founder_scientific_trajectory", "postdoctoral_research", "innovation_outreach")
  }

  if (/(proyectos?|portafolio|productos?)/.test(q)) add("project_portfolio")
  if (/(sello tecnologico|steam)/.test(q)) add("project_sello")
  if (/(model lab|laboratorio de modelos)/.test(q)) add("project_model_lab")
  if (/(brain ai)/.test(q)) add("project_brain_ai")

  if (/(tecnologia|stack|framework|supabase|vercel|cloudflare|github|gemini|groq|openrouter|hugging face|cerebras|llama|qwen|deepseek)/.test(q)) {
    add("technology_stack")
  }

  if (/(servicios?|que hacen|soluciones?)/.test(q)) add("services")

  if (/(eduai|plataforma)/.test(q)) {
    add("platform_identity")
    if (deep || /(funcion|capacidad|herramienta|modulo)/.test(q)) add("project_eduai")
  }

  if (keys.length === 0 && /(innova space)/.test(q)) add("company_identity")
  if (keys.length === 0 && /(eduai)/.test(q)) add("platform_identity")

  const maxItems = deep ? 4 : 2
  return keys.slice(0, maxItems)
}

function formatKnowledge(items: EduAIPlatformKnowledgeItem[]) {
  const body = items
    .sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100))
    .map((item) => `- ${item.title}: ${item.content}`)
    .join("\n")

  return [
    "CONOCIMIENTO VERIFICADO Y SELECCIONADO DE EDUAI / INNOVA SPACE:",
    body,
    "",
    "REGLA DE DOSIFICACIÓN:",
    "- Responde únicamente la pregunta actual usando primero 1 a 3 hechos pertinentes.",
    "- No vuelques el resto de la base de conocimiento ni enumeres proyectos, publicaciones o resultados que no fueron preguntados.",
    "- Si hay más información disponible, puedes cerrar con una frase breve indicando que puedes profundizar en ese mismo aspecto.",
    "- En un seguimiento como “cuéntame más”, amplía el tema anterior de forma progresiva en vez de repetir toda la ficha.",
    "- Distingue con claridad resultados validados, prototipos en evolución y planes experimentales todavía no validados.",
    "- No inventes clientes, contratos, cifras comerciales, resultados científicos ni estados de entrenamiento que no aparezcan en este contexto.",
  ].join("\n")
}

export async function getEduAIPlatformKnowledgeContext(
  supabase: SupabaseClient,
  userMessage: string,
  history: ConversationMessage[] = [],
): Promise<string> {
  const query = resolveKnowledgeQuery(userMessage, history)
  if (!PLATFORM_KNOWLEDGE_QUERY.test(query)) return ""

  const keys = selectKnowledgeKeys(query)
  if (keys.length === 0) return ""

  try {
    const { data, error } = await supabase
      .from("eduai_platform_knowledge")
      .select("knowledge_key,category,title,content,facts,source_refs,priority,detail_level,keywords")
      .in("knowledge_key", keys)
      .eq("is_active", true)
      .order("priority", { ascending: true })

    if (!error && Array.isArray(data) && data.length > 0) {
      const byKey = new Map(
        (data as EduAIPlatformKnowledgeItem[]).map((item) => [item.knowledge_key, item]),
      )
      const selected = keys
        .map((key) => byKey.get(key))
        .filter((item): item is EduAIPlatformKnowledgeItem => Boolean(item))

      if (selected.length > 0) return formatKnowledge(selected)
    }
  } catch {
    // En previews la migración puede no estar aplicada todavía.
  }

  const byKey = new Map(
    EDUAI_PLATFORM_KNOWLEDGE_FALLBACK.map((item) => [item.knowledge_key, item]),
  )
  return formatKnowledge(
    unique(keys)
      .map((key) => byKey.get(key))
      .filter((item): item is EduAIPlatformKnowledgeItem => Boolean(item)),
  )
}
