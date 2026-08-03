export const REPOSITORY_BUCKET = "eduai-repository"
export const MAX_REPOSITORY_FILE_SIZE = 100 * 1024 * 1024

export const MATERIAL_TYPES = [
  { value: "guia", label: "Guía" },
  { value: "prueba", label: "Prueba" },
  { value: "rubrica", label: "Rúbrica" },
  { value: "presentacion", label: "Presentación" },
  { value: "planificacion", label: "Planificación" },
  { value: "actividad", label: "Actividad" },
  { value: "ejercicio", label: "Ejercicio" },
  { value: "imagen", label: "Imagen" },
  { value: "otro", label: "Otro" },
] as const

export const COURSE_OPTIONS = [
  "1° básico",
  "2° básico",
  "3° básico",
  "4° básico",
  "5° básico",
  "6° básico",
  "7° básico",
  "8° básico",
  "1° medio",
  "2° medio",
  "3° medio",
  "4° medio",
] as const

export type SubjectGroup = {
  label: string
  subjects: readonly string[]
}

const BASIC_1_TO_6_SUBJECT_GROUPS: readonly SubjectGroup[] = [
  {
    label: "Formación general",
    subjects: [
      "Lenguaje y Comunicación",
      "Matemática",
      "Ciencias Naturales",
      "Historia, Geografía y Ciencias Sociales",
      "Inglés",
      "Educación Física y Salud",
      "Artes Visuales",
      "Música",
      "Tecnología",
      "Orientación",
      "Religión",
    ],
  },
  {
    label: "Complementarias y talleres",
    subjects: [
      "Biblioteca y Plan Lector",
      "Taller de Lectura y Escritura",
      "Taller de Matemática",
      "Computación y Programación",
      "Robótica",
      "Educación Socioemocional",
      "Convivencia Escolar",
      "Formación Ciudadana",
      "Medioambiente y Sustentabilidad",
      "Vida Saludable",
      "Otro taller complementario",
    ],
  },
]

const BASIC_7_TO_8_SUBJECT_GROUPS: readonly SubjectGroup[] = [
  {
    label: "Formación general",
    subjects: [
      "Lengua y Literatura",
      "Matemática",
      "Ciencias Naturales",
      "Historia, Geografía y Ciencias Sociales",
      "Inglés",
      "Educación Física y Salud",
      "Artes Visuales",
      "Música",
      "Tecnología",
      "Orientación",
      "Religión",
    ],
  },
  {
    label: "Complementarias y talleres",
    subjects: [
      "Biblioteca y Plan Lector",
      "Taller de Lectura y Escritura",
      "Taller de Matemática",
      "Computación y Programación",
      "Robótica",
      "Educación Socioemocional",
      "Convivencia Escolar",
      "Formación Ciudadana",
      "Medioambiente y Sustentabilidad",
      "Emprendimiento",
      "Vida Saludable",
      "Otro taller complementario",
    ],
  },
]

const MIDDLE_1_TO_2_SUBJECT_GROUPS: readonly SubjectGroup[] = [
  {
    label: "Formación general",
    subjects: [
      "Lengua y Literatura",
      "Matemática",
      "Inglés",
      "Historia, Geografía y Ciencias Sociales",
      "Biología",
      "Física",
      "Química",
      "Educación Física y Salud",
      "Tecnología",
      "Artes Visuales",
      "Música",
      "Orientación",
      "Religión",
    ],
  },
  {
    label: "Complementarias y talleres",
    subjects: [
      "Ciencias Naturales",
      "Formación Ciudadana",
      "Computación y Programación",
      "Robótica",
      "Taller de Lectura y Escritura",
      "Taller de Matemática",
      "Taller PAES",
      "Educación Socioemocional",
      "Convivencia Escolar",
      "Medioambiente y Sustentabilidad",
      "Emprendimiento",
      "Vida Saludable",
      "Otro taller complementario",
    ],
  },
]

