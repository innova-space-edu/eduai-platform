"use client"

// Library reader safety patch v1

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  BookCopy,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Globe2,
  Heart,
  LibraryBig,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import LibraryReader from "@/components/library/LibraryReader"
import {
  LIBRARY_COLLECTIONS,
  LIBRARY_SOURCES,
  LibraryBook,
  LibraryCollection,
  ReadingProgress,
  libraryStorageKeys,
  searchOpenLibrary,
} from "@/lib/library/catalog"

type FavoriteMap = Record<string, LibraryBook>
type ProgressMap = Record<string, ReadingProgress>

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T
  } catch {
    return fallback
  }
}

function accessStyles(book: LibraryBook) {
  if (book.accessMode === "eduai") {
    return {
      label: "Leer completo",
      badge: "Lectura completa",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }
  }
  if (book.accessMode === "borrow") {
    return {
      label: "Solicitar préstamo",
      badge: "Préstamo digital",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    }
  }
  return {
    label: "Ver disponibilidad",
    badge: "Acceso oficial",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  }
}

function BookCard({
  book,
  favorite,
  progress,
  onOpen,
  onFavorite,
}: {
  book: LibraryBook
  favorite: boolean
  progress?: ReadingProgress
  onOpen: () => void
  onFavorite: () => void
}) {
  const access = accessStyles(book)
  const percent = progress?.totalPages ? Math.round(((progress.page + 1) / progress.totalPages) * 100) : 0

  return (
    <article className="group min-w-0">
      <button
        onClick={onOpen}
        className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
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
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/5 to-transparent opacity-60 transition group-hover:opacity-80" />
        <div className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur ${access.className}`}>
          {access.badge}
        </div>
        <div className="absolute bottom-3 left-3 right-3 translate-y-2 rounded-xl bg-white/95 px-3 py-2 text-center text-xs font-bold text-slate-900 opacity-0 shadow-lg backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100">
          {access.label}
        </div>
        {progress && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/40">
            <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
        )}
      </button>

      <div className="mt-3 flex items-start gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 transition group-hover:text-blue-700">{book.title}</h3>
          <p className="mt-1 truncate text-xs text-slate-500">{book.author}</p>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-400">{book.year} · {book.category}</p>
        </button>
        <button
          onClick={onFavorite}
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border transition ${
            favorite
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:text-rose-500"
          }`}
          aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          <Heart size={15} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  )
}

