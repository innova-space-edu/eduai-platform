export type CreatorHubFormatCategory = "visual" | "study" | "narrative" | "planning"

export type CreatorHubFormat = {
  id: string
  icon: string
  label: string
  shortLabel?: string
  description: string
  color: string
  category: CreatorHubFormatCategory
  placeholder: string
  highlights: string[]
}

export type CreatorHubTool = {
  id: string
  href: string
  icon: string
  label: string
  description: string
  color: string
  badge?: string
  features: string[]
}

export const CREATOR_HUB_FORMATS: CreatorHubFormat[] = [
  {
    id: "infographic",
    icon: "📊",
    label: "Infografía",
    description: "Bloques visuales con conceptos, datos clave y estadísticas destacadas.",
    color: "#3b82f6",
    category: "visual",
    placeholder: "Ej: Cambio climático, fotosíntesis o tipos de energía...",
    highlights: ["PNG, JPG y PDF", "Plantillas visuales", "Datos destacados"],
  },
  {
    id: "ppt",
    icon: "📑",
    label: "Presentación",
    description: "Diapositivas descargables con portada, secciones y notas del orador.",
    color: "#8b5cf6",
    category: "visual",
    placeholder: "Ej: Inteligencia artificial, Segunda Guerra Mundial o sistema solar...",
    highlights: ["PPTX descargable", "PDF y PNG", "Notas del orador"],
  },
  {
    id: "poster",
    icon: "🎨",
    label: "Afiche",
    description: "Póster llamativo para ferias, clases, campañas y proyectos escolares.",
    color: "#ec4899",
    category: "visual",
    placeholder: "Ej: Día del medio ambiente, convivencia escolar o feria científica...",
    highlights: ["Formato visual", "PNG, JPG y PDF", "Llamado a la acción"],
  },
  {
    id: "mindmap",
    icon: "🧠",
    label: "Mapa mental",
    description: "Árbol de conceptos conectados para organizar ideas principales y secundarias.",
    color: "#10b981",
    category: "visual",
    placeholder: "Ej: Ecosistemas, tipos de energía o historia de Chile...",
    highlights: ["Conceptos conectados", "Vista interactiva", "PNG y PDF"],
  },
  {
    id: "timeline",
    icon: "⏳",
    label: "Timeline",
    description: "Línea temporal con fechas, hitos y niveles de importancia visual.",
    color: "#f97316",
    category: "visual",
    placeholder: "Ej: Independencia de Chile, evolución de internet o historia de la química...",
    highlights: ["Hitos ordenados", "Fechas visibles", "PNG y PDF"],
  },
  {
    id: "flashcards",
    icon: "📇",
    label: "Flashcards",
    description: "Tarjetas frente y reverso para estudio, repaso y memorización.",
    color: "#06b6d4",
    category: "study",
    placeholder: "Ej: Fórmulas de química, vocabulario de inglés o capitales...",
    highlights: ["Tarjetas de estudio", "Pistas", "PDF y PNG"],
  },
  {
    id: "quiz",
    icon: "✅",
    label: "Quiz",
    description: "Preguntas con alternativas, respuesta correcta y retroalimentación.",
    color: "#22c55e",
    category: "study",
    placeholder: "Ej: Leyes de Newton, probabilidad o comprensión lectora...",
    highlights: ["Evaluación rápida", "Feedback", "PDF"],
  },
  {
    id: "cornell",
    icon: "📓",
    label: "Notas Cornell",
    description: "Apuntes organizados por ideas clave, notas principales y resumen final.",
    color: "#a78bfa",
    category: "study",
    placeholder: "Ej: Resume una unidad, una lectura o una clase completa...",
    highlights: ["Notas estructuradas", "Preguntas clave", "Resumen final"],
  },
  {
    id: "glossary",
    icon: "📖",
    label: "Glosario",
    description: "Definiciones claras de términos relevantes con ejemplos y contexto.",
    color: "#34d399",
    category: "study",
    placeholder: "Ej: Conceptos de genética, física, literatura o ciudadanía...",
    highlights: ["Términos clave", "Definiciones claras", "Ejemplos"],
  },
  {
    id: "podcast",
    icon: "🎙️",
    label: "Podcast",
    description: "Guion conversacional educativo con reproducción y generación de audio MP3.",
    color: "#f59e0b",
    category: "narrative",
    placeholder: "Ej: Los planetas del sistema solar, la célula o riesgos naturales...",
    highlights: ["Dos voces", "Escuchar", "MP3 y guion"],
  },
  {
    id: "story",
    icon: "📚",
    label: "Cuento educativo",
    description: "Historia con personajes y trama para explicar conceptos de forma cercana.",
    color: "#f87171",
    category: "narrative",
    placeholder: "Ej: Un viaje por el sistema digestivo o una aventura con fracciones...",
    highlights: ["Narrativa educativa", "Personajes", "Aprendizaje contextual"],
  },
  {
    id: "song",
    icon: "🎵",
    label: "Canción / rap",
    description: "Letra mnemónica para memorizar conceptos mediante ritmo y repetición.",
    color: "#fb923c",
    category: "narrative",
    placeholder: "Ej: Rap de la tabla periódica, fórmulas o reglas ortográficas...",
    highlights: ["Memorización", "Ritmo", "Letra educativa"],
  },
  {
    id: "lessonplan",
    icon: "🗒️",
    label: "Plan de clase",
    description: "Estructura pedagógica con objetivo, actividades, evaluación y recursos.",
    color: "#60a5fa",
    category: "planning",
    placeholder: "Ej: Clase de 90 minutos sobre reacciones químicas para 1° medio...",
    highlights: ["Objetivos", "Actividades", "Evaluación"],
  },
]

