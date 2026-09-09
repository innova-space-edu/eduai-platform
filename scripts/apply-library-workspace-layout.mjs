import fs from "node:fs"
import path from "node:path"

const pagePath = path.join(process.cwd(), "app", "biblioteca", "page.tsx")
const fullTextPath = path.join(process.cwd(), "components", "library", "FullTextLibrarySection.tsx")

if (!fs.existsSync(pagePath)) {
  console.log("[library-workspace] biblioteca page not found")
  process.exit(0)
}

let source = fs.readFileSync(pagePath, "utf8")

const bdeImport = 'import BdescolarLibrarySection from "@/components/library/BdescolarLibrarySection"\n'
const workspaceImports = `${bdeImport}import LibraryWorkspaceSidebar, { WORKSPACE_VIEW_LABELS, type LibraryWorkspaceView } from "@/components/library/LibraryWorkspaceSidebar"\nimport LibraryWorkspaceSourcePanel, { isWorkspaceExternalView } from "@/components/library/LibraryWorkspaceSourcePanel"\n`
if (!source.includes('import LibraryWorkspaceSidebar')) {
  if (!source.includes(bdeImport)) throw new Error("[library-workspace] BDE import marker not found; run community-links first")
  source = source.replace(bdeImport, workspaceImports)
}

const stateMarker = '  const [agentError, setAgentError] = useState("")\n'
if (!source.includes('const [workspaceView, setWorkspaceView]')) {
  if (!source.includes(stateMarker)) throw new Error("[library-workspace] agent state marker not found")
  source = source.replace(
    stateMarker,
    `${stateMarker}  const [workspaceView, setWorkspaceView] = useState<LibraryWorkspaceView>("home")\n  const [workspaceMobileOpen, setWorkspaceMobileOpen] = useState(false)\n`,
  )
}

source = source.replace(
  '  const changeCollection = (collectionId: string) => { setActiveCollectionId(collectionId); setPage(1); setSearchTerm(""); setSearchDraft("") }',
  '  const changeCollection = (collectionId: string) => { setWorkspaceView("openlibrary"); setActiveCollectionId(collectionId); setPage(1); setSearchTerm(""); setSearchDraft("") }',
)
source = source.replace(
  '  const submitSearch = (event: FormEvent) => { event.preventDefault(); const query = searchDraft.trim(); if (!query) return; if (activeCollection.local) setActiveCollectionId("latest"); setSearchTerm(query); setPage(1); void runEducationalAgent(query) }',
  '  const submitSearch = (event: FormEvent) => { event.preventDefault(); const query = searchDraft.trim(); if (!query) return; setWorkspaceView("home"); if (activeCollection.local) setActiveCollectionId("latest"); setSearchTerm(query); setPage(1); void runEducationalAgent(query) }',
)
source = source.replace(
  '  const searchExample = (query: string) => { setSearchDraft(query); setSearchTerm(query); setActiveCollectionId("latest"); setPage(1); void runEducationalAgent(query) }',
  '  const searchExample = (query: string) => { setWorkspaceView("home"); setSearchDraft(query); setSearchTerm(query); setActiveCollectionId("latest"); setPage(1); void runEducationalAgent(query) }',
)

const progressMarker = '  const handleProgress = useCallback((readingProgress: ReadingProgress) => { if (!storageKeys) return; setProgress((current) => { const next = { ...current, [readingProgress.book.id]: readingProgress }; localStorage.setItem(storageKeys.progress, JSON.stringify(next)); return next }) }, [storageKeys])\n'
if (!source.includes('const selectWorkspaceView = (view: LibraryWorkspaceView)')) {
  if (!source.includes(progressMarker)) throw new Error("[library-workspace] progress marker not found")
  source = source.replace(
    progressMarker,
    `${progressMarker}\n  const selectWorkspaceView = (view: LibraryWorkspaceView) => {\n    setWorkspaceView(view)\n    setWorkspaceMobileOpen(false)\n    if (view === "openlibrary") setPage(1)\n  }\n`,
  )
}