function CollectionButton({
  collection,
  active,
  onClick,
}: {
  collection: LibraryCollection
  active: boolean
  onClick: () => void
}) {
  const Icon = collection.id === "favorites" ? Heart : collection.id === "reading" ? Bookmark : collection.id === "latest" ? Clock3 : BookOpen
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
        active ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      }`}
    >
      <span className="flex items-center gap-2.5"><Icon size={15} />{collection.label}</span>
      {active && <ChevronRight size={15} />}
    </button>
  )
}

export default function BibliotecaPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const searchControllerRef = useRef<AbortController | null>(null)

  const [displayName, setDisplayName] = useState("Usuario")
  const [userId, setUserId] = useState<string | null>(null)
  const [activeCollectionId, setActiveCollectionId] = useState("latest")
  const [searchDraft, setSearchDraft] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [remoteBooks, setRemoteBooks] = useState<LibraryBook[]>([])
  const [remoteTotal, setRemoteTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState("")
  const [favorites, setFavorites] = useState<FavoriteMap>({})
  const [progress, setProgress] = useState<ProgressMap>({})
  const [activeBook, setActiveBook] = useState<LibraryBook | null>(null)

  const activeCollection = useMemo(
    () => LIBRARY_COLLECTIONS.find((collection) => collection.id === activeCollectionId) || LIBRARY_COLLECTIONS[0],
    [activeCollectionId],
  )

  const storageKeys = useMemo(() => (userId ? libraryStorageKeys(userId) : null), [userId])

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      setUserId(user.id)
      setDisplayName(user.user_metadata?.name || user.email?.split("@")[0] || "Usuario")
    }
    initialize()
  }, [router, supabase])

  useEffect(() => {
    if (!storageKeys) return
    setFavorites(readJson<FavoriteMap>(storageKeys.favorites, {}))
    setProgress(readJson<ProgressMap>(storageKeys.progress, {}))
  }, [storageKeys])

  useEffect(() => {
    if (activeCollection.local) {
      setLoading(false)
      setCatalogError("")
      return
    }

    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setLoading(true)
    setCatalogError("")

    searchOpenLibrary({
      collection: activeCollection,
      search: searchTerm,
      page,
      signal: controller.signal,
    })
      .then(({ books, total }) => {
        if (controller.signal.aborted) return
        setRemoteBooks(books)
        setRemoteTotal(total)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setRemoteBooks([])
        setRemoteTotal(0)
        setCatalogError(error instanceof Error ? error.message : "No se pudo cargar el catálogo")
      })
      .finally(() => {
        if (searchControllerRef.current === controller) {
          searchControllerRef.current = null
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [activeCollection, page, searchTerm])

  const visibleBooks = useMemo(() => {
    if (activeCollection.local === "favorites") return Object.values(favorites)
    if (activeCollection.local === "reading") {
      return Object.values(progress)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((entry) => entry.book)
    }
    return remoteBooks
  }, [activeCollection.local, favorites, progress, remoteBooks])

  const visibleTotal = activeCollection.local ? visibleBooks.length : remoteTotal

  const changeCollection = (collectionId: string) => {
    setActiveCollectionId(collectionId)
    setPage(1)
    setSearchTerm("")
    setSearchDraft("")
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    if (activeCollection.local) setActiveCollectionId("latest")
    setSearchTerm(searchDraft.trim())
    setPage(1)
  }

  const toggleFavorite = (book: LibraryBook) => {
    if (!storageKeys) return
    setFavorites((current) => {
      const next = { ...current }
      if (next[book.id]) delete next[book.id]
      else next[book.id] = book
      localStorage.setItem(storageKeys.favorites, JSON.stringify(next))
      return next
    })
  }

  const handleProgress = useCallback((readingProgress: ReadingProgress) => {
    if (!storageKeys) return
    setProgress((current) => {
      const next = { ...current, [readingProgress.book.id]: readingProgress }
      localStorage.setItem(storageKeys.progress, JSON.stringify(next))
      return next
    })
  }, [storageKeys])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" aria-label="Volver al panel">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20">
              <LibraryBig size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold">Biblioteca EDUAI</h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">Libros completos, préstamos, novedades y lectura asistida por IA</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 md:flex">
              <ShieldCheck size={14} /> Fuentes legales verificadas
            </div>
            <span className="max-w-28 truncate text-sm text-slate-600 sm:max-w-none">{displayName}</span>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-100 px-5 py-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Colecciones</p>
            <div className="space-y-1">
              {LIBRARY_COLLECTIONS.map((collection) => (
                <CollectionButton
                  key={collection.id}
                  collection={collection}
                  active={collection.id === activeCollectionId}
                  onClick={() => changeCollection(collection.id)}
                />
              ))}
            </div>
          </div>

          <div className="p-5">
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Bot size={18} /></div>
              <h2 className="text-sm font-bold text-slate-900">IA dentro del libro</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">Selecciona texto para explicarlo, resumirlo, escucharlo o crear actividades de comprensión.</p>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Política de acceso</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">EDUAI no incorpora sitios de descargas que no indiquen claramente sus licencias.</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
          <section className="mx-auto max-w-[1580px]">
            <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
              <div className="grid gap-7 bg-gradient-to-br from-blue-50 via-white to-violet-50 px-5 py-7 md:grid-cols-[minmax(0,1fr)_auto] md:px-8 md:py-9">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm">
                    <Sparkles size={13} /> Biblioteca online conectada
                  </div>
                  <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Lee libros completos y descubre publicaciones actuales</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Los textos de dominio público se abren dentro del visor EDUAI. Los libros protegidos utilizan el préstamo, la muestra o el lector oficial de cada plataforma.</p>
                </div>
                <div className="hidden items-center justify-center md:flex">
                  <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-500/20">
                    <BookOpenCheck size={50} />
                  </div>
                </div>
              </div>

              <form onSubmit={submitSearch} className="border-t border-slate-100 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchDraft}
                      onChange={(event) => setSearchDraft(event.target.value)}
                      placeholder="Busca un libro, autor o tema en español..."
                      className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <button type="submit" className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:brightness-105">
                    <Search size={17} /> Buscar libros
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
              {LIBRARY_COLLECTIONS.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => changeCollection(collection.id)}
                  className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold ${collection.id === activeCollectionId ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  {collection.label}
                </button>
              ))}
            </div>

            <section className="mt-8">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><Globe2 size={18} className="text-blue-600" /><h2 className="text-lg font-bold text-slate-950">Bibliotecas y plataformas conectadas</h2></div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Acceso directo a catálogos abiertos, préstamos chilenos, literatura actual y novedades editoriales.</p>
                </div>
                <span className="hidden rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:inline-flex">6 fuentes verificadas</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {LIBRARY_SOURCES.map((source) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
                    <div className={`h-1.5 bg-gradient-to-r ${source.accent}`} />
                    <div className="flex gap-4 p-4">
                      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${source.accent} text-white shadow-sm`}><BookCopy size={20} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-sm font-bold text-slate-900">{source.name}</h3>
                          <ExternalLink size={14} className="flex-shrink-0 text-slate-400 transition group-hover:text-blue-600" />
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{source.description}</p>
                        <span className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">{source.access}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section className="mt-9">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-950">{searchTerm ? `Resultados para “${searchTerm}”` : activeCollection.label}</h2>
                    {!activeCollection.local && <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Open Library en vivo</span>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{activeCollection.description} · {visibleTotal.toLocaleString("es-CL")} resultados</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  <Zap size={14} className="text-violet-600" /> Selecciona una portada para abrir el visor
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div key={index} className="animate-pulse">
                      <div className="aspect-[2/3] rounded-2xl bg-slate-200" />
                      <div className="mt-3 h-4 rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : catalogError ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-12 text-center">
                  <Globe2 size={34} className="mx-auto text-amber-500" />
                  <h3 className="mt-4 text-lg font-bold text-amber-950">El catálogo externo no respondió</h3>
                  <p className="mt-2 text-sm text-amber-800">{catalogError}. Las plataformas oficiales de la sección superior siguen disponibles.</p>
                  <button onClick={() => setPage((value) => value)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-bold text-white"><Loader2 size={14} /> Reintentar</button>
                </div>
              ) : visibleBooks.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {visibleBooks.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        favorite={Boolean(favorites[book.id])}
                        progress={progress[book.id]}
                        onOpen={() => setActiveBook(book)}
                        onFavorite={() => toggleFavorite(book)}
                      />
                    ))}
                  </div>

                  {!activeCollection.local && (
                    <div className="mt-9 flex items-center justify-center gap-3">
                      <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm disabled:opacity-40">
                        <ChevronLeft size={15} /> Anterior
                      </button>
                      <span className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600">Página {page}</span>
                      <button onClick={() => setPage((value) => value + 1)} disabled={visibleBooks.length < 30} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm disabled:opacity-40">
                        Siguiente <ChevronRight size={15} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                  <Search size={34} className="mx-auto text-slate-300" />
                  <h3 className="mt-4 text-lg font-bold">No encontramos libros en esta colección</h3>
                  <p className="mt-1 text-sm text-slate-500">Prueba otra búsqueda, abre una biblioteca conectada o selecciona una colección diferente.</p>
                </div>
              )}
            </section>

            <footer className="mt-12 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Lectura legal y transparente</p>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Cada tarjeta indica si el libro se lee completo en EDUAI, se solicita mediante préstamo o se abre en la plataforma que administra sus derechos.</p>
                  </div>
                </div>
                <a href="https://openlibrary.org/developers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 hover:underline"><ExternalLink size={13} /> Datos de Open Library</a>
              </div>
            </footer>
          </section>
        </main>
      </div>

      {activeBook && userId && (
        <LibraryReader
          book={activeBook}
          userId={userId}
          onClose={() => setActiveBook(null)}
          onProgress={handleProgress}
        />
      )}
    </div>
  )
}
