export type EduAIPage = {
  key: string
  label: string
  href: string
  emoji: string
  description: string
  keywords: string[]
  group: "study" | "exam" | "creator" | "media" | "admin" | "workspace" | "general"
}

export const EDUAI_PAGES: EduAIPage[] = [
  {
    key: "dashboard",
    label: "Panel principal",
    href: "/dashboard",
    emoji: "🏠",
    description: "Inicio del usuario, estadísticas, sesiones y consola Claw.",
    keywords: ["inicio", "dashboard", "panel", "home", "principal"],
    group: "general",
  },
  {
    key: "study",
    label: "Sesión de estudio",
    href: "/study",
    emoji: "📚",
    description: "Aprendizaje autónomo con teoría, ejemplos, ejercicios, resumen y Sócrates.",
    keywords: ["estudiar", "aprender", "repasar", "sesion", "sesión", "teoria", "teoría", "socrates", "sócrates"],
    group: "study",
  },
  {
    key: "create_exam",
    label: "Crear examen",
    href: "/examen/crear",
    emoji: "📝",
    description: "Crea evaluaciones con IA, alternativas, desarrollo, rúbricas y configuración.",
    keywords: ["crear examen", "prueba", "evaluacion", "evaluación", "preguntas", "examen", "rúbrica", "rubrica"],
    group: "exam",
  },
  {
    key: "teacher_exams",
    label: "Exámenes docente",
    href: "/examen/docente",
    emoji: "📊",
    description: "Listado docente de evaluaciones, links, resultados y administración.",
    keywords: ["mis examenes", "mis exámenes", "resultados", "notas", "docente", "evaluaciones"],
    group: "exam",
  },
  {
    key: "creator_hub",
    label: "Creator Hub",
    href: "/creator-hub",
    emoji: "🚀",
    description: "Centro para crear materiales, contenido, media y recursos educativos.",
    keywords: ["creator", "hub", "material", "recurso", "generar material", "herramientas"],
    group: "creator",
  },
  {
    key: "qr_studio",
    label: "QR Studio",
    href: "/qr-studio",
    emoji: "▦",
    description: "Crear y administrar códigos QR para enlaces, textos y cuadernos.",
    keywords: ["qr", "codigo qr", "código qr", "enlace qr", "compartir qr"],
    group: "creator",
  },
  {
    key: "image_studio",
    label: "Image Studio",
    href: "/image-studio",
    emoji: "🎨",
    description: "Generación de imágenes educativas con IA.",
    keywords: ["imagen", "imagenes", "imágenes", "infografia", "infografía", "visual", "afiche", "poster"],
    group: "media",
  },
  {
    key: "gallery",
    label: "Galería",
    href: "/galeria",
    emoji: "🖼️",
    description: "Galería de imágenes y recursos generados.",
    keywords: ["galeria", "galería", "imagenes guardadas", "imágenes guardadas"],
    group: "media",
  },
  {
    key: "audio_lab",
    label: "Audio Lab",
    href: "/audio-lab",
    emoji: "🎙️",
    description: "Transcripción, narración y herramientas de audio.",
    keywords: ["audio", "voz", "narrar", "transcribir", "tts", "whisper"],
    group: "media",
  },
  {
    key: "video_studio",
    label: "Video Studio",
    href: "/video-studio",
    emoji: "🎬",
    description: "Creación de videos educativos con IA.",
    keywords: ["video", "animación", "animacion", "text to video"],
    group: "media",
  },
  {
    key: "paper",
    label: "Chat Paper",
    href: "/paper",
    emoji: "📄",
    description: "Trabajo con documentos, papers y lectura asistida.",
    keywords: ["paper", "pdf", "documento", "investigación", "investigacion", "leer documento"],
    group: "study",
  },
  {
    key: "workspace",
    label: "Workspace",
    href: "/workspace",
    emoji: "📁",
    description: "Organización de proyectos y materiales.",
    keywords: ["workspace", "proyecto", "proyectos", "organizar", "carpeta"],
    group: "workspace",
  },
  {
    key: "educator",
    label: "Planificador docente",
    href: "/educador",
    emoji: "🏫",
    description: "Planificación de clases, OA y recursos docentes.",
    keywords: ["planificar", "planificación", "planificacion", "clase", "mineduc", "oa", "docente"],
    group: "admin",
  },
  {
    key: "agents",
    label: "Agentes EduAI",
    href: "/agentes",
    emoji: "🤖",
    description: "Listado de agentes especializados de EduAI.",
    keywords: ["agentes", "agente", "ia", "asistentes"],
    group: "general",
  },
]

export function normalizeSearchText(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function extractStudyTopicFromMessage(message: string) {
  const cleaned = String(message || "")
    .replace(/^(quiero|necesito|ay[uú]dame a|puedes)?\s*(estudiar|aprender|repasar|ver|enseñame|enséñame)\s*/i, "")
    .replace(/^(sobre|de|del|la|el|los|las)\s*/i, "")
    .replace(/\s*(paso a paso|con ejemplos|con ejercicios|en modo socrates|en modo sócrates)$/i, "")
    .trim()

  return cleaned || String(message || "").trim()
}

export function buildStudyHref(topic: string) {
  const safe = encodeURIComponent(String(topic || "tema general").trim())
  return `/study/${safe}`
}

export function isStudyIntent(message: string) {
  return /^\s*(quiero\s+|necesito\s+|ay[uú]dame\s+a\s+|puedes\s+)?(estudiar|aprender|repasar|enseñame|enséñame)\b/i.test(message)
}

export function isNavigationIntent(message: string) {
  return /\b(abr(e|ir)|anda|ir|ll[eé]vame|llevarme|redirige|entra|entrar|abre|buscar en eduai|donde est[aá]|dónde est[aá])\b/i.test(message)
}

export function searchEduAIPages(query: string, limit = 5) {
  const q = normalizeSearchText(query)
  if (!q) return EDUAI_PAGES.slice(0, limit)

  const words = q.split(" ").filter((word) => word.length > 2)
  const scored = EDUAI_PAGES.map((page) => {
    const haystack = normalizeSearchText(`${page.label} ${page.description} ${page.key} ${page.keywords.join(" ")}`)
    const exact = haystack.includes(q) ? 6 : 0
    const wordScore = words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0)
    return { page, score: exact + wordScore }
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((item) => item.page)
}

export function findBestEduAIPage(query: string) {
  return searchEduAIPages(query, 1)[0]
}
