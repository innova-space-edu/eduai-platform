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

export const SUBJECT_SUGGESTIONS = [
  "Matemática",
  "Lenguaje y Literatura",
  "Ciencias Naturales",
  "Física",
  "Química",
  "Biología",
  "Historia, Geografía y Ciencias Sociales",
  "Educación Ciudadana",
  "Tecnología",
  "Inglés",
  "Artes Visuales",
  "Música",
  "Educación Física y Salud",
  "Orientación",
  "Filosofía",
  "Religión",
] as const

export const LEVEL_SUGGESTIONS = [
  "Educación parvularia",
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
  "Educación superior",
  "Docentes",
  "Otro",
] as const

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
