"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Headphones,
  Loader2,
  MessageSquareText,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react"
import type { Notebook } from "@/lib/notebook/types"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days}d`
  return new Date(dateStr).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
}

export default function NotebooksPage() {
  const router = useRouter()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetch("/api/notebooks")
      .then((response) => response.json())
      .then((data) => { if (Array.isArray(data?.notebooks)) setNotebooks(data.notebooks) })
      .finally(() => setLoading(false))
  }, [])

  const createNotebook = async () => {
    if (creating) return
    setCreating(true)
    try {
      const response = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() || "Nuevo cuaderno" }),
      })
      const data = await response.json()
      if (data?.notebook) router.push(`/notebooks/${data.notebook.id}`)
    } finally {
      setCreating(false)
    }
  }

  const deleteNotebook = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!window.confirm("¿Eliminar este cuaderno? Esta acción es irreversible.")) return
    await fetch(`/api/notebooks/${id}`, { method: "DELETE" })
    setNotebooks((current) => current.filter((notebook) => notebook.id !== id))
  }

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <header className="sticky top-0 z-10 border-b border-soft backdrop-blur-xl" style={{ background: "var(--bg-header)" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-soft bg-card-soft-theme p-2 text-muted2 transition hover:text-main"
              title="Volver al inicio"
            >
              <ArrowLeft size={15} />
            </button>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <NotebookPen size={19} />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-main">Cuaderno EduAI</p>
              <p className="text-[10px] leading-tight text-muted2">Lecturas, papers y conversación basada en fuentes</p>
            </div>
          </div>
          <p className="text-xs text-muted2">{notebooks.length} {notebooks.length === 1 ? "cuaderno" : "cuadernos"}</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-9">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-bold text-main">Mis cuadernos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted2">
              Reúne URLs, papers, PDFs, documentos y textos. Lee el contenido extraído, conversa con citas verificables, toma notas y crea un podcast basado únicamente en tus fuentes.
            </p>
          </div>
          {!showCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              <Plus size={15} /> Nuevo cuaderno
            </button>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: BookOpen, title: "Lectura real", text: "Abre el texto procesado de cada fuente y vuelve al enlace original." },
            { icon: MessageSquareText, title: "Chat con citas", text: "Las respuestas se restringen a las fuentes activas del cuaderno." },
            { icon: Headphones, title: "Notas y podcast", text: "Conserva tus apuntes y genera audio de estudio sin plantillas visuales." },
          ].map((item) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="rounded-2xl border border-soft bg-card-theme p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/8 text-blue-500"><Icon size={17} /></span>
                <p className="mt-3 text-xs font-semibold text-main">{item.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted2">{item.text}</p>
              </article>
            )
          })}
        </section>

        {showCreate && (
          <section className="rounded-2xl border border-blue-500/25 bg-card-theme p-5">
            <p className="text-sm font-semibold text-main">Nuevo cuaderno</p>
            <input
              autoFocus
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void createNotebook()}
              placeholder="Ej.: Propulsión de plasma para CubeSat"
              className="mt-3 w-full rounded-xl border border-soft bg-input-theme px-4 py-2.5 text-sm text-main outline-none focus:border-blue-400"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void createNotebook()}
                disabled={creating}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating && <Loader2 size={14} className="animate-spin" />} Crear y abrir
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewTitle("") }}
                className="rounded-xl bg-card-soft-theme px-4 py-2 text-sm text-muted2"
              >
                Cancelar
              </button>
            </div>
          </section>
        )}

        {loading && <div className="flex justify-center py-14"><Loader2 size={24} className="animate-spin text-blue-500" /></div>}

        {!loading && notebooks.length === 0 && !showCreate && (
          <section className="rounded-3xl border border-dashed border-soft py-16 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-500/8 text-blue-500"><NotebookPen size={28} /></span>
            <p className="mt-4 font-semibold text-main">Todavía no tienes cuadernos</p>
            <p className="mt-2 text-sm text-muted2">Crea uno para reunir y analizar tus primeras fuentes.</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mx-auto mt-5 flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              <Plus size={14} /> Crear cuaderno
            </button>
          </section>
        )}

        {!loading && notebooks.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2">
            {notebooks.map((notebook) => (
              <button
                key={notebook.id}
                type="button"
                onClick={() => router.push(`/notebooks/${notebook.id}`)}
                className="group flex flex-col gap-3 rounded-2xl border border-soft bg-card-theme p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/8 text-blue-500"><NotebookPen size={18} /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-main">{notebook.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted2">{notebook.specialist_role}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => void deleteNotebook(notebook.id, event)}
                    className="rounded-lg p-1 text-muted2 opacity-0 transition hover:bg-red-500/8 hover:text-red-500 group-hover:opacity-100"
                    title="Eliminar cuaderno"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted2">
                  <span className="flex items-center gap-1"><BookOpen size={11} />{(notebook as { notebook_sources?: Array<{ count: number }> }).notebook_sources?.[0]?.count ?? 0} fuentes</span>
                  <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(notebook.updated_at)}</span>
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-soft text-muted2 transition hover:border-blue-400/30 hover:bg-blue-500/4 hover:text-blue-500"
            >
              <Plus size={20} />
              <span className="text-xs font-medium">Nuevo cuaderno</span>
            </button>
          </section>
        )}

        <section className="rounded-2xl border border-blue-500/10 bg-blue-500/[0.025] px-5 py-4 text-sm leading-relaxed text-muted2">
          <span className="font-semibold text-blue-500">Flujo recomendado: </span>
          agrega fuentes → revisa los enlaces → procesa las lecturas → activa las fuentes pertinentes → conversa con citas → registra notas o genera un podcast.
        </section>
      </main>
    </div>
  )
}
