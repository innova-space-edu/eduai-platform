"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  BookText,
  Bookmark,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Expand,
  Heart,
  Highlighter,
  LibraryBig,
  Maximize2,
  MessageCircle,
  Minus,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Send,
  Sparkles,
  StickyNote,
  Sun,
  Trash2,
  Volume2,
  X,
  Zap,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Book = {
  id: string
  title: string
  author: string
  year: string
  language: string
  category: string
  level: string
  source: string
  rights: string
  cover: string
  description: string
  content: string[]
}

type ReaderNote = {
  id: string
  quote: string
  text: string
  createdAt: string
}

type ReaderTheme = "paper" | "sepia" | "night"
type SideTab = "ai" | "notes"

const BOOKS: Book[] = [
  {
    id: "don-quijote",
    title: "Don Quijote de la Mancha",
    author: "Miguel de Cervantes",
    year: "1605",
    language: "Español",
    category: "Novela",
    level: "Enseñanza media",
    source: "Dominio público",
    rights: "Lectura abierta",
    cover: "https://covers.openlibrary.org/b/title/Don%20Quijote%20de%20la%20Mancha-L.jpg",
    description: "Una de las obras fundamentales de la literatura en español. Sigue las aventuras de un hidalgo que decide convertirse en caballero andante.",
    content: [
      "En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.",
      "Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lentejas los viernes y algún palomino de añadidura los domingos consumían las tres partes de su hacienda.",
      "Es, pues, de saber que este sobredicho hidalgo, los ratos que estaba ocioso —que eran los más del año—, se daba a leer libros de caballerías con tanta afición y gusto, que olvidó casi de todo punto el ejercicio de la caza y aun la administración de su hacienda.",
      "Llenósele la fantasía de todo aquello que leía en los libros, así de encantamientos como de pendencias, batallas, desafíos, heridas, requiebros, amores, tormentas y disparates imposibles.",
      "Y asentósele de tal modo en la imaginación que era verdad toda aquella máquina de aquellas soñadas invenciones que leía, que para él no había otra historia más cierta en el mundo.",
    ],
  },
  {
    id: "lazarillo",
    title: "Lazarillo de Tormes",
    author: "Anónimo",
    year: "1554",
    language: "Español",
    category: "Novela",
    level: "Enseñanza media",
    source: "Dominio público",
    rights: "Lectura abierta",
    cover: "https://covers.openlibrary.org/b/title/Lazarillo%20de%20Tormes-L.jpg",
    description: "Relato picaresco en primera persona sobre la supervivencia, la pobreza y las contradicciones sociales de su época.",
    content: [
      "Pues sepa vuestra merced, ante todas cosas, que a mí llaman Lázaro de Tormes, hijo de Tomé González y de Antona Pérez, naturales de Tejares, aldea de Salamanca.",
      "Mi nacimiento fue dentro del río Tormes, por la cual causa tomé el sobrenombre; y fue de esta manera: mi padre, que Dios perdone, tenía cargo de proveer una molienda de una aceña que está ribera de aquel río.",
      "Siendo yo niño de ocho años, achacaron a mi padre ciertas sangrías mal hechas en los costales de los que allí a moler venían, por lo cual fue preso, y confesó y no negó, y padeció persecución por justicia.",
      "En este tiempo vino a posar al mesón un ciego, el cual, pareciéndole que yo sería para adestrarle, me pidió a mi madre, y ella me encomendó a él.",
    ],
  },
  {
    id: "vida-sueno",
    title: "La vida es sueño",
    author: "Pedro Calderón de la Barca",
    year: "1635",
    language: "Español",
    category: "Teatro",
    level: "Enseñanza media",
    source: "Dominio público",
    rights: "Lectura abierta",
    cover: "https://covers.openlibrary.org/b/title/La%20vida%20es%20sueno-L.jpg",
    description: "Drama filosófico sobre la libertad, el destino, la identidad y los límites entre la realidad y el sueño.",
    content: [
      "Sueña el rey que es rey, y vive con este engaño mandando, disponiendo y gobernando; y este aplauso, que recibe prestado, en el viento escribe, y en cenizas le convierte la muerte.",
      "Sueña el rico en su riqueza, que más cuidados le ofrece; sueña el pobre que padece su miseria y su pobreza; sueña el que a medrar empieza, sueña el que afana y pretende.",
      "Yo sueño que estoy aquí, de estas prisiones cargado; y soñé que en otro estado más lisonjero me vi.",
      "¿Qué es la vida? Un frenesí. ¿Qué es la vida? Una ilusión, una sombra, una ficción; y el mayor bien es pequeño; que toda la vida es sueño, y los sueños, sueños son.",
    ],
  },
  {
    id: "rimas-leyendas",
    title: "Rimas y leyendas",
    author: "Gustavo Adolfo Bécquer",
    year: "1871",
    language: "Español",
    category: "Poesía",
    level: "Enseñanza media",
    source: "Dominio público",
    rights: "Lectura abierta",
    cover: "https://covers.openlibrary.org/b/title/Rimas%20y%20leyendas-L.jpg",
    description: "Colección poética y narrativa que explora el amor, el misterio, la creación artística y la memoria.",
    content: [
      "Yo sé un himno gigante y extraño que anuncia en la noche del alma una aurora, y estas páginas son de ese himno cadencias que el aire dilata en las sombras.",
      "Yo quisiera escribirle, del hombre domando el rebelde, mezquino idioma, con palabras que fuesen a un tiempo suspiros y risas, colores y notas.",
      "Pero en vano es luchar; que no hay cifra capaz de encerrarle, y apenas, ¡oh hermosa!, si teniendo en mis manos las tuyas pudiera, al oído, cantártelo a solas.",
    ],
  },
  {
    id: "azul",
    title: "Azul...",
    author: "Rubén Darío",
    year: "1888",
    language: "Español",
    category: "Cuentos y poesía",
    level: "Enseñanza media",
    source: "Dominio público",
    rights: "Lectura abierta",
    cover: "https://covers.openlibrary.org/b/title/Azul%20Ruben%20Dario-L.jpg",
    description: "Obra clave del modernismo hispanoamericano, formada por cuentos y poemas de intensa musicalidad e imaginación.",
    content: [
      "Había en una ciudad inmensa y brillante un rey poderoso, que tenía trajes caprichosos y ricos, esclavas desnudas, blancas y negras, caballos de largas crines, armas flamantísimas y galgos rápidos.",
      "¿Era un rey poeta? No, amigo mío: era el Rey Burgués. Tenía un palacio soberbio donde había acumulado riquezas y objetos de arte maravillosos.",
      "Japonerías y chinerías por lujo; grandes salones llenos de cuadros, estatuas y cosas bellas; jardines poblados de cisnes y de flores.",
    ],
  },
  {
    id: "cuentos-amor-locura-muerte",
    title: "Cuentos de amor, de locura y de muerte",
    author: "Horacio Quiroga",
    year: "1917",
    language: "Español",
    category: "Cuentos",
    level: "Enseñanza media",
    source: "Dominio público",
    rights: "Lectura abierta",
    cover: "https://covers.openlibrary.org/b/title/Cuentos%20de%20amor%20de%20locura%20y%20de%20muerte-L.jpg",
    description: "Cuentos intensos sobre la naturaleza, el amor, la enfermedad, el peligro y la fragilidad humana.",
    content: [
      "Su luna de miel fue un largo escalofrío. Rubia, angelical y tímida, el carácter duro de su marido heló sus soñadas niñerías de novia.",
      "Ella lo quería mucho, sin embargo, a veces con un ligero estremecimiento cuando, volviendo de noche juntos por la calle, echaba una furtiva mirada a la alta estatura de Jordán, mudo desde hacía una hora.",
      "La casa en que vivían influía no poco en sus estremecimientos. La blancura del patio silencioso —frisos, columnas y estatuas de mármol— producía una otoñal impresión de palacio encantado.",
    ],
  },
  {
    id: "maria",
    title: "María",
    author: "Jorge Isaacs",
    year: "1867",
    language: "Español",
    category: "Novela",
    level: "Enseñanza media",
    source: "Dominio público",
    rights: "Lectura abierta",
    cover: "https://covers.openlibrary.org/b/title/Maria%20Jorge%20Isaacs-L.jpg",
    description: "Novela romántica hispanoamericana ambientada en el paisaje del Valle del Cauca.",
    content: [
      "Era yo niño aún cuando me alejaron de la casa paterna para que diera principio a mis estudios en el colegio del doctor Lorenzo María Lleras, establecido en Bogotá hacía pocos años.",
      "En la noche víspera de mi viaje, después de la velada, entró a mi cuarto una de mis hermanas y, sin decirme una sola palabra cariñosa, porque los sollozos le embargaban la voz, cortó de mi cabeza unos cabellos.",
      "Me dormí llorando y experimenté como un vago presentimiento de muchos pesares que debía sufrir después.",
    ],
  },
  {
    id: "frankenstein",
    title: "Frankenstein",
    author: "Mary Shelley",
    year: "1818",
    language: "Español / inglés",
    category: "Ciencia ficción",
    level: "Enseñanza media",
    source: "Dominio público",
    rights: "Lectura abierta",
    cover: "https://covers.openlibrary.org/b/title/Frankenstein-L.jpg",
    description: "Novela sobre ciencia, responsabilidad, identidad, rechazo y los límites de la ambición humana.",
    content: [
      "Aprende de mí, ya que no por mis preceptos, al menos por mi ejemplo, cuán peligrosa es la adquisición del conocimiento y cuánto más feliz es aquel que cree que su pueblo natal es el mundo.",
      "La vida y la muerte me parecían límites ideales que yo sería el primero en romper, derramando un torrente de luz sobre nuestro mundo oscuro.",
      "Una nueva especie me bendeciría como su creador y fuente; muchas naturalezas felices y excelentes me deberían su existencia.",
    ],
  },
  {
    id: "dracula",
    title: "Drácula",
    author: "Bram Stoker",
    year: "1897",
    language: "Español / inglés",
    category: "Terror",
    level: "Enseñanza media",
    source: "Dominio público",
    rights: "Lectura abierta",
    cover: "https://covers.openlibrary.org/b/title/Dracula-L.jpg",
    description: "Clásico de terror narrado mediante diarios, cartas y documentos sobre el encuentro con el conde Drácula.",
    content: [
      "Debo de haber estado dormido, porque ciertamente, de haber estado completamente despierto, habría advertido la proximidad de un lugar tan notable.",
      "En la oscuridad, el patio parecía de considerable tamaño, y como varias galerías oscuras partían de él bajo grandes arcos redondos, quizá pareciera mayor de lo que realmente era.",
      "Cuando el coche se detuvo, el cochero saltó y me tendió la mano para ayudarme a bajar. Su fuerza debía de ser prodigiosa.",
    ],
  },
  {
    id: "principito-demo",
    title: "El viaje del pequeño explorador",
    author: "Colección EDUAI",
    year: "Lectura demostrativa",
    language: "Español",
    category: "Lectura breve",
    level: "Todos los niveles",
    source: "Contenido educativo EDUAI",
    rights: "Vista previa",
    cover: "https://covers.openlibrary.org/b/title/The%20Little%20Prince-L.jpg",
    description: "Texto demostrativo creado para probar el visor, las notas, el resaltado y el asistente de lectura.",
    content: [
      "El pequeño explorador observó el cielo durante varias noches. No buscaba una respuesta rápida, sino una pregunta que mereciera ser compartida.",
      "En su cuaderno dibujó estrellas, rutas y símbolos. Cada marca era una forma de recordar que aprender también significa detenerse, mirar y volver a preguntar.",
      "Cuando llegó a la biblioteca, descubrió que los libros no eran puertas cerradas. Eran conversaciones que podían continuar con nuevas notas, nuevas voces y nuevas interpretaciones.",
    ],
  },
]

