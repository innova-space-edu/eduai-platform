"use client"

import { FormEvent, useMemo, useState } from "react"
import {
  Accessibility,
  BookOpenCheck,
  ExternalLink,
  Headphones,
  LibraryBig,
  MessageCircle,
  Newspaper,
  Search,
  ShieldCheck,
  Smartphone,
} from "lucide-react"
import {
  BDESCOLAR_APP_STORE,
  BDESCOLAR_CRA,
  BDESCOLAR_FEATURES,
  BDESCOLAR_HELP,
  BDESCOLAR_HOME,
  BDESCOLAR_QUICK_SEARCHES,
  buildBdescolarSearchUrl,
} from "@/lib/library/bdescolar"

type Props = {
  query?: string
}

const FEATURE_ICONS = {
  ebooks: BookOpenCheck,
  audio: Headphones,
  periodicals: Newspaper,
  loans: LibraryBig,
  streaming: BookOpenCheck,
  accessibility: Accessibility,
  mobile: Smartphone,
  community: MessageCircle,
} as const

export default function BdescolarLibrarySection({ query = "" }: Props) {
  const [draft, setDraft] = useState("")
  const [localQuery, setLocalQuery] = useState("")

  const effectiveQuery = (localQuery || query).trim()
  const searchUrl = useMemo(() => buildBdescolarSearchUrl(effectiveQuery), [effectiveQuery])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextQuery = draft.trim()
    if (!nextQuery) return
    setLocalQuery(nextQuery)
    window.open(buildBdescolarSearchUrl(nextQuery), "_blank", "noopener,noreferrer")
  }

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-sm">
      <div className="border-b border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-blue-50 px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-5xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-100 bg-white px-3 py-1 text-[11px] font-black tracking-wide text-cyan-800">BDESCOLAR · MINEDUC</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700"><ShieldCheck size={12} /> Préstamo oficial</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Biblioteca Digital Escolar conectada a EDUAI</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Busca libros, audiolibros y recursos de la Biblioteca Digital Escolar. EDUAI envía la consulta al catálogo oficial; la disponibilidad, el préstamo, la reserva y la lectura protegida se gestionan en BDEscolar con la cuenta del usuario.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={BDESCOLAR_HOME} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-xs font-bold text-white shadow-sm hover:bg-cyan-800">
              <ExternalLink size={14} /> Abrir BDEscolar
            </a>
            <a href={BDESCOLAR_HELP} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm hover:border-cyan-200 hover:text-cyan-800">
              Ayuda MINEDUC
            </a>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Buscar en BDEscolar: título, autor, asignatura o tema..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            />
          </div>
          <button type="submit" className="h-11 rounded-xl bg-slate-950 px-5 text-xs font-bold text-white hover:bg-slate-800">Buscar en BDEscolar</button>
        </form>

        {effectiveQuery && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-cyan-100 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 truncate text-xs text-slate-600">Consulta vinculada desde EDUAI: <span className="font-bold text-slate-900">{effectiveQuery}</span></p>
            <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100">
              <Search size={13} /> Ver resultados oficiales
            </a>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-7">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {BDESCOLAR_FEATURES.map((feature) => {
            const Icon = FEATURE_ICONS[feature.id]
            return (
              <div key={feature.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm"><Icon size={18} /></div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">{feature.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">{feature.description}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex items-center gap-2">
              <Search size={17} className="text-cyan-700" />
              <h3 className="text-sm font-bold text-slate-950">Accesos rápidos al catálogo</h3>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {BDESCOLAR_QUICK_SEARCHES.map((item) => (
                <a key={item.id} href={buildBdescolarSearchUrl(item.query)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800">
                  {item.label}
                </a>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-emerald-700" />
                <div>
                  <p className="text-sm font-bold text-emerald-950">Credenciales fuera de EDUAI</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">EDUAI no solicita, almacena ni reenvía RUT o contraseña de BDEscolar. La autenticación, historial, préstamos, reservas, renovaciones y DRM permanecen en la plataforma oficial.</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Recursos oficiales</p>
            <div className="mt-3 grid gap-2">
              <a href={BDESCOLAR_HOME} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 hover:border-cyan-200 hover:text-cyan-800"><span>Catálogo y cuenta BDEscolar</span><ExternalLink size={13} /></a>
              <a href={BDESCOLAR_CRA} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 hover:border-cyan-200 hover:text-cyan-800"><span>Tutoriales Bibliotecas CRA</span><ExternalLink size={13} /></a>
              <a href={BDESCOLAR_HELP} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 hover:border-cyan-200 hover:text-cyan-800"><span>Ayuda MINEDUC</span><ExternalLink size={13} /></a>
              <a href={BDESCOLAR_APP_STORE} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 hover:border-cyan-200 hover:text-cyan-800"><span>Aplicación móvil BDEscolar</span><Smartphone size={13} /></a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
