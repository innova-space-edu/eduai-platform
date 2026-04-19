"use client"
// app/notebooks/[id]/page.tsx  — v2 (usa useNotebook hook)

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, PanelLeftClose, PanelRightClose, Loader2, Zap } from "lucide-react"
import { useNotebook } from "@/hooks/useNotebook"
import SourcePanel from "@/components/notebook/SourcePanel"
import NotebookChat from "@/components/notebook/NotebookChat"
import StudioPanel from "@/components/notebook/StudioPanel"
import SpecialistRoleSelector from "@/components/notebook/SpecialistRoleSelector"

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
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
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
            Volver a mis cuadernos
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
      <div
        className="flex items-center gap-3 px-4 py-2 border-b border-soft flex-shrink-0 z-10"
        style={{ background: "var(--bg-header)", backdropFilter: "blur(12px)" }}
      >
        <button onClick={() => router.push("/notebooks")}
          className="p-1.5 rounded-lg transition-colors flex-shrink-0"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={16} />
        </button>

        <span className="text-base flex-shrink-0">📓</span>

        {/* Título editable */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  saveTitle()
              if (e.key === "Escape") setEditingTitle(false)
            }}
            onBlur={saveTitle}
            className="flex-1 bg-transparent outline-none text-sm font-semibold text-main border-b min-w-0"
            style={{ borderColor: "var(--accent-blue)" }}
          />
        ) : (
          <button
            className="flex-1 text-sm font-semibold text-main text-left truncate hover:opacity-70 transition-opacity min-w-0"
            onClick={() => { setTitleDraft(notebook.title); setEditingTitle(true) }}
          >
            {notebook.title}
          </button>
        )}

        {/* Procesando badge */}
        {processingCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium flex-shrink-0"
            style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
            <Zap size={10} className="animate-pulse" />
            Procesando {processingCount}
          </div>
        )}

        <SpecialistRoleSelector
          value={notebook.specialist_role}
          onChange={(role) => updateNotebook({ specialist_role: role })}
        />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: leftOpen ? "var(--accent-blue)" : "var(--text-muted)" }}
            title="Fuentes"
          >
            <PanelLeftClose size={15} />
          </button>
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: rightOpen ? "var(--accent-blue)" : "var(--text-muted)" }}
            title="Studio"
          >
            <PanelRightClose size={15} />
          </button>
        </div>
      </div>

      {/* ── 3-panel workspace ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Fuentes */}
        {leftOpen && (
          <div
            className="flex-shrink-0 border-r border-soft overflow-hidden flex flex-col transition-all"
            style={{ width: "260px" }}
          >
            <SourcePanel
              notebookId={id}
              sources={sources}
              onSourcesChange={() => {
                refreshSources()
                refreshSummary()
              }}
            />
          </div>
        )}

        {/* CENTER — Chat */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <NotebookChat
            notebookId={id}
            specialistRole={notebook.specialist_role}
            summary={summary}
            onRegenerateSummary={refreshSummary}
          />
        </div>

        {/* RIGHT — Studio */}
        {rightOpen && (
          <div
            className="flex-shrink-0 border-l border-soft overflow-hidden flex flex-col transition-all"
            style={{ width: "260px" }}
          >
            <StudioPanel
              notebookId={id}
              hasContent={hasReadySources}
            />
          </div>
        )}
      </div>
    </div>
  )
}
