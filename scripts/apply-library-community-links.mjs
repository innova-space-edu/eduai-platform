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
  if (!source.includes(dataMarker)) {
    throw new Error("[library-community-links] data marker not found")
  }
  source = source.replace(dataMarker, dataBlock)
}

const readerImportMarker = 'import LibraryReader from "@/components/library/LibraryReader"\n'

if (!source.includes('import MineducLibrarySection from "@/components/library/MineducLibrarySection"')) {
  if (!source.includes(readerImportMarker)) {
    throw new Error("[library-community-links] reader import marker not found")
  }
  source = source.replace(readerImportMarker, `${readerImportMarker}import MineducLibrarySection from "@/components/library/MineducLibrarySection"\n`)
}

if (!source.includes('import BdescolarLibrarySection from "@/components/library/BdescolarLibrarySection"')) {
  const mineducImport = 'import MineducLibrarySection from "@/components/library/MineducLibrarySection"\n'
  if (!source.includes(mineducImport)) {
    throw new Error("[library-community-links] MINEDUC import marker not found")
  }
  source = source.replace(mineducImport, `${mineducImport}import BdescolarLibrarySection from "@/components/library/BdescolarLibrarySection"\n`)
}

if (!source.includes('source: "BDEscolar", access: "borrow"')) {
  const trustedMarker = '  { match: (host) => host.endsWith("wikisource.org"), source: "Wikisource", access: "full" },\n'
  if (!source.includes(trustedMarker)) {
    throw new Error("[library-community-links] trusted source marker not found")
  }
  source = source.replace(
    trustedMarker,
    `${trustedMarker}  { match: (host) => host === "bdescolar.mineduc.cl" || host.endsWith(".bdescolar.mineduc.cl"), source: "BDEscolar", access: "borrow" },\n`,
  )
}

if (!source.includes('source: "MINEDUC", access: "official"')) {
  const trustedMarker = '  { match: (host) => host === "bdescolar.mineduc.cl" || host.endsWith(".bdescolar.mineduc.cl"), source: "BDEscolar", access: "borrow" },\n'
  if (!source.includes(trustedMarker)) {
    throw new Error("[library-community-links] BDE trusted source marker not found")
  }
  source = source.replace(
    trustedMarker,
    `${trustedMarker}  { match: (host) => host === "curriculumnacional.cl" || host.endsWith(".curriculumnacional.cl") || host === "mineduc.cl" || host.endsWith(".mineduc.cl"), source: "MINEDUC", access: "official" },\n`,
  )
}

if (!source.includes('"curriculumnacional.cl",')) {
  const domainMarker = '    "es.wikisource.org",\n'
  if (!source.includes(domainMarker)) {
    throw new Error("[library-community-links] domain marker not found")
  }
  source = source.replace(
    domainMarker,
    `${domainMarker}    "curriculumnacional.cl",\n    "catalogotextos.mineduc.cl",\n    "bdescolar.mineduc.cl",\n`,
  )
}

const mineducMarker = `          <AgentPanel stage={agentStage} result={agentResult} error={agentError} onOpenBook={setActiveBook} onRetry={() => void runEducationalAgent(searchDraft || searchTerm)} />\n`

if (!source.includes("<MineducLibrarySection query={searchTerm} />")) {
  if (!source.includes(mineducMarker)) {
    throw new Error("[library-community-links] agent panel marker not found")
  }
  source = source.replace(mineducMarker, `${mineducMarker}          <MineducLibrarySection query={searchTerm} />\n`)
}

if (!source.includes("<BdescolarLibrarySection query={searchTerm} />")) {
  const bdeMarker = `          <MineducLibrarySection query={searchTerm} />\n`
  if (!source.includes(bdeMarker)) {
    throw new Error("[library-community-links] MINEDUC section marker not found")
  }
  source = source.replace(bdeMarker, `${bdeMarker}          <BdescolarLibrarySection query={searchTerm} />\n`)
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
  if (!source.includes(sectionMarker)) {
    throw new Error("[library-community-links] section marker not found")
  }
  source = source.replace(sectionMarker, externalSection)
}

source = source.replace("6 fuentes verificadas", "7 fuentes verificadas")
fs.writeFileSync(pagePath, source)

if (fs.existsSync(catalogPath)) {
  let catalogSource = fs.readFileSync(catalogPath, "utf8")
  if (!catalogSource.includes('id: "bdescolar"')) {
    const bpdigitalMarker = `  {
    id: "bpdigital",
`
    if (!catalogSource.includes(bpdigitalMarker)) {
      throw new Error("[library-community-links] BPDigital source marker not found")
    }
    const bdeSource = `  {
    id: "bdescolar",
    name: "BDEscolar MINEDUC",
    description: "Biblioteca Digital Escolar con libros, audiolibros, préstamos, reservas y lectura oficial para comunidades educativas.",
    access: "Préstamo oficial MINEDUC",
    url: "https://bdescolar.mineduc.cl/",
    accent: "from-cyan-600 to-blue-500",
    verified: true,
  },
`
    catalogSource = catalogSource.replace(bpdigitalMarker, `${bdeSource}${bpdigitalMarker}`)
    fs.writeFileSync(catalogPath, catalogSource)
  }
}

console.log("[library-community-links] external repositories, MINEDUC and BDEscolar applied")
