"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import {
  ArrowLeft, FolderKanban, Plus, Trash2,
  FileText, Image, Mic, PresentationIcon,
  ChevronRight, Calendar, Layers
} from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string
  created_at: string
  updated_at: string
  item_count?: number
}

// ── Iconos y colores predefinidos para nuevos proyectos ───────────────────────
const PROJECT_ICONS  = ["📁","📚","🔬","🎓","💡","🧪","📝","🌍","🎨","🧮","🔭","📊"]
const PROJECT_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#10b981",
  "#f59e0b","#ef4444","#06b6d4","#f97316",
]

const TYPE_ICONS: Record<string, React.ElementType> = {
  document:   FileText,
  image:      Image,
  audio:      Mic,
  ppt:        PresentationIcon,
  infographic:Layers,
  mindmap:    Layers,
  timeline:   Layers,
  poster:     Image,
  flashcards: FileText,
  quiz:       FileText,
  podcast:    Mic,
  chat:       FileText,
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return "ahora"
  if (mins < 60)  return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days}d`
  return new Date(dateStr).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Crear proyecto
// ─────────────────────────────────────────────────────────────────────────────
function CreateProjectModal({
  onClose, onCreate,
}: {
  onClose: () => void
  onCreate: (project: Project) => void
}) {
  const [name,    setName]    = useState("")
  const [desc,    setDesc]    = useState("")
  const [icon,    setIcon]    = useState("📁")
  const [color,   setColor]   = useState("#3b82f6")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const supabase = createClient()

  async function handleCreate() {
    if (!name.trim()) { setError("El nombre es requerido"); return }
    setLoading(true); setError("")
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error: dbError } = await supabase
      .from("projects")
      .insert({ user_id: user.id, name: name.trim(), description: desc.trim(), icon, color })
      .select("*")
      .single()

    if (dbError || !data) { setError("Error creando el proyecto"); setLoading(false); return }
    onCreate(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 animate-fade-in-scale"
        style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-main font-bold text-lg mb-5">Nuevo proyecto</h2>

        {/* Nombre */}
        <div className="mb-4">
          <label className="text-muted2 text-[11px] font-semibold uppercase tracking-widest block mb-2">Nombre</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="Mi proyecto de Física..."
            autoFocus
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all" style={{ background: "var(--bg-input)", border: "1px solid var(--border-medium)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Descripción */}
        <div className="mb-4">
          <label className="text-muted2 text-[11px] font-semibold uppercase tracking-widest block mb-2">Descripción (opcional)</label>
          <input
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Preparación para el examen final..."
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all" style={{ background: "var(--bg-input)", border: "1px solid var(--border-medium)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Icono */}
        <div className="mb-4">
          <label className="text-muted2 text-[11px] font-semibold uppercase tracking-widest block mb-2">Ícono</label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_ICONS.map(ic => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all"
                style={{
                  background:  icon === ic ? `${color}25` : "var(--bg-input)",
                  border:      `1px solid ${icon === ic ? `${color}50` : "var(--border-soft)"}`,
                  transform:   icon === ic ? "scale(1.1)" : "scale(1)",
                }}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="mb-6">
          <label className="text-muted2 text-[11px] font-semibold uppercase tracking-widest block mb-2">Color</label>
          <div className="flex gap-2">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full transition-all"
                style={{
                  background: c,
                  transform:  color === c ? "scale(1.2)" : "scale(1)",
                  boxShadow:  color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
                }}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mb-4">❌ {error}</p>}

        {/* Acciones */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-sub transition-all" style={{ border: "1px solid var(--border-medium)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-main disabled:opacity-40 transition-all" 
            style={{ background: color, boxShadow: `0 4px 16px ${color}40` }}
          >
            {loading ? "Creando..." : "Crear proyecto"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const router   = useRouter()
  const supabase = createClient()

  const [projects,    setProjects]    = useState<Project[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showCreate,  setShowCreate]  = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else loadProjects()
    })
  }, [])

  async function loadProjects() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Cargar proyectos con conteo de ítems
    const { data: projs } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (!projs) { setLoading(false); return }

    // Contar ítems por proyecto
    const withCounts = await Promise.all(
      projs.map(async (p) => {
        const { count } = await supabase
          .from("workspace_items")
          .select("*", { count: "exact", head: true })
          .eq("project_id", p.id)
        return { ...p, item_count: count || 0 }
      })
    )

    setProjects(withCounts)
    setLoading(false)
  }

  async function deleteProject(id: string) {
    await supabase.from("projects").delete().eq("id", id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-app">

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={p => setProjects(prev => [{ ...p, item_count: 0 }, ...prev])}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b backdrop-blur-xl" style={{ background: "var(--bg-header)", borderColor: "var(--border-soft)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all flex-shrink-0 text-sub hover:text-main" style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)" }}
          >
            <ArrowLeft size={15} />
          </Link>
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
            style={{ background: "linear-gradient(135deg, #4338ca, #6366f1)", boxShadow: "0 4px 12px rgba(67,56,202,0.3)" }}
          >
            <FolderKanban size={17} className="text-main" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-main font-bold text-sm leading-tight">Workspace</h1>
            <p className="text-muted2 text-[11px]">{projects.length} proyecto{projects.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #4338ca, #6366f1)", boxShadow: "0 2px 8px rgba(67,56,202,0.3)" }}
          >
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4">

        {/* Intro */}
        <div className="animate-fade-in">
          <h2 className="text-main font-semibold text-lg mb-1">Tus proyectos</h2>
          <p className="text-muted2 text-sm">
            Organiza todo tu trabajo en proyectos. Guarda imágenes, transcripciones, presentaciones y más en un solo lugar.
          </p>
        </div>

        {/* Lista de proyectos */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl skeleton" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div
            className="flex flex-col items-center py-16 rounded-2xl border text-center"
            style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
              style={{ background: "rgba(67,56,202,0.1)", border: "1px solid rgba(67,56,202,0.2)" }}
            >
              📁
            </div>
            <p className="text-main font-semibold mb-2">Sin proyectos aún</p>
            <p className="text-muted2 text-sm mb-6 max-w-xs">
              Crea tu primer proyecto para empezar a organizar imágenes, transcripciones, presentaciones y más.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #4338ca, #6366f1)" }}
            >
              <Plus size={16} /> Crear mi primer proyecto
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 stagger">
            {projects.map(project => (
              <div
                key={project.id}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer animate-fade-in"
                style={{
                  background:   "var(--bg-card-soft)",
                  borderColor:  "var(--bg-card-soft)",
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.background   = `${project.color}08`
                  ;(e.currentTarget as HTMLElement).style.borderColor  = `${project.color}25`
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.background   = "var(--bg-card-soft)"
                  ;(e.currentTarget as HTMLElement).style.borderColor  = "var(--bg-card-soft)"
                }}
                onClick={() => router.push(`/workspace/${project.id}`)}
              >
                {/* Icono del proyecto */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-105"
                  style={{ background: `${project.color}15`, border: `1px solid ${project.color}30` }}
                >
                  {project.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-main font-semibold text-sm leading-tight truncate">{project.name}</p>
                  {project.description && (
                    <p className="text-muted2 text-xs mt-0.5 truncate">{project.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-muted2 text-[11px] flex items-center gap-1">
                      <Layers size={10} /> {project.item_count} ítem{project.item_count !== 1 ? "s" : ""}
                    </span>
                    <span className="text-muted2 text-[11px] flex items-center gap-1">
                      <Calendar size={10} /> {timeAgo(project.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Delete + arrow */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); deleteProject(project.id) }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all text-muted2 hover:text-red-400"
                    style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)" }}
                  >
                    <Trash2 size={12} />
                  </button>
                  <ChevronRight size={16} className="text-muted2 group-hover:text-sub transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tip */}
        {projects.length > 0 && (
          <div
            className="rounded-2xl px-5 py-4 border text-sm text-muted2 animate-fade-in"
            style={{ background: "rgba(67,56,202,0.04)", borderColor: "rgba(67,56,202,0.12)" }}
          >
            <span className="text-indigo-400 font-semibold">💡 Tip: </span>
            Desde cualquier agente (Creator Hub, Audio Lab, Image Studio) puedes guardar tu trabajo en un proyecto con el botón <span className="text-indigo-400">"Guardar en proyecto"</span>.
          </div>
        )}
      </div>
    </div>
  )
}
