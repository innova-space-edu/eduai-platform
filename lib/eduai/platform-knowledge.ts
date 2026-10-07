import type { SupabaseClient } from "@supabase/supabase-js"

export type EduAIPlatformKnowledgeItem = {
  knowledge_key: string
  category: string
  title: string
  content: string
  facts?: Record<string, unknown> | null
  source_refs?: string[] | null
  priority?: number | null
}

export const EDUAI_PLATFORM_KNOWLEDGE_FALLBACK: EduAIPlatformKnowledgeItem[] = [
  {
    knowledge_key: "platform_identity",
    category: "identity",
    title: "Identidad de EDUAI",
    content:
      "EDUAI Platform es un ecosistema educativo desarrollado por Innova Space Education SpA. La documentación vigente del repositorio identifica 2026 como año del proyecto y usa el dominio eduai.innova-space-edu.cl.",
    facts: {
      product: "EDUAI Platform",
      organization: "Innova Space Education SpA",
      year: 2026,
      domain: "eduai.innova-space-edu.cl",
    },
    source_refs: ["README.md", "LICENSE"],
    priority: 10,
  },
  {
    knowledge_key: "creator_and_company",
    category: "company",
    title: "Organización creadora",
    content:
      "La organización desarrolladora y responsable documentada del proyecto es Innova Space Education SpA. El repositorio no registra de forma verificable el nombre de una persona creadora individual, por lo que Claw no debe inventarlo. Ese dato puede incorporarse cuando exista un registro oficial dentro de la base.",
    facts: {
      creator_organization: "Innova Space Education SpA",
      creator_person: null,
      creator_person_status: "pendiente_de_registro_verificado",
    },
    source_refs: ["README.md", "LICENSE"],
    priority: 20,
  },
  {
    knowledge_key: "technology_stack",
    category: "technology",
    title: "Tecnologías principales",
    content:
      "El stack documentado incluye Next.js 16.3.5, React 19.2.3, TypeScript 5, Node.js 22, Supabase/PostgreSQL, Tailwind CSS 4 y despliegue web en Vercel. El ecosistema también integra un gateway multiproveedor de IA, Groq/Whisper para audio, APIs de Google/Gemini y un runtime local experimental basado en GGUF/wllama.",
    facts: {
      frontend: ["Next.js 16.3.5", "React 19.2.3", "TypeScript 5", "Tailwind CSS 4"],
      backend: ["Node.js 22", "Supabase", "PostgreSQL"],
      deployment: ["Vercel"],
      ai: ["EduAI AI Gateway", "Groq", "Whisper", "Google Gemini"],
      local_ai: ["GGUF", "wllama", "RAG local"],
    },
    source_refs: ["README.md", "package.json", "training/eduai-local/README.md"],
    priority: 30,
  },
  {
    knowledge_key: "product_portfolio",
    category: "projects",
    title: "Proyectos y líneas del ecosistema",
    content:
      "El repositorio documenta EDUAI Platform y líneas internas como Claw/Open EDUAI Work, Creator Hub, Image Studio, Video Studio, Audio Lab, planificación y evaluación, biblioteca/repositorio, EduAI Local/Model Factory y la integración Visual Design Skills. Deben describirse como productos, módulos o líneas del ecosistema; no como empresas separadas.",
    facts: {
      projects: [
        "EDUAI Platform",
        "Claw / Open EDUAI Work",
        "Creator Hub",
        "Image Studio",
        "Video Studio",
        "Audio Lab",
        "EduAI Local / Model Factory",
        "Visual Design Skills integration"
      ],
    },
    source_refs: ["README.md", "package.json"],
    priority: 40,
  },
  {
    knowledge_key: "research_fields",
    category: "research",
    title: "Investigación y campos de trabajo",
    content:
      "Las líneas técnicas y de investigación representadas en el repositorio incluyen inteligencia artificial educativa, agentes y orquestación, RAG y recuperación de conocimiento, modelos locales y cuantizados, LoRA/QLoRA, generación multimodal, análisis de documentos, voz y audio, evaluación educativa, currículo, accesibilidad PIE/NEE y herramientas visuales/científicas.",
    facts: {
      fields: [
        "IA educativa",
        "agentes y orquestación",
        "RAG",
        "modelos locales y cuantización",
        "LoRA/QLoRA",
        "multimodalidad",
        "análisis documental",
        "voz y audio",
        "evaluación educativa",
        "currículo",
        "accesibilidad PIE/NEE",
        "visualización científica"
      ],
    },
    source_refs: ["README.md", "training/eduai-local/README.md"],
    priority: 50,
  },
  {
    knowledge_key: "services",
    category: "services",
    title: "Servicios y capacidades",
    content:
      "Las capacidades y servicios documentados por el ecosistema abarcan desarrollo de soluciones educativas digitales, planificación y apoyo curricular, creación de evaluaciones, generación de materiales, integración de IA y agentes, investigación y análisis documental, contenido multimedia, audio/voz, repositorios y espacios de trabajo, colaboración y automatización de flujos educativos.",
    facts: {
      services: [
        "desarrollo de soluciones educativas digitales",
        "planificación y apoyo curricular",
        "evaluaciones y rúbricas",
        "creación de materiales",
        "integración de IA y agentes",
        "investigación y análisis documental",
        "multimedia, audio y voz",
        "repositorios y espacios de trabajo",
        "automatización de flujos educativos"
      ],
    },
    source_refs: ["README.md"],
    priority: 60,
  },
  {
    knowledge_key: "institution_neutrality",
    category: "positioning",
    title: "Alcance institucional",
    content:
      "EDUAI debe presentarse de forma general para personas e instituciones educativas. Claw no debe asumir Colegio Providencia ni ninguna institución concreta salvo que el usuario la indique explícitamente. Cuando corresponda, debe adaptar lenguaje, currículo y contexto a la institución o país informado por la persona.",
    facts: {
      default_scope: "instituciones educativas en general",
      assume_specific_institution: false,
    },
    source_refs: ["product_policy"],
    priority: 70,
  },
]

