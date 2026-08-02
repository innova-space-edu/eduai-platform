export type LibraryAccessMode = "eduai" | "borrow" | "openlibrary" | "external" | "preview"

export type LibraryBook = {
  id: string
  title: string
  author: string
  year: string
  language: string
  category: string
  source: string
  rights: string
  cover: string
  description: string
  accessMode: LibraryAccessMode
  sourceUrl: string
  workKey?: string
  editionKey?: string
  isbn?: string
  iaId?: string
  subjects?: string[]
  content?: string
}

export type ReadingProgress = {
  book: LibraryBook
  page: number
  totalPages: number
  updatedAt: string
}

export type LibrarySource = {
  id: string
  name: string
  description: string
  access: string
  url: string
  accent: string
  verified: boolean
}

export type LibraryCollection = {
  id: string
  label: string
  description: string
  query?: string
  sort?: "new" | "old" | "random" | "editions"
  local?: "favorites" | "reading"
}

type OpenLibraryAvailability = {
  status?: string
  identifier?: string
  is_readable?: boolean
  is_lendable?: boolean
  available_to_browse?: boolean
  available_to_borrow?: boolean
}

type OpenLibraryDocument = {
  key?: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  ia?: string[]
  public_scan_b?: boolean
  has_fulltext?: boolean
  ebook_access?: string
  availability?: OpenLibraryAvailability
  language?: string[]
  edition_key?: string[]
  isbn?: string[]
  subject?: string[]
}

type OpenLibraryResponse = {
  numFound?: number
  num_found?: number
  docs?: OpenLibraryDocument[]
}

export const LIBRARY_COLLECTIONS: LibraryCollection[] = [
  {
    id: "latest",
    label: "Novedades",
    description: "Registros recientes y nuevas ediciones en español",
    query: "language:spa",
    sort: "new",
  },
  {
    id: "open",
    label: "Lectura completa",
    description: "Libros con escaneo público y texto disponible",
    query: "language:spa public_scan_b:true",
    sort: "editions",
  },
  {
    id: "borrow",
    label: "Préstamo digital",
    description: "Títulos que pueden solicitarse legalmente en línea",
    query: "language:spa ebook_access:borrowable",
    sort: "new",
  },
  {
    id: "reading",
    label: "Continuar leyendo",
    description: "Libros que ya comenzaste",
    local: "reading",
  },
  {
    id: "favorites",
    label: "Favoritos",
    description: "Tu colección personal",
    local: "favorites",
  },
  {
    id: "fiction",
    label: "Novelas y cuentos",
    description: "Narrativa clásica y contemporánea",
    query: "language:spa (subject:fiction OR subject:novela OR subject:cuentos)",
    sort: "editions",
  },
  {
    id: "poetry",
    label: "Poesía",
    description: "Poesía en español y traducciones",
    query: "language:spa (subject:poetry OR subject:poesía)",
    sort: "editions",
  },
  {
    id: "science",
    label: "Ciencia y tecnología",
    description: "Divulgación, ciencias y tecnología",
    query: "language:spa (subject:science OR subject:technology OR subject:ciencia)",
    sort: "new",
  },
  {
    id: "history",
    label: "Historia y sociedad",
    description: "Historia, ciudadanía y ciencias sociales",
    query: "language:spa (subject:history OR subject:social_sciences OR subject:historia)",
    sort: "new",
  },
  {
    id: "children",
    label: "Infantil y juvenil",
    description: "Lecturas para estudiantes y jóvenes",
    query: "language:spa (subject:juvenile_literature OR subject:children OR subject:infantil)",
    sort: "editions",
  },
]

