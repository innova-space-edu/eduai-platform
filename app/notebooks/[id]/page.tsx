"use client"
// app/notebooks/[id]/page.tsx  v4 — EduAI Notebooks

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, PanelLeftClose, PanelRightClose, Loader2 } from "lucide-react"
import { useNotebook }       from "@/hooks/useNotebook"
import SourcePanel           from "@/components/notebook/SourcePanel"
import NotebookChat          from "@/components/notebook/NotebookChat"
import StudioPanel           from "@/components/notebook/StudioPanel"
import SpecialistRoleSelector from "@/components/notebook/SpecialistRoleSelector"
import ProcessingIndicator   from "@/components/notebook/ProcessingIndicator"

export default function NotebookPage() {
  const { id }  = useParams() as { id: string }
  const router  = useRouter()

  const {
    notebook, sources, summary, loading,
    hasReadySources, processingCount,
    refreshSources, refreshSummary, updateNotebook,
  } = useNotebook(id)

  const [leftOpen,     setLeftOpen]     = useState(true)
  const [rightOpen,    setRightOpen]    = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft,   setTitleDraft]   = useState("")

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-app">
        <div className="flex flex-col items-center gap-4">
          <div style={{ position: "relative", width: 48, height: 48 }}>
            <svg width={48} height={48} viewBox="0 0 36 36"
              style={{ animation: "nb-spin 0.9s linear infinite", display: "block" }}>
              <defs>
                <linearGradient id="load-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#3b82f6" />
                  <stop offset="50%"  stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="url(#load-grad)" strokeWidth="3"
                strokeLinecap="round" strokeDasharray="44 44" transform="rotate(-90 18 18)" />
            </svg>
            <style>{`@keyframes nb-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </div>
          <p className="text-sm text-muted2">Cargando cuaderno...</p>
        </div>
      </div>
    )
  }

  if (!notebook) {
    return (
      <div className="flex items-center justify-center h-screen bg-app">
        <div className="text-center">
          <p className="text-4xl mb-3">📓</p>
          <p className="text-main font-semibold mb-2">Cuaderno no encontrado</p>
          <button onClick={() => router.push("/notebooks")}
            className="text-xs text-blue-400 hover:underline">
            Volver a EduAI Notebooks
          </button>
        </div>
      </div>
    )
  }

  const saveTitle = async () => {
    if (!titleDraft.trim()) return
    await updateNotebook({ title: titleDraft.trim() })
    setEditingTitle(false)
  }

  return (
    <div className="flex flex-col h-screen bg-app overflow-hidden">

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-soft flex-shrink-0 z-10"
        style={{ background: "var(--bg-header)", backdropFilter: "blur(12px)" }}>

        {/* Volver a Creator Hub */}
        <button
          onClick={() => router.push("/creator-hub")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium flex-shrink-0 transition-all"
          style={{ color: "var(--text-muted)", background: "transparent" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-card-soft)"
            e.currentTarget.style.color      = "var(--text-primary)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.color      = "var(--text-muted)"
          }}
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Creator Hub</span>
        </button>

        <span className="text-muted2 text-xs flex-shrink-0">/</span>
        <span className="text-base flex-shrink-0">📓</span>

        {/* Título editable */}
        {editingTitle ? (
          <input autoFocus value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  saveTitle()
              if (e.key === "Escape") setEditingTitle(false)
            }}
            onBlur={saveTitle}
            className="flex-1 bg-transparent outline-none text-sm font-semibold text-main border-b min-w-0"
            style={{ borderColor: "var(--accent-blue)" }} />
        ) : (
          <button
            className="flex-1 text-sm font-semibold text-main text-left truncate hover:opacity-70 transition-opacity min-w-0"
            onClick={() => { setTitleDraft(notebook.title); setEditingTitle(true) }}
          >
            {notebook.title}
          </button>
        )}

        {/* Procesando */}
        {processingCount > 0 && (
          <ProcessingIndicator count={processingCount} total={sources.length} size="sm" />
        )}

        <SpecialistRoleSelector
          value={notebook.specialist_role}
          onChange={async (role) => { await updateNotebook({ specialist_role: role }) }}
        />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setLeftOpen(!leftOpen)} className="p-1.5 rounded-lg transition-all"
            style={{ color: leftOpen ? "var(--accent-blue)" : "var(--text-muted)" }} title="Fuentes">
            <PanelLeftClose size={15} />
          </button>
          <button onClick={() => setRightOpen(!rightOpen)} className="p-1.5 rounded-lg transition-all"
            style={{ color: rightOpen ? "var(--accent-blue)" : "var(--text-muted)" }} title="Studio">
            <PanelRightClose size={15} />
          </button>
        </div>
      </div>

      {/* ── 3-panel workspace ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {leftOpen && (
          <div className="flex-shrink-0 border-r border-soft overflow-hidden flex flex-col" style={{ width: "260px" }}>
            <SourcePanel
              notebookId={id} sources={sources}
              onSourcesChange={() => { refreshSources(); refreshSummary() }} />
          </div>
        )}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <NotebookChat
            notebookId={id} specialistRole={notebook.specialist_role}
            summary={summary} onRegenerateSummary={refreshSummary} />
        </div>
        {rightOpen && (
          <div className="flex-shrink-0 border-l border-soft overflow-hidden flex flex-col" style={{ width: "260px" }}>
            <StudioPanel notebookId={id} hasContent={hasReadySources} />
          </div>
        )}
      </div>
    </div>
  )
}
