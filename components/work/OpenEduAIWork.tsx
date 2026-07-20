"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BookOpenText,
  Menu,
  PanelRight,
  Share2,
  Sparkles,
} from "lucide-react"
import { WorkChat } from "@/components/work/WorkChat"
import { WorkContextPanel } from "@/components/work/WorkContextPanel"
import { WorkSidebar } from "@/components/work/WorkSidebar"
import { WORK_MODES } from "@/lib/work/config"
import type {
  WorkCitation,
  WorkContextData,
  WorkMode,
  WorkNotebookSummary,
} from "@/lib/work/types"

const EMPTY_CONTEXT: WorkContextData = { sources: [], outputs: [] }

type SessionResult = { id: string; title: string; type: string; href?: string }

export function OpenEduAIWork() {
  const [mode, setMode] = useState<WorkMode>("ask")
  const [notebooks, setNotebooks] = useState<WorkNotebookSummary[]>([])
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null)
  const [context, setContext] = useState<WorkContextData>(EMPTY_CONTEXT)
  const [citations, setCitations] = useState<WorkCitation[]>([])
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([])
  const [loadingNotebooks, setLoadingNotebooks] = useState(true)
  const [loadingContext, setLoadingContext] = useState(false)
  const [creating, setCreating] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  const activeNotebook = useMemo(
    () => notebooks.find((notebook) => notebook.id === activeNotebookId),
    [activeNotebookId, notebooks],
  )
  const readySourceCount = context.sources.filter((source) => source.is_active && source.status === "ready").length

  const loadNotebooks = useCallback(async () => {
    setLoadingNotebooks(true)
    try {
      const response = await fetch("/api/notebooks")
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "No fue posible cargar los trabajos")
      const nextNotebooks = Array.isArray(data?.notebooks) ? data.notebooks : []
      setNotebooks(nextNotebooks)
      setActiveNotebookId((current) => {
        if (current && nextNotebooks.some((notebook: WorkNotebookSummary) => notebook.id === current)) return current
        const stored = localStorage.getItem("open-eduai-work:active")
        if (stored && nextNotebooks.some((notebook: WorkNotebookSummary) => notebook.id === stored)) return stored
        return nextNotebooks[0]?.id ?? null
      })
    } catch (error) {
      console.error("[OpenEduAIWork notebooks]", error)
    } finally {
      setLoadingNotebooks(false)
    }
  }, [])

  const loadContext = useCallback(async (notebookId: string | null) => {
    if (!notebookId) {
      setContext(EMPTY_CONTEXT)
      return
    }
    setLoadingContext(true)
    try {
      const response = await fetch(`/api/work/context?notebookId=${encodeURIComponent(notebookId)}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "No fue posible cargar el contexto")
      setContext({
        sources: Array.isArray(data?.sources) ? data.sources : [],
        outputs: Array.isArray(data?.outputs) ? data.outputs : [],
      })
    } catch (error) {
      console.error("[OpenEduAIWork context]", error)
      setContext(EMPTY_CONTEXT)
    } finally {
      setLoadingContext(false)
    }
  }, [])

  useEffect(() => { void loadNotebooks() }, [loadNotebooks])

  useEffect(() => {
    if (activeNotebookId) localStorage.setItem("open-eduai-work:active", activeNotebookId)
    setCitations([])
    setSessionResults([])
    void loadContext(activeNotebookId)
  }, [activeNotebookId, loadContext])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setLeftOpen(false)
      if (window.innerWidth < 1280) setRightOpen(false)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const createWork = async () => {
    setCreating(true)
    try {
      const response = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Nuevo Work ${new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}`,
          specialist_role: "Coordinador Open EDUAI Work",
          description: "Espacio integrado de investigación, creación, colaboración y ejecución.",
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "No fue posible crear el Work")
      await loadNotebooks()
      if (data?.notebook?.id) setActiveNotebookId(data.notebook.id)
      setLeftOpen(false)
    } catch (error) {
      console.error("[OpenEduAIWork create]", error)
    } finally {
      setCreating(false)
    }
  }

  const addSessionResult = useCallback((result: SessionResult) => {
    setSessionResults((current) => current.some((item) => item.id === result.id) ? current : [result, ...current])
  }, [])

  return (
    <main className="flex h-screen min-h-[620px] overflow-hidden bg-app text-main">
      <WorkSidebar
        open={leftOpen}
        notebooks={notebooks}
        activeNotebookId={activeNotebookId}
        loading={loadingNotebooks}
        creating={creating}
        onClose={() => setLeftOpen(false)}
        onSelect={(id) => { setActiveNotebookId(id); if (window.innerWidth < 1024) setLeftOpen(false) }}
        onCreate={() => void createWork()}
      />

      {(leftOpen || rightOpen) && <button type="button" className="absolute inset-0 z-30 bg-black/20 lg:hidden" onClick={() => { setLeftOpen(false); setRightOpen(false) }} aria-label="Cerrar paneles" />}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-soft bg-header-theme backdrop-blur-xl">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
            <button type="button" onClick={() => setLeftOpen(true)} className="rounded-lg p-1.5 text-muted2 hover:bg-card-soft-theme hover:text-main" aria-label="Abrir navegación"><Menu size={17} /></button>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-xs font-black text-white">W</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-sm font-bold text-main">{activeNotebook?.title || "Open EDUAI Work"}</h1>
                <span className="hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-600 sm:inline">Beta</span>
              </div>
              <p className="truncate text-[9px] text-muted2">Motor Claw · fuentes · creación · colaboración</p>
            </div>
            {activeNotebookId && (
              <Link href={`/notebooks/${activeNotebookId}`} className="hidden items-center gap-1 rounded-xl border border-soft px-2.5 py-1.5 text-[10px] text-sub hover:bg-card-soft-theme sm:flex">
                <BookOpenText size={12} /> Abrir cuaderno
              </Link>
            )}
            {activeNotebookId ? (
              <Link href={`/qr-studio?notebookId=${activeNotebookId}`} className="rounded-lg p-1.5 text-muted2 hover:bg-card-soft-theme hover:text-main" aria-label="Compartir este trabajo" title="Compartir">
                <Share2 size={16} />
              </Link>
            ) : (
              <button type="button" disabled className="rounded-lg p-1.5 text-muted2 opacity-40" aria-label="Crea o selecciona un trabajo para compartir" title="Selecciona un trabajo para compartir">
                <Share2 size={16} />
              </button>
            )}
            <button type="button" onClick={() => setRightOpen(true)} className="rounded-lg p-1.5 text-muted2 hover:bg-card-soft-theme hover:text-main" aria-label="Abrir contexto"><PanelRight size={17} /></button>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 sm:px-5" aria-label="Modos de trabajo">
            {WORK_MODES.map(({ id, shortLabel, icon: Icon, accent }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition ${mode === id ? "bg-card-theme text-main shadow-sm ring-1 ring-soft" : "text-muted2 hover:bg-card-soft-theme hover:text-main"}`}
                style={mode === id ? { color: accent } : undefined}
              >
                <Icon size={12} /> {shortLabel}
              </button>
            ))}
            <span className="ml-auto hidden items-center gap-1 text-[9px] text-muted2 lg:flex"><Sparkles size={11} /> Un espacio para todo tu flujo</span>
          </nav>
        </header>

        <WorkChat
          mode={mode}
          notebookId={activeNotebookId}
          notebookTitle={activeNotebook?.title}
          readySourceCount={readySourceCount}
          onCitationsChange={setCitations}
          onResultCreated={addSessionResult}
        />
      </section>

      <WorkContextPanel
        open={rightOpen}
        notebookId={activeNotebookId}
        notebookTitle={activeNotebook?.title}
        context={context}
        citations={citations}
        sessionResults={sessionResults}
        loading={loadingContext}
        onClose={() => setRightOpen(false)}
      />
    </main>
  )
}