export const CREATOR_HUB_CATEGORIES: Array<{
  id: CreatorHubFormatCategory
  icon: string
  label: string
  description: string
}> = [
  { id: "visual", icon: "🖼️", label: "Materiales visuales", description: "Recursos para explicar, proyectar e imprimir." },
  { id: "study", icon: "📚", label: "Estudio y evaluación", description: "Materiales para practicar, repasar y verificar aprendizajes." },
  { id: "narrative", icon: "🎙️", label: "Narrativa y audio", description: "Formatos para enseñar con historias, diálogo y ritmo." },
  { id: "planning", icon: "🗒️", label: "Planificación", description: "Estructuras para organizar una experiencia de aprendizaje." },
]

export const CREATOR_HUB_CORE_TOOLS: CreatorHubTool[] = [
  {
    id: "notebook",
    href: "/creator-hub/notebook",
    icon: "📓",
    label: "Cuaderno EduAI",
    description: "Trabaja con documentos, fuentes, Chat Paper e investigación conectada.",
    color: "#2563eb",
    badge: "CENTRAL",
    features: ["Fuentes", "Chat Paper", "Studio conectado"],
  },
  {
    id: "materials",
    href: "/creator-hub/materials",
    icon: "✨",
    label: "Crear materiales",
    description: "Accede a todos los formatos de creación sin perder ninguna herramienta.",
    color: "#7c3aed",
    badge: "13 FORMATOS",
    features: ["Visuales", "Estudio", "Audio"],
  },
  {
    id: "comics",
    href: "/creator-hub/comics",
    icon: "💬",
    label: "Mangas e historietas",
    description: "Crea storyboards educativos editables y genera imágenes por viñeta.",
    color: "#db2777",
    badge: "BETA",
    features: ["Manga", "Webtoon", "Cómic escolar"],
  },
  {
    id: "labs",
    href: "/creator-hub/labs",
    icon: "🧪",
    label: "Labs multimedia",
    description: "Entra a audio, voces, imágenes, video, música y galería desde un solo lugar.",
    color: "#0d9488",
    badge: "MULTIMEDIA",
    features: ["Audio", "Imagen", "Video"],
  },
  {
    id: "share",
    href: "/creator-hub/share",
    icon: "◩",
    label: "Compartir con QR",
    description: "Comparte enlaces, textos y materiales mediante códigos QR descargables.",
    color: "#0891b2",
    badge: "QR STUDIO",
    features: ["PNG", "Vencimiento", "Contador"],
  },
]