source = source.replace("lg:grid-cols-[270px_minmax(0,1fr)]", "lg:grid-cols-[300px_minmax(0,1fr)]")
source = source.replace("Encuentra el libro o recibe una solución educativa completa", "Selecciona una biblioteca, nube o texto completo")

if (!source.includes('<LibraryWorkspaceSidebar activeView={workspaceView}')) {
  const asideRegex = /<aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">[\s\S]*?<\/aside>/
  if (!asideRegex.test(source)) throw new Error("[library-workspace] legacy sidebar not found")
  source = source.replace(
    asideRegex,
    '<LibraryWorkspaceSidebar activeView={workspaceView} activeCollectionId={activeCollectionId} collections={LIBRARY_COLLECTIONS} mobileOpen={workspaceMobileOpen} onMobileOpenChange={setWorkspaceMobileOpen} onSelect={selectWorkspaceView} onCollection={changeCollection} />',
  )
}

const mainStart = '<main className="min-w-0 px-4 py-6 sm:px-7 lg:px-9 lg:py-8"><section className="mx-auto max-w-[1580px]">\n'
if (!source.includes('WORKSPACE_VIEW_LABELS[workspaceView]')) {
  if (!source.includes(mainStart)) throw new Error("[library-workspace] main marker not found")
  source = source.replace(
    mainStart,
    `${mainStart}          <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.17em] text-slate-400">Biblioteca seleccionada</p><h2 className="mt-0.5 truncate text-base font-bold text-slate-900">{WORKSPACE_VIEW_LABELS[workspaceView]}</h2></div><button onClick={() => setWorkspaceView("home")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-blue-700">Inicio</button></div>\n`,
  )
}

if (!source.includes('{workspaceView === "home" && <>')) {
  const homeStart = '          <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">'
  const agentEnd = '          <AgentPanel stage={agentStage} result={agentResult} error={agentError} onOpenBook={setActiveBook} onRetry={() => void runEducationalAgent(searchDraft || searchTerm)} />'
  const start = source.indexOf(homeStart)
  const end = source.indexOf(agentEnd, start)
  if (start === -1 || end === -1) throw new Error("[library-workspace] home block markers not found")
  const endIndex = end + agentEnd.length
  const block = source.slice(start, endIndex)
  const welcomeBlock = block.replace(
    'Busca cualquier libro. EDUAI intentará encontrarlo y ayudarte a estudiarlo.',
    'Bienvenido a la Biblioteca EDUAI.',
  ).replace(
    'Primero revisa catálogos, préstamos y vistas previas oficiales. Si no existe lectura completa autorizada, entrega un resumen extendido, preguntas, actividades y referencias legales.',
    'Busca un libro desde aquí o selecciona en el panel lateral una biblioteca, una fuente de texto completo o una nube de libros. EDUAI mantiene todas las fuentes ordenadas en un solo espacio.',
  )
  source = `${source.slice(0, start)}          {workspaceView === "home" && <>\n${welcomeBlock}\n          </>}\n${source.slice(endIndex)}`
}

const mobileCollectionsRegex = /\n          <div className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">[\s\S]*?<\/div>/
source = source.replace(mobileCollectionsRegex, "")

const fullTextComponent = '          <FullTextLibrarySection query={searchTerm} />'
if (source.includes(fullTextComponent)) {
  source = source.replace(
    fullTextComponent,
    `          {(workspaceView === "fulltext" || workspaceView === "openstax" || workspaceView === "open-textbook-library" || workspaceView === "wikibooks" || workspaceView === "wikisource" || workspaceView === "scielo" || workspaceView === "google-books") && (\n            <FullTextLibrarySection\n              query={searchTerm}\n              sourceFilter={workspaceView === "openstax" ? "openstax" : workspaceView === "open-textbook-library" ? "open-textbook-library" : workspaceView === "wikibooks" ? "wikibooks" : workspaceView === "wikisource" ? "wikisource" : workspaceView === "scielo" ? "scielo" : workspaceView === "google-books" ? "google-books" : "all"}\n            />\n          )}`,
  )
}