const COLLECTIONS = [
  "Todos los libros",
  "Continuar leyendo",
  "Favoritos",
  "Novela",
  "Cuentos",
  "Poesía",
  "Teatro",
  "Ciencia ficción",
  "Terror",
  "Lectura breve",
]

const QUICK_AI_ACTIONS = [
  "Resume este fragmento",
  "Explica las palabras difíciles",
  "Identifica las ideas principales",
  "Crea 5 preguntas de comprensión",
]

const READER_THEME: Record<ReaderTheme, { background: string; color: string; surface: string }> = {
  paper: { background: "#ffffff", color: "#1f2937", surface: "#f8fafc" },
  sepia: { background: "#f6eddc", color: "#4a3728", surface: "#efe2cb" },
  night: { background: "#111827", color: "#e5e7eb", surface: "#1f2937" },
}

function noteStorageKey(bookId: string) {
  return `eduai-library-notes:${bookId}`
}

function highlightStorageKey(bookId: string) {
  return `eduai-library-highlights:${bookId}`
}

function favoriteStorageKey() {
  return "eduai-library-favorites"
}

function renderHighlightedText(text: string, highlights: string[]) {
  let chunks: Array<{ value: string; marked: boolean }> = [{ value: text, marked: false }]

  for (const highlight of highlights.filter((item) => item.trim().length >= 3)) {
    chunks = chunks.flatMap((chunk) => {
      if (chunk.marked) return [chunk]
      const index = chunk.value.indexOf(highlight)
      if (index < 0) return [chunk]
      return [
        { value: chunk.value.slice(0, index), marked: false },
        { value: highlight, marked: true },
        { value: chunk.value.slice(index + highlight.length), marked: false },
      ].filter((item) => item.value.length > 0)
    })
  }

  return chunks.map((chunk, index) =>
    chunk.marked ? (
      <mark key={`${chunk.value}-${index}`} className="rounded px-0.5" style={{ background: "#fde68a", color: "#422006" }}>
        {chunk.value}
      </mark>
    ) : (
      <span key={`${chunk.value}-${index}`}>{chunk.value}</span>
    ),
  )
}

