"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import {
  ArrowLeft, Plus, Trash2, FileText, Image, Mic,
  Layers, ExternalLink, ChevronDown, ChevronUp,
  Calendar, Edit3, Check, X, FolderKanban
} from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Project {
  id: string; name: string; description: string
  color: string; icon: string; created_at: string; updated_at: string
}

interface WorkspaceItem {
  id: string; project_id: string; item_type: string
  title: string; content_text: string; content_url: string
  metadata: Record<string, any>; source_table: string
  source_id: string; created_at: string; updated_at: string
}

// ── Metadatos por tipo ────────────────────────────────────────────────────────
const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  document:   { label: "Documentos",    icon: FileText, color: "#3b82f6" },
  image:      { label: "Imágenes",      icon: Image,    color: "#ec4899" },
  audio:      { label: "Audio",         icon: Mic,      color: "#8b5cf6" },
  ppt:        { label: "Presentaciones",icon: Layers,   color: "#f59e0b" },
  infographic:{ label: "Infografías",   icon: Layers,   color: "#10b981" },
  mindmap:    { label: "Mapas Mentales",icon: Layers,   color: "#06b6d4" },
  timeline:   { label: "Timelines",     icon: Layers,   color: "#f97316" },
  poster:     { label: "Afiches",       icon: Image,    color: "#a855f7" },
  flashcards: { label: "Flashcards",    icon: FileText, color: "#14b8a6" },
  quiz:       { label: "Quiz",          icon: FileText, color: "#22c55e" },
  podcast:    { label: "Podcasts",      icon: Mic,      color: "#f59e0b" },
  chat:       { label: "Sesiones",      icon: FileText, color: "#94a3b8" },
}

const ALL_TYPES = Object.keys(TYPE_META)

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return "ahora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

