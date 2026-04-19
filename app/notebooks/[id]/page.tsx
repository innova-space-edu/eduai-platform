"use client"
// app/notebooks/[id]/page.tsx
// Workspace principal tipo NotebookLM

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import SourcePanel from "@/components/notebook/SourcePanel"
import NotebookChat from "@/components/notebook/NotebookChat"
import StudioPanel from "@/components/notebook/StudioPanel"
import SpecialistRoleSelector from "@/components/notebook/SpecialistRoleSelector"
import { ArrowLeft, PanelLeftClose, PanelRightClose, Loader2 } from "lucide-react"
import type { Notebook, NotebookSource, NotebookSummary } from "@/lib/notebook/types"

export default function NotebookPage() {
  const { id }   = useParams() as { id: string }
  const router   = useRouter()

  const [notebook,     setNotebook]     = useState<Notebook | null>(null)
  const [sources,      setSources]      = useState<NotebookSource[]>([])
  const [summary,      setSummary]      = useState<NotebookSummary | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [leftOpen,     setLeftOpen]     = useState(true)
  const [rightOpen,    setRightOpen]    = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft,   setTitleDraft]   = useState("")

  // ─── Carga inicial ───────────────────────────────────────────────────────────

  const loadNotebook = useCallback(async () => {
    const [nbRes, srcRes, sumRes] = await Promise.all([
      fetch(`/api/notebooks/${id}`),
      fetch(`/api/notebooks/${id}/sources`),
      fetch(`/api/notebooks/${id}/summary`),
    ])
    const [nbData, srcData, sumData] = await Promise.all([
      nbRes.json(), srcRes.json(), sumRes.json(),
    ])
    if (nbData.notebook)  setNotebook(nbData.notebook)
    if (srcData.sources)  setSources(srcData.sources)
    if (sumData.summary)  setSummary(sumData.summary)
    setLoading(false)
  }, [id])

  useEffect(() => { loadNotebook() }, [loadNotebook])

  const refreshSources = useCallback(async () => {
    const res  = await fetch(`/api/notebooks/${id}/sources`)
    const data = await res.json()
    if (data.sources) setSources(data.sources)
  }, [id])

  const refreshSummary = useCallback(async () => {
    const res  = await fetch(`/api/notebooks/${id}/summary`)
    const data = await res.json()
    if (data.summary) setSummary(data.summary)
  }, [id])

  // ─── Editar título ───────────────────────────────────────────────────────────

  const saveTitle = async () => {
    if (!titleDraft.trim() || !notebook) return
    await fetch(`/api/notebooks/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title: titleDraft.trim() }),
    })
    setNotebook((prev) => prev ? { ...prev, title: titleDraft.trim() } : prev)
    setEditingTitle(false)
  }

  // ─── Cambiar rol ─────────────────────────────────────────────────────────────

  const changeRole = async (role: string) => {
    await fetch(`/api/notebooks/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ specialist_role: role }),
    })
    setNotebook((prev) => prev ? { ...prev, specialist_role: role } : prev)
  }

  const hasReadySources = sources.some((s) => s.status === "ready" && s.is_active)

  // ─── Loading ─────────────────────────────────────────────────────────────────

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
          <button
            onClick={() => router.push("/notebooks")}
            className="text-xs text-blue-400 hover:underline"
          >
            Volver a mis cuadernos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-app overflow-hidden">

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b border-soft flex-shrink-0"
        style={{ background: "var(--bg-header)", backdropFilter: "blur(12px)" }}
      >
        <button
          onClick={() => router.push("/notebooks")}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)" }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
        >
          <ArrowLeft size={16} />
        </button>

        <span className="text-base">📓</span>

        {/* Título editable */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle()
              if (e.key === "Escape") setEditingTitle(false)
            }}
            onBlur={saveTitle}
            className="flex-1 bg-transparent outline-none text-sm font-semibold text-main border-b"
            style={{ borderColor: "var(--accent-blue)" }}
          />
        ) : (
          <button
            className="flex-1 text-sm font-semibold text-main text-left truncate hover:opacity-70 transition-opacity"
            onClick={() => { setTitleDraft(notebook.title); setEditingTitle(true) }}
          >
            {notebook.title}
          </button>
        )}

        {/* Rol especialista */}
        <SpecialistRoleSelector
          value={notebook.specialist_role}
          onChange={changeRole}
        />

        {/* Toggle paneles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: leftOpen ? "var(--accent-blue)" : "var(--text-muted)" }}
            title="Panel de fuentes"
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

      {/* ── Main workspace ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Sources */}
        {leftOpen && (
          <div
            className="flex-shrink-0 border-r border-soft overflow-hidden flex flex-col"
            style={{ width: "260px" }}
          >
            <SourcePanel
              notebookId={id}
              sources={sources}
              onSourcesChange={() => { refreshSources(); refreshSummary() }}
            />
          </div>
        )}

        {/* Center: Chat + Summary */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <NotebookChat
            notebookId={id}
            specialistRole={notebook.specialist_role}
            summary={summary}
            onRegenerateSummary={refreshSummary}
          />
        </div>

        {/* Right: Studio */}
        {rightOpen && (
          <div
            className="flex-shrink-0 border-l border-soft overflow-hidden flex flex-col"
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
