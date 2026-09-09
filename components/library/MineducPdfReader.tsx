"use client"

import { ExternalLink, Maximize2, X } from "lucide-react"
import type { MineducBook } from "@/lib/library/mineduc-types"

type Props = {
  book: MineducBook
  onClose: () => void
}

export default function MineducPdfReader({ book, onClose }: Props) {
  const pdfUrl = book.pdfUrl || book.officialReaderUrl || book.detailUrl

  const fullscreen = async () => {
    try {
      const root = document.getElementById("mineduc-pdf-reader")
      if (!root) return
      if (document.fullscreenElement) await document.exitFullscreen()
      else await root.requestFullscreen()
    } catch {
      // El botón externo sigue disponible si el navegador bloquea fullscreen.
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4">
      <section
        id="mineduc-pdf-reader"
        className="flex h-full max-h-[calc(100vh-1rem)] w-full max-w-[1750px] flex-col overflow-hidden rounded-2xl border border-white/30 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl"
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">MINEDUC</span>
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Lectura oficial</span>
            </div>
            <h2 className="mt-2 truncate text-sm font-bold text-slate-950 sm:text-base">{book.title}</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{book.level} · {book.subject} · {book.year}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:flex"
            >
              <ExternalLink size={15} /> Abrir original
            </a>
            <button onClick={fullscreen} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Pantalla completa">
              <Maximize2 size={16} />
            </button>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" aria-label="Cerrar visor">
              <X size={17} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 bg-slate-100">
          <iframe
            src={pdfUrl}
            title={`Texto MINEDUC: ${book.title}`}
            className="h-full w-full border-0 bg-white"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </div>
  )
}
