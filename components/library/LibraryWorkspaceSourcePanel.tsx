"use client"

import { BookOpen, Cloud, ExternalLink, FolderOpen, ShieldCheck } from "lucide-react"
import type { LibraryWorkspaceView } from "@/components/library/LibraryWorkspaceSidebar"

type SourceConfig = {
  title: string
  description: string
  access: string
  url: string
  kind: "library" | "cloud"
  embedUrl?: string
}

const SOURCES: Partial<Record<LibraryWorkspaceView, SourceConfig>> = {
  bpdigital: {
    title: "BPDigital Chile",
    description: "Biblioteca Pública Digital de Chile con libros y audiolibros disponibles mediante préstamo oficial.",
    access: "Préstamo oficial",
    url: "https://www.bpdigital.cl/",
    kind: "library",
  },
  gutenberg: {
    title: "Project Gutenberg",
    description: "Biblioteca de obras de dominio público con lectura completa en HTML, EPUB y otros formatos.",
    access: "Texto completo",
    url: "https://www.gutenberg.org/browse/languages/es",
    kind: "library",
  },
  booknet: {
    title: "Booknet",
    description: "Plataforma de literatura contemporánea con obras gratuitas y de pago publicadas por autores.",
    access: "Acceso externo",
    url: "https://booknet.com/es/",
    kind: "library",
  },
  librototal: {
    title: "El Libro Total",
    description: "Biblioteca digital con clásicos, literatura hispanoamericana, audiolecturas y obras completas.",
    access: "Lectura online",
    url: "https://www.ellibrototal.com/ltotal/",
    kind: "library",
  },
  casadellibro: {
    title: "Casa del Libro",
    description: "Catálogo editorial con vistas previas y opciones de compra cuando estén disponibles.",
    access: "Vista previa / compra",
    url: "https://www.casadellibro.com/",
    kind: "library",
  },
  "drive-1": {
    title: "Biblioteca Drive 1",
    description: "Repositorio compartido en Google Drive. Si el permiso público lo permite, la carpeta se muestra directamente en el centro.",
    access: "Nube externa",
    url: "https://drive.google.com/drive/folders/1KEXqYp3MIOSYAw3cUNaaJeVtr2iowvam",
    embedUrl: "https://drive.google.com/embeddedfolderview?id=1KEXqYp3MIOSYAw3cUNaaJeVtr2iowvam#grid",
    kind: "cloud",
  },
  "terabox-1": {
    title: "Biblioteca TeraBox 1",
    description: "Repositorio de archivos compartidos mediante TeraBox.",
    access: "Nube externa",
    url: "https://www.terabox.app/spanish/sharing/link?surl=GnrMtXUPA52rbdoU_9xNBw",
    kind: "cloud",
  },
  instagram: {
    title: "Canal de libros",
    description: "Canal externo de novedades y recursos de lectura.",
    access: "Canal externo",
    url: "https://www.instagram.com/channel/AbbG7U-IjP9nduul/",
    kind: "cloud",
  },
  "drive-2": {
    title: "Biblioteca Drive 2",
    description: "Repositorio compartido en Google Drive.",
    access: "Nube externa",
    url: "https://drive.google.com/drive/u/0/folders/1njrOGUAKqUeHTPo_twaNpOKb0af8tI1c",
    embedUrl: "https://drive.google.com/embeddedfolderview?id=1njrOGUAKqUeHTPo_twaNpOKb0af8tI1c#grid",
    kind: "cloud",
  },
  "drive-3": {
    title: "Biblioteca Drive 3",
    description: "Repositorio compartido en Google Drive.",
    access: "Nube externa",
    url: "https://drive.google.com/drive/folders/18MT_Rc7AHBA2-WC_11qM0VyGTDgdtZUv",
    embedUrl: "https://drive.google.com/embeddedfolderview?id=18MT_Rc7AHBA2-WC_11qM0VyGTDgdtZUv#grid",
    kind: "cloud",
  },
  "terabox-2": {
    title: "Biblioteca TeraBox 2",
    description: "Repositorio de archivos compartidos mediante TeraBox.",
    access: "Nube externa",
    url: "https://www.terabox.app/spanish/sharing/link?surl=tQHiUifRoP_7Xd83gj2JpQ",
    kind: "cloud",
  },
  "drive-4": {
    title: "Biblioteca Drive 4",
    description: "Repositorio compartido en Google Drive.",
    access: "Nube externa",
    url: "https://drive.google.com/drive/folders/1aTRah3LcxYSR9bDyD1PSUza5ebeRaOQY",
    embedUrl: "https://drive.google.com/embeddedfolderview?id=1aTRah3LcxYSR9bDyD1PSUza5ebeRaOQY#grid",
    kind: "cloud",
  },
  lectulandia: {
    title: "Lectulandia",
    description: "Repositorio externo de libros. EDUAI no almacena ni replica sus archivos; el acceso conserva las condiciones del sitio de origen.",
    access: "Fuente externa",
    url: "https://ww3.lectulandia.co/",
    kind: "cloud",
  },
}

export function isWorkspaceExternalView(view: LibraryWorkspaceView) {
  return Boolean(SOURCES[view])
}

export default function LibraryWorkspaceSourcePanel({ view }: { view: LibraryWorkspaceView }) {
  const source = SOURCES[view]
  if (!source) return null
  const Icon = source.kind === "cloud" ? Cloud : BookOpen

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-blue-50 px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg"><Icon size={25} /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700">{source.kind === "cloud" ? "Nube de libros" : "Biblioteca conectada"}</span><span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><ShieldCheck size={11} /> {source.access}</span></div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{source.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{source.description}</p>
            </div>
          </div>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white hover:bg-slate-800"><ExternalLink size={14} /> Abrir fuente</a>
        </div>
      </div>

      {source.embedUrl ? (
        <div className="p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-600"><FolderOpen size={15} /> Vista de carpeta</div>
          <iframe src={source.embedUrl} title={source.title} className="h-[68vh] min-h-[540px] w-full rounded-2xl border border-slate-200 bg-slate-50" loading="lazy" referrerPolicy="no-referrer" />
        </div>
      ) : (
        <div className="p-6 sm:p-8">
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
            <Icon size={36} className="mx-auto text-slate-300" />
            <h3 className="mt-4 text-lg font-bold text-slate-900">Fuente seleccionada</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">Este servicio no ofrece un visor embebible estable para EDUAI. La selección se mantiene en el centro y el acceso al contenido se realiza en su plataforma original.</p>
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700"><ExternalLink size={14} /> Continuar en {source.title}</a>
          </div>
        </div>
      )}
    </section>
  )
}
