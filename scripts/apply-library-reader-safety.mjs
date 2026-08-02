import fs from "node:fs"
import path from "node:path"

const target = path.join(process.cwd(), "app", "biblioteca", "page.tsx")
let source = fs.readFileSync(target, "utf8")

const MARKER = "// Library reader safety patch v1"
if (source.includes(MARKER)) {
  console.log("[library-reader-safety] already applied")
  process.exit(0)
}

function replaceExact(before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`[library-reader-safety] expected block not found: ${label}`)
  }
  source = source.replace(before, after)
}

replaceExact(
`function noteStorageKey(bookId: string) {
  return \`eduai-library-notes:\${bookId}\`
}

function highlightStorageKey(bookId: string) {
  return \`eduai-library-highlights:\${bookId}\`
}

function favoriteStorageKey() {
  return "eduai-library-favorites"
}`,
`${MARKER}
function noteStorageKey(userId: string, bookId: string) {
  return \`eduai-library:\${userId}:notes:\${bookId}\`
}

function highlightStorageKey(userId: string, bookId: string) {
  return \`eduai-library:\${userId}:highlights:\${bookId}\`
}

function favoriteStorageKey(userId: string) {
  return \`eduai-library:\${userId}:favorites\`
}

function readingStorageKey(userId: string) {
  return \`eduai-library:\${userId}:reading\`
}`,
"scoped storage keys",
)

replaceExact(
`  const readerRef = useRef<HTMLDivElement | null>(null)

  const [displayName, setDisplayName] = useState("Usuario")`,
`  const readerRef = useRef<HTMLDivElement | null>(null)
  const activeBookIdRef = useRef<string | null>(null)
  const aiRequestRef = useRef<AbortController | null>(null)

  const [displayName, setDisplayName] = useState("Usuario")
  const [userId, setUserId] = useState<string | null>(null)`,
"reader refs and user id",
)

replaceExact(
`  const [favorites, setFavorites] = useState<string[]>([])
  const [aiQuestion, setAiQuestion] = useState("")`,
`  const [favorites, setFavorites] = useState<string[]>([])
  const [readingHistory, setReadingHistory] = useState<string[]>([])
  const [aiQuestion, setAiQuestion] = useState("")`,
"reading history state",
)

replaceExact(
`      setDisplayName(user.user_metadata?.name || user.email?.split("@")[0] || "Usuario")`,
`      setUserId(user.id)
      setDisplayName(user.user_metadata?.name || user.email?.split("@")[0] || "Usuario")`,
"authenticated user id",
)

replaceExact(
`  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(favoriteStorageKey()) || "[]"))
    } catch {
      setFavorites([])
    }
  }, [])`,
`  useEffect(() => {
    setFavorites([])
    setReadingHistory([])
    if (!userId) return

    try {
      setFavorites(JSON.parse(localStorage.getItem(favoriteStorageKey(userId)) || "[]"))
      setReadingHistory(JSON.parse(localStorage.getItem(readingStorageKey(userId)) || "[]"))
    } catch {
      setFavorites([])
      setReadingHistory([])
    }
  }, [userId])`,
"user-scoped library state",
)

replaceExact(
`  useEffect(() => {
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
  }, [activeBook])`,
`  useEffect(() => {
    activeBookIdRef.current = activeBook?.id ?? null
    aiRequestRef.current?.abort()
    aiRequestRef.current = null
    setAiLoading(false)

    if (!activeBook || !userId) {
      setNotes([])
      setHighlights([])
      return
    }

    try {
      setNotes(JSON.parse(localStorage.getItem(noteStorageKey(userId, activeBook.id)) || "[]"))
      setHighlights(JSON.parse(localStorage.getItem(highlightStorageKey(userId, activeBook.id)) || "[]"))
    } catch {
      setNotes([])
      setHighlights([])
    }

    setReadingHistory((current) => {
      if (current.includes(activeBook.id)) return current
      const next = [activeBook.id, ...current]
      localStorage.setItem(readingStorageKey(userId), JSON.stringify(next))
      return next
    })

    setSelectedQuote("")
    setNoteText("")
    setAiQuestion("")
    setAiAnswer("")
    setSideTab("ai")
  }, [activeBook, userId])

  useEffect(() => {
    return () => {
      aiRequestRef.current?.abort()
    }
  }, [])`,
"book switch safety and progress",
)