export default function BibliotecaPage() {
  const router = useRouter()
  const supabase = createClient()
  const readerRef = useRef<HTMLDivElement | null>(null)

  const [displayName, setDisplayName] = useState("Usuario")
  const [search, setSearch] = useState("")
  const [activeCollection, setActiveCollection] = useState("Todos los libros")
  const [activeBook, setActiveBook] = useState<Book | null>(null)
  const [fontSize, setFontSize] = useState(19)
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>("paper")
  const [selectedQuote, setSelectedQuote] = useState("")
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [sideTab, setSideTab] = useState<SideTab>("ai")
  const [notes, setNotes] = useState<ReaderNote[]>([])
  const [highlights, setHighlights] = useState<string[]>([])
  const [noteText, setNoteText] = useState("")
  const [favorites, setFavorites] = useState<string[]>([])
  const [aiQuestion, setAiQuestion] = useState("")
  const [aiAnswer, setAiAnswer] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [toast, setToast] = useState("")

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      setDisplayName(user.user_metadata?.name || user.email?.split("@")[0] || "Usuario")
    }
    init()
  }, [router, supabase])

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(favoriteStorageKey()) || "[]"))
    } catch {
      setFavorites([])
    }
  }, [])

  useEffect(() => {
    if (!activeBook) return
    try {
      setNotes(JSON.parse(localStorage.getItem(noteStorageKey(activeBook.id)) || "[]"))
      setHighlights(JSON.parse(localStorage.getItem(highlightStorageKey(activeBook.id)) || "[]"))
    } catch {
      setNotes([])
      setHighlights([])
    }
    setSelectedQuote("")
    setNoteText("")
    setAiQuestion("")
    setAiAnswer("")
    setSideTab("ai")
  }, [activeBook])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filteredBooks = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return BOOKS.filter((book) => {
      const collectionMatch =
        activeCollection === "Todos los libros" ||
        activeCollection === "Continuar leyendo" ||
        (activeCollection === "Favoritos" && favorites.includes(book.id)) ||
        book.category === activeCollection

      const searchMatch =
        !normalized ||
        `${book.title} ${book.author} ${book.category} ${book.description}`.toLowerCase().includes(normalized)

      return collectionMatch && searchMatch
    })
  }, [activeCollection, favorites, search])

  const toggleFavorite = (bookId: string) => {
    setFavorites((current) => {
      const next = current.includes(bookId)
        ? current.filter((id) => id !== bookId)
        : [...current, bookId]
      localStorage.setItem(favoriteStorageKey(), JSON.stringify(next))
      return next
    })
  }

  const handleSelection = () => {
    const selection = window.getSelection()?.toString().trim() || ""
    if (selection.length >= 2) setSelectedQuote(selection.slice(0, 1400))
  }

  const copySelection = async () => {
    const value = selectedQuote || window.getSelection()?.toString().trim() || ""
    if (!value) {
      setToast("Selecciona un fragmento primero")
      return
    }
    await navigator.clipboard.writeText(value)
    setToast("Fragmento copiado")
  }

  const saveHighlight = () => {
    if (!activeBook || !selectedQuote) {
      setToast("Selecciona un fragmento para resaltarlo")
      return
    }
    const next = highlights.includes(selectedQuote) ? highlights : [...highlights, selectedQuote]
    setHighlights(next)
    localStorage.setItem(highlightStorageKey(activeBook.id), JSON.stringify(next))
    setToast("Fragmento resaltado")
  }

  const removeHighlight = (quote: string) => {
    if (!activeBook) return
    const next = highlights.filter((item) => item !== quote)
    setHighlights(next)
    localStorage.setItem(highlightStorageKey(activeBook.id), JSON.stringify(next))
  }

  const saveNote = () => {
    if (!activeBook || (!noteText.trim() && !selectedQuote)) {
      setToast("Escribe una nota o selecciona un fragmento")
      return
    }
    const newNote: ReaderNote = {
      id: crypto.randomUUID(),
      quote: selectedQuote,
      text: noteText.trim() || "Fragmento guardado para revisar.",
      createdAt: new Date().toISOString(),
    }
    const next = [newNote, ...notes]
    setNotes(next)
    localStorage.setItem(noteStorageKey(activeBook.id), JSON.stringify(next))
    setNoteText("")
    setSidePanelOpen(true)
    setSideTab("notes")
    setToast("Nota guardada")
  }

  const deleteNote = (noteId: string) => {
    if (!activeBook) return
    const next = notes.filter((note) => note.id !== noteId)
    setNotes(next)
    localStorage.setItem(noteStorageKey(activeBook.id), JSON.stringify(next))
  }

  const speakText = () => {
    if (!activeBook || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const text = selectedQuote || activeBook.content.join(" ")
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "es-ES"
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
    setToast(selectedQuote ? "Leyendo el fragmento" : "Iniciando lectura")
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await readerRef.current?.requestFullscreen()
      }
    } catch {
      setToast("El navegador no permitió pantalla completa")
    }
  }

  const askAi = async (question?: string) => {
    if (!activeBook || aiLoading) return
    const finalQuestion = question || aiQuestion.trim()
    if (!finalQuestion) return

    setAiLoading(true)
    setAiAnswer("")
    setSidePanelOpen(true)
    setSideTab("ai")

    const contextText = selectedQuote || activeBook.content.join("\n\n")
    const prompt = [
      `Libro: ${activeBook.title}`,
      `Autor: ${activeBook.author}`,
      `Fragmento disponible:\n${contextText}`,
      `Pregunta del lector: ${finalQuestion}`,
      "Responde en español, con lenguaje educativo y utiliza solamente el fragmento proporcionado. Si falta información, indícalo claramente.",
    ].join("\n\n")

    try {
      const response = await fetch("/api/superagent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          task: "reasoning",
          maxTokens: 1100,
          skipTools: true,
          context: {
            page: "Biblioteca EDUAI",
            pageMode: "lector",
            subject: "Lenguaje y Literatura",
          },
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo consultar a EDUAI")
      setAiAnswer(data.text || "No se recibió una respuesta.")
      setAiQuestion("")
    } catch (error) {
      setAiAnswer(error instanceof Error ? error.message : "No se pudo consultar a EDUAI.")
    } finally {
      setAiLoading(false)
    }
  }

  const openNoteForSelection = () => {
    if (!selectedQuote) {
      setToast("Selecciona un fragmento antes de crear la nota")
      return
    }
    setSidePanelOpen(true)
    setSideTab("notes")
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              aria-label="Volver al panel"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20">
              <LibraryBig size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold">Biblioteca EDUAI</h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">Lee, selecciona, anota y aprende con asistencia de IA</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 md:flex">
              <Sparkles size={14} /> IA de lectura activa
            </div>
            <span className="max-w-28 truncate text-sm text-slate-600 sm:max-w-none">{displayName}</span>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[268px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-100 px-5 py-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Mi biblioteca</p>
            <div className="space-y-1">
              {COLLECTIONS.map((collection) => {
                const active = activeCollection === collection
                return (
                  <button
                    key={collection}
                    onClick={() => setActiveCollection(collection)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-blue-50 font-semibold text-blue-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {collection === "Favoritos" ? <Heart size={15} /> : collection === "Continuar leyendo" ? <Bookmark size={15} /> : <BookOpen size={15} />}
                      {collection}
                    </span>
                    {active && <ChevronRight size={15} />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-5">
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm">
                <Bot size={18} />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Asistente de lectura</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">Selecciona texto dentro del visor para explicarlo, resumirlo o crear actividades.</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
          <section className="mx-auto max-w-[1500px]">
            <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <BookText size={13} /> Lecturas abiertas y educativas
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Encuentra tu próxima lectura</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Explora el catálogo y abre cualquier portada para utilizar el visor de lectura con zoom, selección, copia, resaltado, notas y apoyo de EDUAI.</p>
              </div>

              <div className="relative w-full xl:max-w-xl">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por título, autor, género o tema..."
                  className="h-13 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
              {COLLECTIONS.map((collection) => (
                <button
                  key={collection}
                  onClick={() => setActiveCollection(collection)}
                  className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold ${
                    activeCollection === collection
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {collection}
                </button>
              ))}
            </div>

            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{activeCollection}</h3>
                <p className="text-xs text-slate-500">{filteredBooks.length} libros disponibles en esta vista</p>
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:flex">
                <Expand size={14} /> Selecciona una portada para abrir el visor
              </div>
            </div>

            {filteredBooks.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredBooks.map((book) => {
                  const isFavorite = favorites.includes(book.id)
                  return (
                    <article key={book.id} className="group min-w-0">
                      <button
                        onClick={() => setActiveBook(book)}
                        className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-left shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
                      >
                        <img
                          src={book.cover}
                          alt={`Portada de ${book.title}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none"
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                        <div className="absolute bottom-3 left-3 right-3 translate-y-2 rounded-xl bg-white/95 px-3 py-2 text-center text-xs font-bold text-slate-900 opacity-0 shadow-lg backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100">
                          Abrir vista previa
                        </div>
                        <div className="absolute left-3 top-3 rounded-full border border-white/50 bg-white/90 px-2 py-1 text-[10px] font-bold text-emerald-700 shadow-sm">
                          {book.rights}
                        </div>
                      </button>

                      <div className="mt-3 flex items-start gap-2">
                        <button onClick={() => setActiveBook(book)} className="min-w-0 flex-1 text-left">
                          <h4 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 transition group-hover:text-blue-700">{book.title}</h4>
                          <p className="mt-1 truncate text-xs text-slate-500">{book.author}</p>
                        </button>
                        <button
                          onClick={() => toggleFavorite(book.id)}
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border transition ${
                            isFavorite
                              ? "border-rose-200 bg-rose-50 text-rose-600"
                              : "border-slate-200 bg-white text-slate-400 hover:text-rose-500"
                          }`}
                          aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                        >
                          <Heart size={15} fill={isFavorite ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <Search size={34} className="mx-auto text-slate-300" />
                <h3 className="mt-4 text-lg font-bold">No encontramos libros</h3>
                <p className="mt-1 text-sm text-slate-500">Prueba otro término o selecciona una colección diferente.</p>
              </div>
            )}
          </section>
        </main>
      </div>

      {activeBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 backdrop-blur-sm sm:p-4">
          <div
            ref={readerRef}
            className="flex h-full max-h-[calc(100vh-1rem)] w-full max-w-[1580px] flex-col overflow-hidden rounded-2xl border border-white/40 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl"
          >
            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden h-11 w-9 overflow-hidden rounded-lg bg-slate-100 sm:block">
                  <img src={activeBook.cover} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-950 sm:text-base">{activeBook.title}</h2>
                  <p className="truncate text-xs text-slate-500">{activeBook.author} · Vista previa</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSidePanelOpen((value) => !value)}
                  className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 md:flex"
                >
                  {sidePanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                  {sidePanelOpen ? "Ocultar panel" : "Abrir IA y notas"}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                  aria-label="Pantalla completa"
                >
                  <Maximize2 size={16} />
                </button>
                <button
                  onClick={() => setActiveBook(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Cerrar visor"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-5">
              <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
                <button
                  onClick={() => setFontSize((size) => Math.max(14, size - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                  aria-label="Reducir texto"
                >
                  <Minus size={15} />
                </button>
                <span className="min-w-12 text-center text-xs font-bold text-slate-600">{fontSize}px</span>
                <button
                  onClick={() => setFontSize((size) => Math.min(30, size + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                  aria-label="Aumentar texto"
                >
                  <Plus size={15} />
                </button>
              </div>

              <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
                <button
                  onClick={() => setReaderTheme("paper")}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${readerTheme === "paper" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100"}`}
                  title="Fondo claro"
                >
                  <Sun size={15} />
                </button>
                <button
                  onClick={() => setReaderTheme("sepia")}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${readerTheme === "sepia" ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:bg-slate-100"}`}
                  title="Fondo sepia"
                >
                  <BookOpen size={15} />
                </button>
                <button
                  onClick={() => setReaderTheme("night")}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${readerTheme === "night" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                  title="Modo nocturno"
                >
                  <Moon size={15} />
                </button>
              </div>

              <button onClick={copySelection} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                <Copy size={15} /> Copiar
              </button>
              <button onClick={saveHighlight} className="flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                <Highlighter size={15} /> Resaltar
              </button>
              <button onClick={openNoteForSelection} className="flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                <StickyNote size={15} /> Nota
              </button>
              <button onClick={speakText} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                <Volume2 size={15} /> Escuchar
              </button>

              {selectedQuote && (
                <div className="ml-auto hidden max-w-sm items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 xl:flex">
                  <Check size={14} /> Fragmento seleccionado
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <aside className="hidden w-64 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-5 xl:block">
                <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                  <img src={activeBook.cover} alt={`Portada de ${activeBook.title}`} className="h-full w-full object-cover" />
                </div>
                <h3 className="mt-4 text-base font-bold leading-6 text-slate-950">{activeBook.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{activeBook.author}</p>
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <p><span className="font-semibold text-slate-800">Año:</span> {activeBook.year}</p>
                  <p><span className="font-semibold text-slate-800">Categoría:</span> {activeBook.category}</p>
                  <p><span className="font-semibold text-slate-800">Nivel:</span> {activeBook.level}</p>
                  <p><span className="font-semibold text-slate-800">Fuente:</span> {activeBook.source}</p>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">{activeBook.description}</p>
              </aside>

              <main
                className="min-w-0 flex-1 overflow-y-auto"
                style={{ background: READER_THEME[readerTheme].surface }}
              >
                <div className="mx-auto min-h-full max-w-4xl px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
                  {selectedQuote && (
                    <div className="sticky top-0 z-10 mb-5 flex flex-col gap-3 rounded-2xl border border-violet-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                      <p className="line-clamp-2 min-w-0 text-xs leading-5 text-slate-600">“{selectedQuote}”</p>
                      <div className="flex flex-shrink-0 gap-2">
                        <button onClick={() => askAi("Explica este fragmento con palabras sencillas")} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">
                          Preguntar a IA
                        </button>
                        <button onClick={() => setSelectedQuote("")} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  <article
                    onMouseUp={handleSelection}
                    className="select-text rounded-2xl border px-6 py-8 shadow-sm sm:px-10 sm:py-12"
                    style={{
                      background: READER_THEME[readerTheme].background,
                      color: READER_THEME[readerTheme].color,
                      borderColor: readerTheme === "night" ? "#334155" : "#e2e8f0",
                    }}
                  >
                    <div className="mb-10 border-b pb-6" style={{ borderColor: readerTheme === "night" ? "#374151" : "#e5e7eb" }}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] opacity-50">Vista previa de lectura</p>
                      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{activeBook.title}</h1>
                      <p className="mt-3 text-sm opacity-65">{activeBook.author}</p>
                    </div>

                    <div style={{ fontSize, lineHeight: 1.85, fontFamily: "Georgia, Cambria, 'Times New Roman', serif" }}>
                      {activeBook.content.map((paragraph, index) => (
                        <p key={`${activeBook.id}-${index}`} className="mb-6 first-letter:text-2xl first-letter:font-bold">
                          {renderHighlightedText(paragraph, highlights)}
                        </p>
                      ))}
                    </div>

                    <div className="mt-10 rounded-2xl border border-dashed p-5 text-center text-sm opacity-70" style={{ borderColor: readerTheme === "night" ? "#475569" : "#cbd5e1" }}>
                      Esta es una vista previa funcional. La siguiente etapa conectará el lector con archivos EPUB, PDF y textos completos autorizados.
                    </div>
                  </article>
                </div>
              </main>

              {sidePanelOpen && (
                <aside className="absolute inset-x-2 bottom-2 top-32 z-20 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:static md:inset-auto md:z-auto md:w-[360px] md:flex-shrink-0 md:rounded-none md:border-y-0 md:border-r-0 md:shadow-none">
                  <div className="flex flex-shrink-0 border-b border-slate-200 bg-slate-50 p-2">
                    <button
                      onClick={() => setSideTab("ai")}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${sideTab === "ai" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}
                    >
                      <Sparkles size={15} /> EDUAI
                    </button>
                    <button
                      onClick={() => setSideTab("notes")}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${sideTab === "notes" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                    >
                      <StickyNote size={15} /> Notas ({notes.length})
                    </button>
                    <button onClick={() => setSidePanelOpen(false)} className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-white md:hidden">
                      <X size={16} />
                    </button>
                  </div>

                  {sideTab === "ai" ? (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="flex-1 overflow-y-auto p-4">
                        <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-violet-800">
                            <Bot size={17} /> Asistente de lectura
                          </div>
                          <p className="text-xs leading-5 text-slate-600">Puedo trabajar con el fragmento seleccionado o con la vista previa completa del libro.</p>
                        </div>

                        <div className="mt-4 grid gap-2">
                          {QUICK_AI_ACTIONS.map((action) => (
                            <button
                              key={action}
                              onClick={() => askAi(action)}
                              disabled={aiLoading}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
                            >
                              {action}
                            </button>
                          ))}
                        </div>

                        {(aiLoading || aiAnswer) && (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            {aiLoading ? (
                              <div className="flex items-center gap-3 text-sm text-slate-600">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                                Analizando la lectura...
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{aiAnswer}</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 border-t border-slate-200 bg-white p-3">
                        <div className="relative">
                          <textarea
                            value={aiQuestion}
                            onChange={(event) => setAiQuestion(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault()
                                askAi()
                              }
                            }}
                            placeholder="Pregunta sobre la lectura..."
                            rows={3}
                            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 pr-12 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                          />
                          <button
                            onClick={() => askAi()}
                            disabled={!aiQuestion.trim() || aiLoading}
                            className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700 disabled:opacity-40"
                          >
                            <Send size={15} />
                          </button>
                        </div>
                        <p className="mt-2 text-[10px] leading-4 text-slate-400">EDUAI responde usando el fragmento disponible y debe indicar cuando falte información.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="flex-shrink-0 border-b border-slate-100 p-4">
                        {selectedQuote && (
                          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                            “{selectedQuote}”
                          </div>
                        )}
                        <textarea
                          value={noteText}
                          onChange={(event) => setNoteText(event.target.value)}
                          placeholder="Escribe tu interpretación, duda o recordatorio..."
                          rows={4}
                          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                        />
                        <button onClick={saveNote} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
                          <StickyNote size={14} /> Guardar nota
                        </button>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        <div className="mb-5">
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Resaltados</h3>
                            <span className="text-[10px] text-slate-400">{highlights.length}</span>
                          </div>
                          {highlights.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">Todavía no hay fragmentos resaltados.</p>
                          ) : (
                            <div className="space-y-2">
                              {highlights.map((quote) => (
                                <div key={quote} className="group rounded-xl border border-amber-200 bg-amber-50 p-3">
                                  <p className="text-xs leading-5 text-amber-950">“{quote}”</p>
                                  <button onClick={() => removeHighlight(quote)} className="mt-2 text-[10px] font-semibold text-amber-700 opacity-70 hover:opacity-100">Quitar resaltado</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Mis notas</h3>
                          <span className="text-[10px] text-slate-400">Guardadas en este navegador</span>
                        </div>

                        {notes.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                            <StickyNote size={24} className="mx-auto text-slate-300" />
                            <p className="mt-2 text-xs text-slate-400">Selecciona un fragmento y escribe tu primera nota.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {notes.map((note) => (
                              <article key={note.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                {note.quote && <p className="mb-2 rounded-xl bg-amber-50 p-2 text-xs italic leading-5 text-amber-900">“{note.quote}”</p>}
                                <p className="text-sm leading-5 text-slate-700">{note.text}</p>
                                <div className="mt-3 flex items-center justify-between">
                                  <time className="text-[10px] text-slate-400">{new Date(note.createdAt).toLocaleString("es-CL")}</time>
                                  <button onClick={() => deleteNote(note.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </aside>
              )}
            </div>
          </div>
        </div>
      )}

      {!sidePanelOpen && activeBook && (
        <button
          onClick={() => setSidePanelOpen(true)}
          className="fixed bottom-5 right-5 z-[60] flex h-12 items-center gap-2 rounded-2xl bg-violet-600 px-4 text-sm font-bold text-white shadow-xl shadow-violet-500/30 md:hidden"
        >
          <MessageCircle size={17} /> IA y notas
        </button>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          <Check size={16} className="text-emerald-400" /> {toast}
        </div>
      )}

      <div className="fixed bottom-5 right-5 hidden items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-3 text-xs font-semibold text-blue-700 shadow-lg lg:flex">
        <Zap size={14} /> Biblioteca EDUAI — primera versión
      </div>
    </div>
  )
}
