"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  BookOpenText,
  PanelLeftClose,
  PanelRightClose,
  QrCode,
} from "lucide-react"
import { useNotebook } from "@/hooks/useNotebook"
import SourcePanelPro from "@/components/notebook/SourcePanelPro"
import NotebookChatPro from "@/components/notebook/NotebookChatPro"
import NotebookStudyPanel from "@/components/notebook/NotebookStudyPanel"
import SpecialistRoleSelector from "@/components/notebook/SpecialistRoleSelector"
import ProcessingIndicator from "@/components/notebook/ProcessingIndicator"

export default function NotebookPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const {
    notebook,
    sources,
    summary,
    loading,
    hasReadySources,
    processingCount,
    refreshSources,
    refreshSummary,
    updateNotebook,
  } = useNotebook(id)

  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState("")

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-4">
          <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-500/15 border-t-blue-500" />
          <p className="text-sm text-muted2">Cargando cuaderno...</p>
        </div>
      </div>
    )
  }

  if (!notebook) {
    return (
      <div className="flex h-screen items-center justify-center bg-app">
        <div className="text-center">
          <p className="text-4xl">📓</p>
          <p className="mt-3 font-semibold text-main">Cuaderno no encontrado</p>
          <button type="button" onClick={() => router.push("/notebooks")} className="mt-2 text-xs text-blue-500 hover:underline">
            Volver a mis cuadernos
          </button>
        </div>
      </div>
    )
  }

  const activeReadyCount = sources.filter((source) => source.is_active && source.status === "ready").length

  const saveTitle = async () => {
    const nextTitle = titleDraft.trim()
    if (!nextTitle) {
      setEditingTitle(false)
      return
    }
    await updateNotebook({ title: nextTitle })
    setEditingTitle(false)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app">
      <header className="z-20 flex shrink-0 items-center gap-2 border-b border-soft px-3 py-2" style={{ background: "var(--bg-header)", backdropFilter: "blur(12px)" }}>
        <button
          type="button"
          onClick={() => router.push("/notebooks")}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted2 transition hover:bg-card-soft-theme hover:text-main"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Cuadernos</span>
        </button>

        <span className="text-muted2">/</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
          <BookOpenText size={16} />
        </span>

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveTitle()
              if (event.key === "Escape") setEditingTitle(false)
            }}
            onBlur={() => void saveTitle()}
            className="min-w-0 flex-1 border-b border-blue-500 bg-transparent text-sm font-semibold text-main outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setTitleDraft(notebook.title); setEditingTitle(true) }}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-main transition hover:opacity-70"
            title="Cambiar nombre"
          >
            {notebook.title}
          </button>
        )}

        {processingCount > 0 && <ProcessingIndicator count={processingCount} total={sources.length} size="sm" />}

        <SpecialistRoleSelector
          value={notebook.specialist_role}
          onChange={async (role) => { await updateNotebook({ specialist_role: role }) }}
        />

        <button
          type="button"
          onClick={() => router.push(`/qr-studio?notebookId=${encodeURIComponent(id)}`)}
          className="rounded-lg p-1.5 text-blue-500 transition hover:bg-blue-500/10"
          title="Compartir mediante QR"
        >
          <QrCode size={15} />
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setLeftOpen((value) => !value)}
            className="rounded-lg p-1.5"
            style={{ color: leftOpen ? "var(--accent-blue)" : "var(--text-muted)" }}
            title="Fuentes y lecturas"
          >
            <PanelLeftClose size={15} />
          </button>
          <button
            type="button"
            onClick={() => setRightOpen((value) => !value)}
            className="rounded-lg p-1.5"
            style={{ color: rightOpen ? "var(--accent-blue)" : "var(--text-muted)" }}
            title="Notas y podcast"
          >
            <PanelRightClose size={15} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {leftOpen && (
          <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r border-soft xl:w-[330px]">
            <SourcePanelPro
              notebookId={id}
              sources={sources}
              onSourcesChange={async () => {
                await Promise.resolve(refreshSources())
                await Promise.resolve(refreshSummary())
              }}
            />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <NotebookChatPro
            notebookId={id}
            specialistRole={notebook.specialist_role}
            summary={summary}
            activeSourceCount={activeReadyCount}
            onRegenerateSummary={refreshSummary}
          />
        </main>

        {rightOpen && (
          <aside className="flex w-[310px] shrink-0 flex-col overflow-hidden border-l border-soft xl:w-[350px]">
            <NotebookStudyPanel notebookId={id} hasContent={hasReadySources} />
          </aside>
        )}
      </div>
    </div>
  )
}