replaceExact(
`        activeCollection === "Todos los libros" ||
        activeCollection === "Continuar leyendo" ||
        (activeCollection === "Favoritos" && favorites.includes(book.id)) ||`,
`        activeCollection === "Todos los libros" ||
        (activeCollection === "Continuar leyendo" && readingHistory.includes(book.id)) ||
        (activeCollection === "Favoritos" && favorites.includes(book.id)) ||`,
"continue reading filter",
)

replaceExact(
`  }, [activeCollection, favorites, search])`,
`  }, [activeCollection, favorites, readingHistory, search])`,
"continue reading dependencies",
)

replaceExact(
`  const toggleFavorite = (bookId: string) => {
    setFavorites((current) => {`,
`  const toggleFavorite = (bookId: string) => {
    if (!userId) return
    setFavorites((current) => {`,
"favorite guard",
)

replaceExact(
`      localStorage.setItem(favoriteStorageKey(), JSON.stringify(next))`,
`      localStorage.setItem(favoriteStorageKey(userId), JSON.stringify(next))`,
"favorite storage",
)

replaceExact(
`    if (!activeBook || !selectedQuote) {`,
`    if (!activeBook || !userId || !selectedQuote) {`,
"highlight save guard",
)

replaceExact(
`    localStorage.setItem(highlightStorageKey(activeBook.id), JSON.stringify(next))`,
`    localStorage.setItem(highlightStorageKey(userId, activeBook.id), JSON.stringify(next))`,
"highlight save storage",
)

replaceExact(
`  const removeHighlight = (quote: string) => {
    if (!activeBook) return`,
`  const removeHighlight = (quote: string) => {
    if (!activeBook || !userId) return`,
"highlight delete guard",
)

replaceExact(
`    localStorage.setItem(highlightStorageKey(activeBook.id), JSON.stringify(next))`,
`    localStorage.setItem(highlightStorageKey(userId, activeBook.id), JSON.stringify(next))`,
"highlight delete storage",
)

replaceExact(
`    if (!activeBook || (!noteText.trim() && !selectedQuote)) {`,
`    if (!activeBook || !userId || (!noteText.trim() && !selectedQuote)) {`,
"note save guard",
)

replaceExact(
`    localStorage.setItem(noteStorageKey(activeBook.id), JSON.stringify(next))`,
`    localStorage.setItem(noteStorageKey(userId, activeBook.id), JSON.stringify(next))`,
"note save storage",
)

replaceExact(
`  const deleteNote = (noteId: string) => {
    if (!activeBook) return`,
`  const deleteNote = (noteId: string) => {
    if (!activeBook || !userId) return`,
"note delete guard",
)

replaceExact(
`    localStorage.setItem(noteStorageKey(activeBook.id), JSON.stringify(next))`,
`    localStorage.setItem(noteStorageKey(userId, activeBook.id), JSON.stringify(next))`,
"note delete storage",
)

replaceExact(
`    setAiLoading(true)
    setAiAnswer("")
    setSidePanelOpen(true)
    setSideTab("ai")

    const contextText = selectedQuote || activeBook.content.join("\\n\\n")`,
`    const requestedBookId = activeBook.id
    aiRequestRef.current?.abort()
    const controller = new AbortController()
    aiRequestRef.current = controller

    setAiLoading(true)
    setAiAnswer("")
    setSidePanelOpen(true)
    setSideTab("ai")

    const contextText = selectedQuote || activeBook.content.join("\\n\\n")`,
"AI request identity",
)

replaceExact(
`      const response = await fetch("/api/superagent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },`,
`      const response = await fetch("/api/superagent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,`,
"AI abort signal",
)

replaceExact(
`      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo consultar a EDUAI")
      setAiAnswer(data.text || "No se recibió una respuesta.")
      setAiQuestion("")
    } catch (error) {
      setAiAnswer(error instanceof Error ? error.message : "No se pudo consultar a EDUAI.")
    } finally {
      setAiLoading(false)
    }`,
`      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo consultar a EDUAI")
      if (activeBookIdRef.current !== requestedBookId || aiRequestRef.current !== controller) return
      setAiAnswer(data.text || "No se recibió una respuesta.")
      setAiQuestion("")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      if (activeBookIdRef.current !== requestedBookId || aiRequestRef.current !== controller) return
      setAiAnswer(error instanceof Error ? error.message : "No se pudo consultar a EDUAI.")
    } finally {
      if (aiRequestRef.current === controller) {
        aiRequestRef.current = null
        if (activeBookIdRef.current === requestedBookId) setAiLoading(false)
      }
    }`,
"AI stale response protection",
)

fs.writeFileSync(target, source)
console.log("[library-reader-safety] scoped storage, reading progress and AI request safety applied")