source = source.replace(
  '          <MineducLibrarySection query={searchTerm} />',
  '          {workspaceView === "mineduc" && <MineducLibrarySection query={searchTerm} />}',
)
source = source.replace(
  '          <BdescolarLibrarySection query={searchTerm} />',
  '          {workspaceView === "bdescolar" && <BdescolarLibrarySection query={searchTerm} />}',
)

if (!source.includes('isWorkspaceExternalView(workspaceView) && <LibraryWorkspaceSourcePanel')) {
  const bdeView = '          {workspaceView === "bdescolar" && <BdescolarLibrarySection query={searchTerm} />}\n'
  if (!source.includes(bdeView)) throw new Error("[library-workspace] BDE view marker not found")
  source = source.replace(bdeView, `${bdeView}          {isWorkspaceExternalView(workspaceView) && <LibraryWorkspaceSourcePanel view={workspaceView} />}\n`)
}

// Repositories and source cards now live in the sidebar; remove their long center sections.
const repositorySectionRegex = /\n          <section className="mt-8">\n            <div className="mb-4 flex items-center gap-2">\n              <BookCopy size=\{18\} className="text-violet-600" \/>[\s\S]*?<\/section>/
source = source.replace(repositorySectionRegex, "")

const connectedSectionStart = '          <section className="mt-8"><div className="mb-4 flex items-end justify-between gap-4"><div><div className="flex items-center gap-2"><Globe2 size={18} className="text-blue-600" /><h2 className="text-lg font-bold text-slate-950">Bibliotecas y plataformas conectadas</h2></div>'
const connectedStartIndex = source.indexOf(connectedSectionStart)
if (connectedStartIndex !== -1) {
  const nextSectionIndex = source.indexOf('          <section className="mt-9">', connectedStartIndex)
  if (nextSectionIndex === -1) throw new Error("[library-workspace] connected libraries end marker not found")
  source = `${source.slice(0, connectedStartIndex)}${source.slice(nextSectionIndex)}`
}

const openLibraryStart = '          <section className="mt-9">'
if (!source.includes('{workspaceView === "openlibrary" && (\n          <section className="mt-9">')) {
  const start = source.indexOf(openLibraryStart)
  const footerStart = source.indexOf('          <footer className="mt-12', start)
  if (start === -1 || footerStart === -1) throw new Error("[library-workspace] Open Library block markers not found")
  const block = source.slice(start, footerStart)
  source = `${source.slice(0, start)}          {workspaceView === "openlibrary" && (\n${block}          )}\n${source.slice(footerStart)}`
}

source = source.replace('          <footer className="mt-12', '          <footer className="mt-8')

fs.writeFileSync(pagePath, source)

if (fs.existsSync(fullTextPath)) {
  let fullText = fs.readFileSync(fullTextPath, "utf8")
  if (!fullText.includes('sourceFilter?: FullTextSourceId | "all"')) {
    fullText = fullText.replace('type Props = {\n  query?: string\n}', 'type Props = {\n  query?: string\n  sourceFilter?: FullTextSourceId | "all"\n}')
  }
  fullText = fullText.replace('export default function FullTextLibrarySection({ query = "" }: Props) {', 'export default function FullTextLibrarySection({ query = "", sourceFilter = "all" }: Props) {')
  if (!fullText.includes('setSource(sourceFilter)\n  }, [sourceFilter])')) {
    const queryMarker = '  const effectiveQuery = (localQuery || query || DEFAULT_QUERY).trim()\n'
    if (!fullText.includes(queryMarker)) throw new Error("[library-workspace] fulltext query marker not found")
    fullText = fullText.replace(queryMarker, `${queryMarker}\n  useEffect(() => {\n    setSource(sourceFilter)\n  }, [sourceFilter])\n`)
  }
  fullText = fullText.replace('    setSource("all")\n  }', '    setSource(sourceFilter)\n  }')
  fs.writeFileSync(fullTextPath, fullText)
}

console.log("[library-workspace] sidebar workspace layout applied")