export const LIBRARY_SOURCES: LibrarySource[] = [
  {
    id: "openlibrary",
    name: "Open Library",
    description: "Catálogo mundial con lectura abierta, préstamos y ediciones digitalizadas.",
    access: "Integrado en EDUAI",
    url: "https://openlibrary.org/?lang=es",
    accent: "from-blue-600 to-cyan-500",
    verified: true,
  },
  {
    id: "bpdigital",
    name: "BPDigital Chile",
    description: "Libros y audiolibros actuales mediante préstamo gratuito con RUT chileno.",
    access: "Préstamo oficial",
    url: "https://www.bpdigital.cl/",
    accent: "from-emerald-600 to-teal-500",
    verified: true,
  },
  {
    id: "booknet",
    name: "Booknet",
    description: "Literatura contemporánea, autores emergentes y obras publicadas por capítulos.",
    access: "Gratis y de pago",
    url: "https://booknet.com/es/",
    accent: "from-violet-600 to-fuchsia-500",
    verified: true,
  },
  {
    id: "librototal",
    name: "El Libro Total",
    description: "Clásicos, literatura hispanoamericana, audiolecturas y obras completas.",
    access: "Lectura online",
    url: "https://www.ellibrototal.com/ltotal/",
    accent: "from-amber-600 to-orange-500",
    verified: true,
  },
  {
    id: "casadellibro",
    name: "Casa del Libro",
    description: "Novedades editoriales, muestras autorizadas y compra de libros electrónicos.",
    access: "Vista previa y compra",
    url: "https://www.casadellibro.com/ebook-la-gran-nevada-ebook/9788403519107/6060517",
    accent: "from-rose-600 to-red-500",
    verified: true,
  },
  {
    id: "gutenberg",
    name: "Project Gutenberg",
    description: "Miles de obras de dominio público en EPUB, HTML y texto completo.",
    access: "Lectura abierta",
    url: "https://www.gutenberg.org/browse/languages/es",
    accent: "from-slate-700 to-slate-500",
    verified: true,
  },
]

export function libraryStorageKeys(userId: string) {
  return {
    favorites: `eduai-library:${userId}:favorite-books`,
    progress: `eduai-library:${userId}:reading-progress`,
    notes: (bookId: string) => `eduai-library:${userId}:notes:${bookId}`,
    highlights: (bookId: string) => `eduai-library:${userId}:highlights:${bookId}`,
  }
}

function deriveCategory(subjects: string[] = []) {
  const normalized = subjects.join(" ").toLowerCase()
  if (normalized.includes("poetry") || normalized.includes("poesía")) return "Poesía"
  if (normalized.includes("science") || normalized.includes("ciencia") || normalized.includes("technology")) return "Ciencia"
  if (normalized.includes("history") || normalized.includes("historia")) return "Historia"
  if (normalized.includes("juvenile") || normalized.includes("children") || normalized.includes("infantil")) return "Infantil y juvenil"
  if (normalized.includes("drama") || normalized.includes("theater") || normalized.includes("teatro")) return "Teatro"
  if (normalized.includes("short stories") || normalized.includes("cuentos")) return "Cuentos"
  return "Literatura"
}

function normalizeWorkKey(key?: string) {
  if (!key) return ""
  return key.startsWith("/") ? key : `/${key}`
}