// ── Modal: agregar ítem manual ────────────────────────────────────────────────
function AddItemModal({
  projectId, color, onClose, onAdd,
}: {
  projectId: string; color: string
  onClose: () => void; onAdd: (item: WorkspaceItem) => void
}) {
  const [title,    setTitle]    = useState("")
  const [type,     setType]     = useState("document")
  const [content,  setContent]  = useState("")
  const [url,      setUrl]      = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const supabase = createClient()

  async function handleAdd() {
    if (!title.trim()) { setError("El título es requerido"); return }
    setLoading(true); setError("")
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error: dbErr } = await supabase
      .from("workspace_items")
      .insert({
        project_id:   projectId,
        user_id:      user.id,
        item_type:    type,
        title:        title.trim(),
        content_text: content.trim(),
        content_url:  url.trim(),
      })
      .select("*")
      .single()

    if (dbErr || !data) { setError("Error guardando el ítem"); setLoading(false); return }
    onAdd(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 animate-fade-in-scale"
        style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-base mb-5">Agregar ítem</h3>

        {/* Tipo */}
        <div className="mb-4">
          <label className="text-gray-500 text-[11px] font-semibold uppercase tracking-widest block mb-2">Tipo</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map(t => {
              const m = TYPE_META[t]; const Icon = m.icon
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all"
                  style={{
                    background:  type === t ? `${m.color}12` : "rgba(255,255,255,0.03)",
                    borderColor: type === t ? `${m.color}35` : "rgba(255,255,255,0.08)",
                    color:       type === t ? m.color : "#6b7280",
                  }}
                >
                  <Icon size={11} /> {m.label.replace(/s$/, "")}
                </button>
              )
            })}
          </div>
        </div>

        {/* Título */}
        <div className="mb-4">
          <label className="text-gray-500 text-[11px] font-semibold uppercase tracking-widest block mb-2">Título</label>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Nombre del ítem..."
            autoFocus
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/40 transition-all"
          />
        </div>

        {/* Contenido / URL */}
        <div className="mb-4">
          <label className="text-gray-500 text-[11px] font-semibold uppercase tracking-widest block mb-2">
            {type === "image" ? "URL de la imagen" : "Contenido o nota (opcional)"}
          </label>
          {type === "image" ? (
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/40 transition-all"
            />
          ) : (
            <textarea
              value={content} onChange={e => setContent(e.target.value)}
              placeholder="Texto, apuntes, descripción..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/40 transition-all resize-none min-h-[80px]"
            />
          )}
        </div>

        {error && <p className="text-red-400 text-xs mb-4">❌ {error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 border border-white/[0.08] hover:bg-white/[0.04] transition-all">
            Cancelar
          </button>
          <button
            onClick={handleAdd} disabled={loading || !title.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
            style={{ background: color, boxShadow: `0 4px 12px ${color}40` }}
          >
            {loading ? "Guardando..." : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkspaceProjectPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const id       = params?.id as string

  const [project,    setProject]    = useState<Project | null>(null)
  const [items,      setItems]      = useState<WorkspaceItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showAdd,    setShowAdd]    = useState(false)
  const [collapsed,  setCollapsed]  = useState<Record<string, boolean>>({})

  // Edición de nombre de proyecto inline
  const [editingName, setEditingName] = useState(false)
  const [nameValue,   setNameValue]   = useState("")

  useEffect(() => {
    if (!id) return
    loadProject()
  }, [id])

  async function loadProject() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data: proj } = await supabase
      .from("projects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle()

    if (!proj) { router.push("/workspace"); return }
    setProject(proj)
    setNameValue(proj.name)

    const { data: its } = await supabase
      .from("workspace_items")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })

    setItems(its || [])
    setLoading(false)
  }

  async function deleteItem(itemId: string) {
    await supabase.from("workspace_items").delete().eq("id", itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  async function saveProjectName() {
    if (!nameValue.trim() || !project) return
    await supabase.from("projects").update({ name: nameValue.trim() }).eq("id", project.id)
    setProject({ ...project, name: nameValue.trim() })
    setEditingName(false)
  }

  // ── Agrupar ítems por tipo ────────────────────────────────────────────────
  const grouped = ALL_TYPES.reduce<Record<string, WorkspaceItem[]>>((acc, type) => {
    const group = items.filter(i => i.item_type === type)
    if (group.length > 0) acc[type] = group
    return acc
  }, {})

  const totalItems = items.length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!project) return null
  const projectColor = project.color || "#4338ca"

  return (
    <div className="min-h-screen bg-gray-950">

      {showAdd && (
        <AddItemModal
          projectId={project.id} color={projectColor}
          onClose={() => setShowAdd(false)}
          onAdd={item => setItems(prev => [item, ...prev])}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/workspace" className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.07] transition-all flex-shrink-0">
            <ArrowLeft size={15} />
          </Link>

          {/* Icono proyecto */}
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: `${projectColor}18`, border: `1px solid ${projectColor}30` }}
          >
            {project.icon}
          </div>

          {/* Nombre editable */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveProjectName(); if (e.key === "Escape") setEditingName(false) }}
                  autoFocus
                  className="bg-transparent border-b text-white font-bold text-sm focus:outline-none flex-1"
                  style={{ borderColor: projectColor }}
                />
                <button onClick={saveProjectName} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                <button onClick={() => setEditingName(false)} className="text-gray-500 hover:text-gray-400"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-white font-bold text-sm leading-tight truncate">{project.name}</h1>
                <button
                  onClick={() => setEditingName(true)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-400 transition-all"
                >
                  <Edit3 size={12} />
                </button>
              </div>
            )}
            <p className="text-gray-600 text-[11px]">
              {totalItems} ítem{totalItems !== 1 ? "s" : ""} · actualizado {timeAgo(project.updated_at || project.created_at)}
            </p>
          </div>

          {/* Agregar ítem */}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all flex-shrink-0"
            style={{ background: projectColor, boxShadow: `0 2px 8px ${projectColor}40` }}
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4">

        {/* Descripción del proyecto */}
        {project.description && (
          <p className="text-gray-500 text-sm leading-relaxed animate-fade-in">{project.description}</p>
        )}

        {/* Empty state */}
        {totalItems === 0 && (
          <div
            className="flex flex-col items-center py-16 rounded-2xl border text-center animate-fade-in"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
              style={{ background: `${projectColor}12`, border: `1px solid ${projectColor}25` }}
            >
              {project.icon}
            </div>
            <p className="text-white font-semibold mb-2">Proyecto vacío</p>
            <p className="text-gray-500 text-sm mb-6 max-w-xs">
              Agrega documentos, imágenes, presentaciones o cualquier material desde aquí o usando el botón "Guardar en proyecto" en otros agentes.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: projectColor }}
            >
              <Plus size={16} /> Agregar primer ítem
            </button>
          </div>
        )}

        {/* Grupos por tipo */}
        {Object.entries(grouped).map(([type, typeItems]) => {
          const meta      = TYPE_META[type] || { label: type, icon: FileText, color: "#6b7280" }
          const Icon      = meta.icon
          const isCollapsed = collapsed[type]

          return (
            <div
              key={type}
              className="rounded-2xl border overflow-hidden animate-fade-in"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              {/* Group header */}
              <button
                onClick={() => setCollapsed(prev => ({ ...prev, [type]: !prev[type] }))}
                className="w-full flex items-center gap-3 px-4 py-3 border-b transition-all"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}25` }}
                >
                  <Icon size={13} style={{ color: meta.color }} />
                </div>
                <span className="text-gray-300 font-semibold text-sm flex-1 text-left">{meta.label}</span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${meta.color}15`, color: meta.color }}
                >
                  {typeItems.length}
                </span>
                {isCollapsed ? <ChevronDown size={14} className="text-gray-600 flex-shrink-0" /> : <ChevronUp size={14} className="text-gray-600 flex-shrink-0" />}
              </button>

              {/* Items list */}
              {!isCollapsed && (
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  {typeItems.map(item => (
                    <div key={item.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-all">

                      {/* Thumbnail si es imagen */}
                      {type === "image" && item.content_url ? (
                        <img
                          src={item.content_url}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white/[0.08]"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${meta.color}10`, border: `1px solid ${meta.color}20` }}
                        >
                          <Icon size={14} style={{ color: meta.color }} />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-200 text-sm font-medium truncate">{item.title}</p>
                        {item.content_text && (
                          <p className="text-gray-600 text-xs mt-0.5 line-clamp-2 leading-relaxed">
                            {item.content_text.slice(0, 120)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-700 text-[10px] flex items-center gap-1">
                            <Calendar size={9} /> {timeAgo(item.created_at)}
                          </span>
                          {item.content_url && (
                            <a
                              href={item.content_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-[10px] text-gray-600 hover:text-blue-400 flex items-center gap-0.5 transition-colors"
                            >
                              <ExternalLink size={9} /> Ver
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 text-gray-600 hover:text-red-400 transition-all"
                        style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)" }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
