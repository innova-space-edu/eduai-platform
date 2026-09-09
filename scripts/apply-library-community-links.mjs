import fs from "node:fs"
import path from "node:path"

const pagePath = path.join(process.cwd(), "app", "biblioteca", "page.tsx")
const catalogPath = path.join(process.cwd(), "lib", "library", "catalog.ts")

if (!fs.existsSync(pagePath)) {
  console.log("[library-community-links] biblioteca page not found")
  process.exit(0)
}

let source = fs.readFileSync(pagePath, "utf8")

const dataMarker = `const AGENT_STAGES: Array<{ id: Exclude<AgentStage, "idle" | "error">; label: string }> = [
  { id: "catalogs", label: "Catálogos" },
  { id: "web", label: "Web legal" },
  { id: "educational", label: "Apoyo educativo" },
  { id: "done", label: "Resultado" },
]
`

const dataBlock = `${dataMarker}
const EXTERNAL_REPOSITORIES = [
  { id: "drive-1", name: "Biblioteca Drive 1", url: "https://drive.google.com/drive/folders/1KEXqYp3MIOSYAw3cUNaaJeVtr2iowvam" },
  { id: "terabox-1", name: "Biblioteca TeraBox 1", url: "https://www.terabox.app/spanish/sharing/link?surl=GnrMtXUPA52rbdoU_9xNBw" },
  { id: "instagram", name: "Canal de libros", url: "https://www.instagram.com/channel/AbbG7U-IjP9nduul/" },
  { id: "drive-2", name: "Biblioteca Drive 2", url: "https://drive.google.com/drive/u/0/folders/1njrOGUAKqUeHTPo_twaNpOKb0af8tI1c" },
  { id: "drive-3", name: "Biblioteca Drive 3", url: "https://drive.google.com/drive/folders/18MT_Rc7AHBA2-WC_11qM0VyGTDgdtZUv" },
  { id: "terabox-2", name: "Biblioteca TeraBox 2", url: "https://www.terabox.app/spanish/sharing/link?surl=tQHiUifRoP_7Xd83gj2JpQ" },
  { id: "drive-4", name: "Biblioteca Drive 4", url: "https://drive.google.com/drive/folders/1aTRah3LcxYSR9bDyD1PSUza5ebeRaOQY" },
  { id: "lectulandia", name: "Lectulandia", url: "https://ww3.lectulandia.co/" },
] as const
`

if (!source.includes("const EXTERNAL_REPOSITORIES = [")) {
  if (!source.includes(dataMarker)) throw new Error("[library-community-links] data marker not found")
  source = source.replace(dataMarker, dataBlock)
}

const readerImportMarker = 'import LibraryReader from "@/components/library/LibraryReader"\n'

if (!source.includes('import FullTextLibrarySection from "@/components/library/FullTextLibrarySection"')) {
  if (!source.includes(readerImportMarker)) throw new Error("[library-community-links] reader import marker not found")
  source = source.replace(readerImportMarker, `${readerImportMarker}import FullTextLibrarySection from "@/components/library/FullTextLibrarySection"\n`)
}

if (!source.includes('import MineducLibrarySection from "@/components/library/MineducLibrarySection"')) {
  const importMarker = 'import FullTextLibrarySection from "@/components/library/FullTextLibrarySection"\n'
  if (!source.includes(importMarker)) throw new Error("[library-community-links] full text import marker not found")
  source = source.replace(importMarker, `${importMarker}import MineducLibrarySection from "@/components/library/MineducLibrarySection"\n`)
}

if (!source.includes('import BdescolarLibrarySection from "@/components/library/BdescolarLibrarySection"')) {
  const mineducImport = 'import MineducLibrarySection from "@/components/library/MineducLibrarySection"\n'
  if (!source.includes(mineducImport)) throw new Error("[library-community-links] MINEDUC import marker not found")
  source = source.replace(mineducImport, `${mineducImport}import BdescolarLibrarySection from "@/components/library/BdescolarLibrarySection"\n`)
}

const trustedMarker = '  { match: (host) => host.endsWith("wikisource.org"), source: "Wikisource", access: "full" },\n'
if (!source.includes('source: "Wikibooks", access: "full"')) {
  if (!source.includes(trustedMarker)) throw new Error("[library-community-links] trusted marker not found")
  source = source.replace(trustedMarker, `${trustedMarker}  { match: (host) => host.endsWith("wikibooks.org"), source: "Wikibooks", access: "full" },\n`)
}