export function mapOpenLibraryBook(doc: OpenLibraryDocument): LibraryBook | null {
  if (!doc.title || !doc.key) return null

  const workKey = normalizeWorkKey(doc.key)
  const availabilityStatus = String(doc.availability?.status || "").toLowerCase()
  const iaId = doc.availability?.identifier || doc.ia?.[0]
  const isPublic = Boolean(
    doc.public_scan_b ||
      doc.ebook_access === "public" ||
      availabilityStatus === "open" ||
      doc.availability?.is_readable ||
      doc.availability?.available_to_browse,
  )
  const isBorrowable = Boolean(
    !isPublic &&
      (doc.ebook_access === "borrowable" ||
        availabilityStatus.includes("borrow") ||
        availabilityStatus === "lendable" ||
        doc.availability?.is_lendable ||
        doc.availability?.available_to_borrow),
  )

  const accessMode: LibraryAccessMode = isPublic && iaId ? "eduai" : isBorrowable ? "borrow" : "openlibrary"
  const subjects = (doc.subject || []).slice(0, 8)
  const cover = doc.cover_i
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    : "https://openlibrary.org/images/icons/avatar_book-sm.png"

  return {
    id: workKey.replace(/^\//, "").replaceAll("/", "-"),
    title: doc.title,
    author: doc.author_name?.slice(0, 2).join(", ") || "Autor no identificado",
    year: doc.first_publish_year ? String(doc.first_publish_year) : "Fecha no indicada",
    language: doc.language?.includes("spa") ? "Español" : "Edición multilingüe",
    category: deriveCategory(subjects),
    source: "Open Library",
    rights: accessMode === "eduai" ? "Lectura completa" : accessMode === "borrow" ? "Préstamo digital" : "Ver disponibilidad",
    cover,
    description:
      subjects.length > 0
        ? `Temas: ${subjects.slice(0, 4).join(", ")}. Consulta la edición y su disponibilidad en línea.`
        : "Consulta la ficha, las ediciones y las opciones legales de lectura disponibles.",
    accessMode,
    sourceUrl: `https://openlibrary.org${workKey}`,
    workKey,
    editionKey: doc.edition_key?.[0],
    isbn: doc.isbn?.[0],
    iaId,
    subjects,
  }
}

export function buildOpenLibrarySearchUrl(options: {
  collection: LibraryCollection
  search?: string
  page?: number
  limit?: number
}) {
  const { collection, search = "", page = 1, limit = 30 } = options
  const params = new URLSearchParams()
  const cleanSearch = search.trim()
  const query = cleanSearch ? `${cleanSearch} language:spa` : collection.query || "language:spa"

  params.set("q", query)
  params.set("lang", "es")
  params.set("page", String(page))
  params.set("limit", String(limit))
  params.set("sort", collection.sort || "editions")
  params.set(
    "fields",
    [
      "key",
      "title",
      "author_name",
      "first_publish_year",
      "cover_i",
      "ia",
      "public_scan_b",
      "has_fulltext",
      "ebook_access",
      "availability",
      "language",
      "edition_key",
      "isbn",
      "subject",
    ].join(","),
  )

  return `https://openlibrary.org/search.json?${params.toString()}`
}

export async function searchOpenLibrary(options: {
  collection: LibraryCollection
  search?: string
  page?: number
  signal?: AbortSignal
}) {
  const url = buildOpenLibrarySearchUrl(options)
  const response = await fetch(url, {
    signal: options.signal,
    headers: { Accept: "application/json" },
  })

  if (!response.ok) throw new Error("Open Library no respondió correctamente")
  const data = (await response.json()) as OpenLibraryResponse
  const books = (data.docs || []).map(mapOpenLibraryBook).filter((book): book is LibraryBook => Boolean(book))

  return {
    books,
    total: data.numFound ?? data.num_found ?? books.length,
  }
}

function archiveFileUrl(identifier: string, name: string) {
  const safeName = name
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${safeName}`
}

export async function loadArchiveFullText(identifier: string, signal?: AbortSignal) {
  const metadataResponse = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
    signal,
    headers: { Accept: "application/json" },
  })
  if (!metadataResponse.ok) throw new Error("No se pudo obtener la edición digital")

  const metadata = (await metadataResponse.json()) as {
    files?: Array<{ name?: string; format?: string; size?: string }>
  }
  const files = metadata.files || []
  const candidates = files
    .filter((file) => {
      const name = file.name || ""
      const format = (file.format || "").toLowerCase()
      return (
        format === "djvutxt" ||
        name.endsWith("_djvu.txt") ||
        (name.endsWith(".txt") && !name.endsWith("_meta.txt") && !name.includes("_searchtext"))
      )
    })
    .sort((a, b) => {
      const score = (file: { name?: string; format?: string }) => {
        if ((file.format || "").toLowerCase() === "djvutxt") return 0
        if ((file.name || "").endsWith("_djvu.txt")) return 1
        return 2
      }
      return score(a) - score(b)
    })

  const selected = candidates[0]
  if (!selected?.name) throw new Error("Esta edición no dispone de texto seleccionable")

  const textResponse = await fetch(archiveFileUrl(identifier, selected.name), { signal })
  if (!textResponse.ok) throw new Error("No se pudo cargar el texto completo")
  const text = (await textResponse.text())
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim()

  if (text.length < 500) throw new Error("El texto disponible es demasiado breve")
  return text
}

export function paginateBookText(text: string, targetCharacters = 9000) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  const pages: string[] = []
  let current: string[] = []
  let currentLength = 0

  const pushCurrent = () => {
    if (current.length === 0) return
    pages.push(current.join("\n\n"))
    current = []
    currentLength = 0
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > targetCharacters * 1.5) {
      pushCurrent()
      for (let index = 0; index < paragraph.length; index += targetCharacters) {
        pages.push(paragraph.slice(index, index + targetCharacters))
      }
      continue
    }

    if (currentLength + paragraph.length > targetCharacters && current.length > 0) pushCurrent()
    current.push(paragraph)
    currentLength += paragraph.length
  }

  pushCurrent()
  return pages.length > 0 ? pages : [text]
}