const MIDDLE_3_TO_4_SUBJECT_GROUPS: readonly SubjectGroup[] = [
  {
    label: "Plan común de formación general",
    subjects: [
      "Lengua y Literatura",
      "Matemática",
      "Inglés",
      "Educación Ciudadana",
      "Filosofía",
      "Ciencias para la Ciudadanía",
      "Educación Física y Salud",
      "Orientación",
      "Religión",
      "Artes Visuales",
      "Música",
      "Tecnología",
    ],
  },
  {
    label: "Complementarias y preparación académica",
    subjects: [
      "Historia, Geografía y Ciencias Sociales",
      "Biología",
      "Física",
      "Química",
      "Taller PAES Competencia Lectora",
      "Taller PAES Matemática M1",
      "Taller PAES Matemática M2",
      "Taller PAES Ciencias",
      "Taller PAES Historia y Ciencias Sociales",
      "Computación y Programación",
      "Robótica",
      "Educación Socioemocional",
      "Convivencia Escolar",
      "Medioambiente y Sustentabilidad",
      "Emprendimiento",
      "Otro taller complementario",
    ],
  },
  {
    label: "Electivos · Lengua, Filosofía e Historia",
    subjects: [
      "Taller de Literatura",
      "Lectura y Escritura Especializadas",
      "Participación y Argumentación en Democracia",
      "Estética",
      "Filosofía Política",
      "Seminario de Filosofía",
      "Comprensión Histórica del Presente",
      "Geografía, Territorio y Desafíos Socioambientales",
      "Economía y Sociedad",
    ],
  },
  {
    label: "Electivos · Matemática y Ciencias",
    subjects: [
      "Límites, Derivadas e Integrales",
      "Probabilidades y Estadística Descriptiva e Inferencial",
      "Geometría 3D",
      "Biología de los Ecosistemas",
      "Biología Celular y Molecular",
      "Ciencias de la Salud",
      "Física · Electivo de profundización",
      "Química · Electivo de profundización",
    ],
  },
  {
    label: "Electivos · Artes y Educación Física",
    subjects: [
      "Artes Visuales, Audiovisuales y Multimediales",
      "Diseño y Arquitectura",
      "Interpretación y Creación en Teatro",
      "Creación y Composición Musical",
      "Interpretación Musical",
      "Ciencias del Ejercicio Físico y Deportivo",
      "Promoción de Estilos de Vida Activos y Saludables",
    ],
  },
  {
    label: "Formación técnico-profesional y especialidades",
    subjects: [
      "Administración",
      "Contabilidad",
      "Programación",
      "Conectividad y Redes",
      "Electricidad",
      "Electrónica",
      "Mecánica Automotriz",
      "Construcción",
      "Refrigeración y Climatización",
      "Gastronomía",
      "Atención de Párvulos",
      "Atención de Enfermería",
      "Agropecuaria",
      "Turismo",
      "Servicios de Hotelería",
      "Gráfica",
      "Química Industrial",
      "Explotación Minera",
      "Metalurgia Extractiva",
      "Otro módulo o especialidad TP",
    ],
  },
]

const BASIC_1_TO_6 = new Set<string>([
  "1° básico",
  "2° básico",
  "3° básico",
  "4° básico",
  "5° básico",
  "6° básico",
])

const BASIC_7_TO_8 = new Set<string>(["7° básico", "8° básico"])
const MIDDLE_1_TO_2 = new Set<string>(["1° medio", "2° medio"])
const MIDDLE_3_TO_4 = new Set<string>(["3° medio", "4° medio"])

export function subjectGroupsForCourse(course: string): readonly SubjectGroup[] {
  if (BASIC_1_TO_6.has(course)) return BASIC_1_TO_6_SUBJECT_GROUPS
  if (BASIC_7_TO_8.has(course)) return BASIC_7_TO_8_SUBJECT_GROUPS
  if (MIDDLE_1_TO_2.has(course)) return MIDDLE_1_TO_2_SUBJECT_GROUPS
  if (MIDDLE_3_TO_4.has(course)) return MIDDLE_3_TO_4_SUBJECT_GROUPS
  return []
}