const PLATFORM_KNOWLEDGE_QUERY =
  /(eduai|innova\s+space|qu[ií]en\s+(cre[oó]|hizo|desarroll[oó])|creador|creadora|empresa|organizaci[oó]n|tecnolog[ií]a|stack|proyecto|investigaci[oó]n|campo\s+de\s+trabajo|servicio|plataforma|sitio\s+web|p[aá]gina\s+web)/i

export function shouldLoadEduAIPlatformKnowledge(message: string) {
  return PLATFORM_KNOWLEDGE_QUERY.test(String(message || ""))
}

function formatKnowledge(items: EduAIPlatformKnowledgeItem[]) {
  const body = items
    .sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100))
    .map((item) => `- ${item.title}: ${item.content}`)
    .join("\n")

  return [
    "CONOCIMIENTO VERIFICADO DE EDUAI / INNOVA SPACE:",
    body,
    "Usa estos datos cuando sean pertinentes. No inventes nombres de fundadores, clientes, contratos, proyectos externos, cifras comerciales ni servicios que no aparezcan en este contexto.",
  ].join("\n")
}

export async function getEduAIPlatformKnowledgeContext(
  supabase: SupabaseClient,
  userMessage: string,
): Promise<string> {
  if (!shouldLoadEduAIPlatformKnowledge(userMessage)) return ""

  try {
    const { data, error } = await supabase
      .from("eduai_platform_knowledge")
      .select("knowledge_key,category,title,content,facts,source_refs,priority")
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .limit(24)

    if (!error && Array.isArray(data) && data.length > 0) {
      return formatKnowledge(data as EduAIPlatformKnowledgeItem[])
    }
  } catch {
    // La migración puede no haberse aplicado aún en un preview.
  }

  return formatKnowledge(EDUAI_PLATFORM_KNOWLEDGE_FALLBACK)
}