export const CREATOR_HUB_LABS: CreatorHubTool[] = [
  {
    id: "audio-lab",
    href: "/audio-lab",
    icon: "🎙️",
    label: "Audio Lab",
    description: "Genera audio educativo, procesa contenido y crea narraciones.",
    color: "#f59e0b",
    features: ["Audio educativo", "Narración", "Procesamiento"],
  },
  {
    id: "audio-lab-large",
    href: "/audio-lab-large",
    icon: "🎚️",
    label: "Audio Lab Pro",
    description: "Trabaja con proyectos de audio extensos y flujos avanzados.",
    color: "#d97706",
    features: ["Audio extenso", "Carga avanzada", "Exportación"],
  },
  {
    id: "voice-profiles",
    href: "/audio-lab/voices",
    icon: "🗣️",
    label: "Perfiles de voz",
    description: "Administra voces personalizadas y configuraciones de locución.",
    color: "#eab308",
    features: ["Voces", "Perfiles", "Seguridad"],
  },
  {
    id: "image-studio",
    href: "/image-studio",
    icon: "🖼️",
    label: "Image Studio",
    description: "Genera imágenes para materiales, afiches, clases y proyectos.",
    color: "#ec4899",
    features: ["Imágenes IA", "Vista previa", "Materiales"],
  },
  {
    id: "video-studio",
    href: "/video-studio",
    icon: "🎬",
    label: "Video Studio",
    description: "Crea y procesa recursos audiovisuales educativos.",
    color: "#8b5cf6",
    features: ["Video IA", "Procesamiento", "Estado de trabajos"],
  },
  {
    id: "gallery",
    href: "/galeria",
    icon: "🗂️",
    label: "Galería",
    description: "Consulta recursos visuales generados y reutilízalos en nuevos proyectos.",
    color: "#06b6d4",
    features: ["Biblioteca", "Recursos", "Reutilización"],
  },
  {
    id: "music",
    href: "/music",
    icon: "🎧",
    label: "EduAI Music",
    description: "Accede al espacio musical integrado para acompañar el trabajo creativo.",
    color: "#f97316",
    features: ["Música", "Concentración", "Creatividad"],
  },
  {
    id: "classic",
    href: "/creator",
    icon: "✨",
    label: "Creator clásico",
    description: "Mantiene disponible el generador original como alternativa estable.",
    color: "#64748b",
    features: ["Modo clásico", "Compatibilidad", "Acceso directo"],
  },
]

export const CREATOR_HUB_NOTEBOOK_TOOLS: CreatorHubTool[] = [
  {
    id: "notebooks",
    href: "/notebooks",
    icon: "📓",
    label: "Notebook EduAI",
    description: "Sube fuentes, conversa con documentos y genera materiales desde evidencia.",
    color: "#2563eb",
    features: ["PDF y URL", "Chat RAG", "Studio"],
  },
  {
    id: "paper",
    href: "/paper",
    icon: "📄",
    label: "Chat Paper",
    description: "Analiza documentos académicos con un agente especializado.",
    color: "#7c3aed",
    features: ["Documentos", "Preguntas", "Análisis"],
  },
  {
    id: "researcher",
    href: "/investigador",
    icon: "🔎",
    label: "Investigador",
    description: "Busca y organiza información antes de crear un material educativo.",
    color: "#0d9488",
    features: ["Investigación", "Fuentes", "Síntesis"],
  },
]

export function getCreatorHubFormat(formatId: string) {
  return CREATOR_HUB_FORMATS.find((format) => format.id === formatId)
}

export function isCreatorHubFormat(formatId: string) {
  return Boolean(getCreatorHubFormat(formatId))
}