export const LEVEL_SUGGESTIONS = COURSE_OPTIONS

export const SUBJECT_SUGGESTIONS = Array.from(
  new Set(
    [
      ...BASIC_1_TO_6_SUBJECT_GROUPS,
      ...BASIC_7_TO_8_SUBJECT_GROUPS,
      ...MIDDLE_1_TO_2_SUBJECT_GROUPS,
      ...MIDDLE_3_TO_4_SUBJECT_GROUPS,
    ].flatMap((group) => group.subjects),
  ),
)

export type MaterialType = (typeof MATERIAL_TYPES)[number]["value"]
export type RepositorySourceType = "file" | "youtube"

export type RepositoryItem = {
  id: string
  title: string
  subject: string
  educational_level: string
  school_year: number
  material_type: MaterialType
  question_count: number
  source_type: RepositorySourceType
  storage_path: string | null
  original_file_name: string | null
  mime_type: string | null
  file_size: number | null
  youtube_url: string | null
  youtube_video_id: string | null
  visibility: "public"
  metadata: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export type RepositoryFormValues = {
  title: string
  subject: string
  educationalLevel: string
  year: string
  materialType: MaterialType
  questionCount: string
}

export type PreviewKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "office"
  | "text"
  | "youtube"
  | "download"

const OFFICE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
])

const OFFICE_EXTENSIONS = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
])

const TEXT_EXTENSIONS = new Set(["txt", "csv", "md", "json", "xml", "html", "htm", "log"])

export function materialTypeLabel(value: MaterialType | string) {
  return MATERIAL_TYPES.find((item) => item.value === value)?.label || "Otro"
}

export function getFileExtension(fileName?: string | null) {
  if (!fileName) return ""
  const parts = fileName.toLowerCase().split(".")
  return parts.length > 1 ? parts.at(-1) || "" : ""
}

export function getPreviewKind(item: RepositoryItem): PreviewKind {
  if (item.source_type === "youtube") return "youtube"

  const mime = item.mime_type?.toLowerCase() || ""
  const extension = getFileExtension(item.original_file_name)

  if (mime === "application/pdf" || extension === "pdf") return "pdf"
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(extension)) return "image"
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v", "ogv"].includes(extension)) return "video"
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(extension)) return "audio"
  if (OFFICE_MIME_TYPES.has(mime) || OFFICE_EXTENSIONS.has(extension)) return "office"
  if (mime.startsWith("text/") || mime.includes("json") || mime.includes("xml") || TEXT_EXTENSIONS.has(extension)) return "text"
  return "download"
}

export function normalizeStorageName(fileName: string) {
  const extension = getFileExtension(fileName)
  const stem = extension ? fileName.slice(0, -(extension.length + 1)) : fileName
  const normalizedStem = stem
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "archivo"

  return extension ? `${normalizedStem}.${extension.replace(/[^a-z0-9]/g, "")}` : normalizedStem
}

export function parseYouTubeVideoId(value: string) {
  const raw = value.trim()
  if (!raw) return null

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "")
    let candidate = ""

    if (hostname === "youtu.be") {
      candidate = url.pathname.split("/").filter(Boolean)[0] || ""
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      candidate = url.searchParams.get("v") || ""
      if (!candidate) {
        const parts = url.pathname.split("/").filter(Boolean)
        const markerIndex = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part))
        candidate = markerIndex >= 0 ? parts[markerIndex + 1] || "" : ""
      }
    }

    const clean = candidate.split(/[?&#/]/)[0]
    return /^[a-zA-Z0-9_-]{11}$/.test(clean) ? clean : null
  } catch {
    return /^[a-zA-Z0-9_-]{11}$/.test(raw) ? raw : null
  }
}

export function formatBytes(value?: number | null) {
  if (!value || value <= 0) return "Tamaño no disponible"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}