if (!source.includes('source: "OpenStax", access: "full"')) {
  const marker = '  { match: (host) => host.endsWith("wikibooks.org"), source: "Wikibooks", access: "full" },\n'
  source = source.replace(marker, `${marker}  { match: (host) => host === "openstax.org" || host.endsWith(".openstax.org"), source: "OpenStax", access: "full" },\n`)
}

if (!source.includes('source: "Open Textbook Library", access: "full"')) {
  const marker = '  { match: (host) => host === "openstax.org" || host.endsWith(".openstax.org"), source: "OpenStax", access: "full" },\n'
  source = source.replace(marker, `${marker}  { match: (host) => host === "open.umn.edu" || host.endsWith(".open.umn.edu"), source: "Open Textbook Library", access: "full" },\n`)
}

if (!source.includes('source: "SciELO Books", access: "full"')) {
  const marker = '  { match: (host) => host === "open.umn.edu" || host.endsWith(".open.umn.edu"), source: "Open Textbook Library", access: "full" },\n'
  source = source.replace(marker, `${marker}  { match: (host) => host.endsWith("scielo.org"), source: "SciELO Books", access: "full" },\n`)
}

if (!source.includes('source: "BDEscolar", access: "borrow"')) {
  const marker = '  { match: (host) => host.endsWith("scielo.org"), source: "SciELO Books", access: "full" },\n'
  source = source.replace(marker, `${marker}  { match: (host) => host === "bdescolar.mineduc.cl" || host.endsWith(".bdescolar.mineduc.cl"), source: "BDEscolar", access: "borrow" },\n`)
}

if (!source.includes('source: "MINEDUC", access: "official"')) {
  const marker = '  { match: (host) => host === "bdescolar.mineduc.cl" || host.endsWith(".bdescolar.mineduc.cl"), source: "BDEscolar", access: "borrow" },\n'
  source = source.replace(marker, `${marker}  { match: (host) => host === "curriculumnacional.cl" || host.endsWith(".curriculumnacional.cl") || host === "mineduc.cl" || host.endsWith(".mineduc.cl"), source: "MINEDUC", access: "official" },\n`)
}

const domainMarker = '    "es.wikisource.org",\n'
if (!source.includes('"es.wikibooks.org",')) {
  if (!source.includes(domainMarker)) throw new Error("[library-community-links] domain marker not found")
  source = source.replace(domainMarker, `${domainMarker}    "es.wikibooks.org",\n    "openstax.org",\n    "open.umn.edu",\n    "books.scielo.org",\n    "search.livros.scielo.org",\n`)
}
if (!source.includes('"curriculumnacional.cl",')) {
  const marker = '    "search.livros.scielo.org",\n'
  source = source.replace(marker, `${marker}    "curriculumnacional.cl",\n    "catalogotextos.mineduc.cl",\n    "bdescolar.mineduc.cl",\n`)
}

// The general Google Books agent also prioritizes books whose entire text is visible.
if (!source.includes('filter: "full",\n    printType: "books"')) {
  source = source.replace('    printType: "books",\n    orderBy: "relevance",', '    filter: "full",\n    printType: "books",\n    orderBy: "relevance",')
}

const agentMarker = `          <AgentPanel stage={agentStage} result={agentResult} error={agentError} onOpenBook={setActiveBook} onRetry={() => void runEducationalAgent(searchDraft || searchTerm)} />\n`

if (!source.includes("<MineducLibrarySection query={searchTerm} />")) {
  if (!source.includes(agentMarker)) throw new Error("[library-community-links] agent panel marker not found")
  source = source.replace(agentMarker, `${agentMarker}          <MineducLibrarySection query={searchTerm} />\n`)
}

if (!source.includes("<BdescolarLibrarySection query={searchTerm} />")) {
  const bdeMarker = `          <MineducLibrarySection query={searchTerm} />\n`
  if (!source.includes(bdeMarker)) throw new Error("[library-community-links] MINEDUC section marker not found")
  source = source.replace(bdeMarker, `${bdeMarker}          <BdescolarLibrarySection query={searchTerm} />\n`)
}

if (!source.includes("<FullTextLibrarySection query={searchTerm} />")) {
  const fullTextMarker = `          <MineducLibrarySection query={searchTerm} />\n`
  if (!source.includes(fullTextMarker)) throw new Error("[library-community-links] section insertion marker not found")
  source = source.replace(fullTextMarker, `          <FullTextLibrarySection query={searchTerm} />\n${fullTextMarker}`)
}

