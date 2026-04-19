"use client"
// app/notebooks/page.tsx
// Lista de cuadernos del usuario

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, BookOpen, Loader2, Trash2, Clock } from "lucide-react"
import type { Notebook } from "@/lib/notebook/types"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)   return "ahora"
  if (min < 60)  return `hace ${min}m`
  const h = Math.floor(min / 60)
  if (h < 24)    return `hace ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)     return `hace ${d}d`
  return new Date(dateStr).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
}

export default function NotebooksPage() {
  const router   = useRouter()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState(false)
  const [newTitle,  setNewTitle]  = useState("")
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetch("/api/notebooks")
      .then((r) => r.json())
      .then((d) => { if (d.notebooks) setNotebooks(d.notebooks) })
      .finally(() => setLoading(false))
  }, [])

  const createNotebook = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res  = await fetch("/api/notebooks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title: newTitle.trim() || "Nuevo cuaderno",
        }),
      })
      const data = await res.json()
      if (data.notebook) {
        router.push(`/notebooks/${data.notebook.id}`)
      }
    } finally {
      setCreating(false)
    }
  }

  const deleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("¿Eliminar este cuaderno? Esta acción es irreversible.")) return
    await fetch(`/api/notebooks/${id}`, { method: "DELETE" })
    setNotebooks((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="flex flex-col min-h-screen bg-app">

      {/* Topbar */}
      <div
        className="border-b border-soft sticky top-0 z-10 backdrop-blur-xl"
        style={{ background: "var(--bg-header)" }}
      >
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📓</span>
            <p className="text-main font-bold text-sm">Notebook Hub</p>
          </div>
          <p className="text-muted2 text-xs">{notebooks.length} cuadernos</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-main mb-2">Mis cuadernos</h1>
            <p className="text-muted2 text-sm leading-relaxed max-w-lg">
              Cada cuaderno es un workspace completo: agrega fuentes, conversa con un especialista y genera materiales desde el contenido real.
            </p>
          </div>

          {/* Botón nuevo */}
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white flex-shrink-0 transition-all"
              style={{ background: "var(--accent-blue)" }}
            >
              <Plus size={15} />
              Nuevo
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && (
          <div
            className="rounded-2xl border p-5 flex flex-col gap-3"
            style={{ background: "var(--bg-card)", borderColor: "rgba(37,99,235,0.25)" }}
          >
            <p className="text-sm font-semibold text-main">Nuevo cuaderno</p>
            <input
              autoFocus
              type="text"
              placeholder="Nombre del cuaderno..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createNotebook()}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                border:     "1px solid var(--border-medium)",
                color:      "var(--text-primary)",
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={createNotebook}
                disabled={creating}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--accent-blue)" }}
              >
                {creating
                  ? <Loader2 size={14} className="animate-spin inline mr-1" />
                  : null
                }
                Crear y abrir
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewTitle("") }}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && notebooks.length === 0 && !showCreate && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📓</p>
            <p className="text-main font-semibold mb-2">No tienes cuadernos aún</p>
            <p className="text-muted2 text-sm mb-6">
              Crea tu primer cuaderno y empieza a explorar tus fuentes con IA.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white mx-auto"
              style={{ background: "var(--accent-blue)" }}
            >
              <Plus size={14} />
              Crear cuaderno
            </button>
          </div>
        )}

        {/* Notebooks grid */}
        {!loading && notebooks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                onClick={() => router.push(`/notebooks/${nb.id}`)}
                className="group flex flex-col gap-3 p-5 rounded-2xl border text-left transition-all"
                style={{
                  background:  "var(--bg-card)",
                  borderColor: "var(--border-soft)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background   = "rgba(37,99,235,0.04)"
                  e.currentTarget.style.borderColor  = "rgba(37,99,235,0.2)"
                  e.currentTarget.style.boxShadow    = "0 4px 16px rgba(37,99,235,0.08)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background   = "var(--bg-card)"
                  e.currentTarget.style.borderColor  = "var(--border-soft)"
                  e.currentTarget.style.boxShadow    = "none"
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: "rgba(37,99,235,0.08)" }}
                    >
                      📓
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-main leading-tight truncate">
                        {nb.title}
                      </p>
                      <p className="text-[11px] text-muted2 truncate mt-0.5">
                        {nb.specialist_role}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => deleteNotebook(nb.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444" }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted2">
                  <span className="flex items-center gap-1">
                    <BookOpen size={11} />
                    {(nb as { notebook_sources?: Array<{ count: number }> }).notebook_sources?.[0]?.count ?? 0} fuentes
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {timeAgo(nb.updated_at)}
                  </span>
                </div>
              </button>
            ))}

            {/* Add new card */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed transition-all min-h-[100px]"
              style={{ borderColor: "var(--border-medium)", color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(37,99,235,0.3)"
                e.currentTarget.style.color       = "var(--accent-blue)"
                e.currentTarget.style.background  = "rgba(37,99,235,0.04)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-medium)"
                e.currentTarget.style.color       = "var(--text-muted)"
                e.currentTarget.style.background  = "transparent"
              }}
            >
              <Plus size={20} />
              <span className="text-xs font-medium">Nuevo cuaderno</span>
            </button>
          </div>
        )}

        {/* Info card */}
        <div
          className="rounded-2xl px-5 py-4 border text-sm text-muted2 leading-relaxed"
          style={{ background: "rgba(37,99,235,0.03)", borderColor: "rgba(37,99,235,0.1)" }}
        >
          <span className="text-blue-400 font-semibold">💡 Flujo recomendado: </span>
          Agrega fuentes → el sistema las procesa →
          conversa con el especialista para entender el contenido →
          genera <strong className="text-sub">infografías</strong>, <strong className="text-sub">mapas mentales</strong>,{" "}
          <strong className="text-sub">quiz</strong> y más desde el Studio.
        </div>
      </div>
    </div>
  )
}