const sectionMarker = `          <section className="mt-8"><div className="mb-4 flex items-end justify-between gap-4"><div><div className="flex items-center gap-2"><Globe2 size={18} className="text-blue-600" /><h2 className="text-lg font-bold text-slate-950">Bibliotecas y plataformas conectadas</h2></div>`
const externalSection = `          <section className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <BookCopy size={18} className="text-violet-600" />
              <h2 className="text-lg font-bold text-slate-950">Repositorios de libros</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {EXTERNAL_REPOSITORIES.map((repository) => (
                <a key={repository.id} href={repository.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-violet-700 hover:shadow-md">
                  <span>{repository.name}</span>
                  <ExternalLink size={15} className="flex-shrink-0 text-slate-400 transition group-hover:text-violet-600" />
                </a>
              ))}
            </div>
          </section>
${sectionMarker}`

if (!source.includes("Repositorios de libros</h2>")) {
  if (!source.includes(sectionMarker)) throw new Error("[library-community-links] section marker not found")
  source = source.replace(sectionMarker, externalSection)
}

source = source.replace("6 fuentes verificadas", "12 fuentes verificadas").replace("7 fuentes verificadas", "12 fuentes verificadas")
fs.writeFileSync(pagePath, source)

if (fs.existsSync(catalogPath)) {
  let catalogSource = fs.readFileSync(catalogPath, "utf8")
  const bpdigitalMarker = `  {
    id: "bpdigital",
`
  if (!catalogSource.includes(bpdigitalMarker)) throw new Error("[library-community-links] BPDigital source marker not found")

  const extraSources = [
    {
      id: "googlebooks",
      block: `  {\n    id: "googlebooks",\n    name: "Google Books",\n    description: "Búsqueda mundial priorizada a volúmenes con todas las páginas visibles.",\n    access: "Texto completo cuando ALL_PAGES",\n    url: "https://books.google.com/",\n    accent: "from-blue-600 to-red-500",\n    verified: true,\n  },\n`,
    },
    {
      id: "scielobooks",
      block: `  {\n    id: "scielobooks",\n    name: "SciELO Books",\n    description: "Libros académicos Open Access con lectura completa y formatos PDF o EPUB según la obra.",\n    access: "Open Access",\n    url: "https://books.scielo.org/es/",\n    accent: "from-cyan-600 to-emerald-500",\n    verified: true,\n  },\n`,
    },
    {
      id: "wikimedia",
      block: `  {\n    id: "wikimedia",\n    name: "Wikimedia · Wikibooks y Wikisource",\n    description: "Libros de texto libres y obras completas consultables mediante las APIs oficiales de Wikimedia.",\n    access: "Texto completo libre",\n    url: "https://es.wikibooks.org/",\n    accent: "from-slate-700 to-slate-500",\n    verified: true,\n  },\n`,
    },
    {
      id: "openstax",
      block: `  {\n    id: "openstax",\n    name: "OpenStax",\n    description: "Textos educativos completos, revisados por pares y disponibles gratis en web y PDF.",\n    access: "Texto completo OER",\n    url: "https://openstax.org/subjects",\n    accent: "from-orange-600 to-amber-500",\n    verified: true,\n  },\n`,
    },
    {
      id: "opentextbooks",
      block: `  {\n    id: "opentextbooks",\n    name: "Open Textbook Library",\n    description: "Biblioteca de libros de texto completos con licencias abiertas y API pública.",\n    access: "Texto completo OER",\n    url: "https://open.umn.edu/opentextbooks",\n    accent: "from-emerald-700 to-lime-500",\n    verified: true,\n  },\n`,
    },
  ]

  for (const item of extraSources) {
    if (!catalogSource.includes(`id: "${item.id}"`)) catalogSource = catalogSource.replace(bpdigitalMarker, `${item.block}${bpdigitalMarker}`)
  }

  if (!catalogSource.includes('id: "bdescolar"')) {
    const bdeSource = `  {\n    id: "bdescolar",\n    name: "BDEscolar MINEDUC",\n    description: "Biblioteca Digital Escolar con libros, audiolibros, préstamos, reservas y lectura oficial para comunidades educativas.",\n    access: "Préstamo oficial MINEDUC",\n    url: "https://bdescolar.mineduc.cl/",\n    accent: "from-cyan-600 to-blue-500",\n    verified: true,\n  },\n`
    catalogSource = catalogSource.replace(bpdigitalMarker, `${bdeSource}${bpdigitalMarker}`)
  }

  fs.writeFileSync(catalogPath, catalogSource)
}

console.log("[library-community-links] full-text federation, MINEDUC and BDEscolar applied")
