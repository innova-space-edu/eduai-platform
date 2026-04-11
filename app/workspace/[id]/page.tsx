"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import {
  ArrowLeft, Plus, Trash2, FileText, Image, Mic,
  Layers, ExternalLink, Edit3, Check, X, FolderKanban,
  Upload, Bold, Italic, List, Heading2, Save,
  Link2, ChevronDown, ChevronUp, Download, Copy,
  Sparkles, Loader2, FilePlus, ImagePlus, Wand2
} from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Project {
  id: string; name: string; description: string
  color: string; icon: string; created_at: string; updated_at: string
}

interface WorkspaceItem {
  id: string; project_id: string; item_type: string
  title: string; content_text: string; content_url: string
  metadata: Record<string, any>; created_at: string; updated_at: string
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  document:    { label: "Documentos",     icon: FileText, color: "#3b82f6" },
  note:        { label: "Notas",          icon: Edit3,    color: "#8b5cf6" },
  image:       { label: "Imágenes",       icon: Image,    color: "#ec4899" },
  audio:       { label: "Audio",          icon: Mic,      color: "#8b5cf6" },
  file:        { label: "Archivos",       icon: FileText, color: "var(--text-muted)" },
  ppt:         { label: "Presentaciones", icon: Layers,   color: "#f59e0b" },
  infographic: { label: "Infografías",    icon: Layers,   color: "#10b981" },
  mindmap:     { label: "Mapas mentales", icon: Layers,   color: "#06b6d4" },
  link:        { label: "Links",          icon: Link2,    color: "#f97316" },
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "ahora"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ── Editor de texto enriquecido minimalista ───────────────────────────────────
function RichTextEditor({
  value, onChange, placeholder = "Escribe aquí...", minRows = 6,
}: {
  value: string; onChange: (v: string) => void
  placeholder?: string; minRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function wrap(before: string, after: string) {
    const el = ref.current; if (!el) return
    const start = el.selectionStart; const end = el.selectionEnd
    const sel   = value.slice(start, end)
    const next  = value.slice(0, start) + before + sel + after + value.slice(end)
    onChange(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + sel.length)
    }, 0)
  }

  function insertLine(prefix: string) {
    const el = ref.current; if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + prefix.length, start + prefix.length) }, 0)
  }

  const btnClass = "w-7 h-7 flex items-center justify-center rounded-lg text-muted2 hover:text-main transition-all"

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ background: "var(--bg-card-soft)", borderColor: "var(--border-soft)" }}>
        <button onClick={() => wrap("**", "**")} className={btnClass} title="Negrita"><Bold size={13} /></button>
        <button onClick={() => wrap("_", "_")}   className={btnClass} title="Cursiva"><Italic size={13} /></button>
        <div className="w-px h-4 bg-card-soft-theme mx-1" />
        <button onClick={() => insertLine("## ")} className={btnClass} title="Título"><Heading2 size={13} /></button>
        <button onClick={() => insertLine("- ")}  className={btnClass} title="Lista"><List size={13} /></button>
        <div className="w-px h-4 bg-card-soft-theme mx-1" />
        <button onClick={() => wrap("`", "`")}    className={btnClass} title="Código">{"<>"}</button>
      </div>
      {/* Textarea */}
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        className="bg-transparent px-4 py-3 text-sm focus:outline-none resize-y leading-relaxed text-main placeholder:text-muted2"
        style={{ minHeight: `${minRows * 1.6}rem` }}
      />
    </div>
  )
}

// ── Modal para crear ítem ─────────────────────────────────────────────────────
function NewItemModal({
  projectId, color, onClose, onAdd,
}: {
  projectId: string; color: string
  onClose: () => void; onAdd: (item: WorkspaceItem) => void
}) {
  const supabase = createClient()
  const [tab,      setTab]      = useState<"note"|"upload"|"link"|"ai">("note")
  const [title,    setTitle]    = useState("")
  const [content,  setContent]  = useState("")
  const [url,      setUrl]      = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiType,   setAiType]   = useState<"document"|"notes"|"summary">("document")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [file,     setFile]     = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  async function saveItem(type: string, title: string, text: string, url = "", meta: any = {}) {
    const user = await getUser(); if (!user) return
    // Mapeo defensivo: si la tabla aún no tiene el constraint actualizado,
    // 'note' → 'document', 'file' → 'document', 'link' → 'document'
    const DB_TYPE_MAP: Record<string, string> = {
      note: "note", file: "file", link: "link",
      document: "document", image: "image", audio: "audio",
      ppt: "ppt", infographic: "infographic", mindmap: "mindmap",
      timeline: "timeline", poster: "poster", flashcards: "flashcards",
      quiz: "quiz", podcast: "podcast", chat: "chat",
    }
    const dbType = DB_TYPE_MAP[type] || "document"

    const { data, error: dbErr } = await supabase
      .from("workspace_items")
      .insert({
        project_id:   projectId, user_id: user.id,
        item_type:    dbType,
        title:        (title.trim() || text.slice(0, 60).trim() || "Sin título"),
        content_text: text,
        content_url:  url,
        metadata:     { ...meta, originalType: type },
      })
      .select("*").single()

    if (dbErr) {
      // Si falla por constraint (tipos no actualizados), reintentar con 'document'
      if (dbErr.code === "23514" || dbErr.message?.includes("violates check constraint")) {
        const { data: data2, error: dbErr2 } = await supabase
          .from("workspace_items")
          .insert({
            project_id:   projectId, user_id: user.id,
            item_type:    "document",
            title:        (title.trim() || text.slice(0, 60).trim() || "Sin título"),
            content_text: text,
            content_url:  url,
            metadata:     { ...meta, originalType: type },
          })
          .select("*").single()
        if (dbErr2 || !data2) throw new Error(`Error guardando: ${dbErr2?.message || "Error desconocido"}`)
        onAdd(data2); onClose(); return
      }
      throw new Error(`Error guardando: ${dbErr.message}`)
    }
    if (!data) throw new Error("No se recibió respuesta de la base de datos")
    onAdd(data); onClose()
  }

  async function handleNote() {
    if (!title.trim() && !content.trim()) { setError("Escribe algo primero"); return }
    setLoading(true); setError("")
    try { await saveItem("note", title || content.slice(0, 60), content) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleLink() {
    if (!url.trim()) { setError("Ingresa una URL"); return }
    setLoading(true); setError("")
    try { await saveItem("link", title || url, content, url) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleUpload() {
    if (!file) { setError("Selecciona un archivo"); return }
    setLoading(true); setError("")
    try {
      const user = await getUser(); if (!user) throw new Error("No autenticado")
      const path = `workspace/${user.id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from("workspace-files").upload(path, file)
      if (upErr) throw new Error(`Error subiendo archivo: ${upErr.message}`)
      const { data: { publicUrl } } = supabase.storage.from("workspace-files").getPublicUrl(path)
      const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "file"
      await saveItem(type, title || file.name, content, publicUrl, { originalName: file.name, size: file.size, mimeType: file.type })
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleAI() {
    if (!aiPrompt.trim()) { setError("Describe qué quieres generar"); return }
    setLoading(true); setError("")
    try {
      const systemPrompt: Record<string, string> = {
        document: "Crea un documento educativo completo en Markdown sobre el tema solicitado. Usa títulos (##), listas, negrita y ejemplos.",
        notes:    "Crea apuntes de estudio estructurados en Markdown. Incluye: conceptos clave, definiciones, puntos importantes y ejercicios de ejemplo.",
        summary:  "Crea un resumen ejecutivo en Markdown con los puntos más importantes organizados en secciones.",
      }
      const res = await fetch("/api/agents/redactor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: aiPrompt, history: [], systemOverride: systemPrompt[aiType] }),
      })
      const data = await res.json()
      if (!data.text) throw new Error("La IA no generó contenido")
      await saveItem("document", title || aiPrompt.slice(0, 60), data.text)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const TABS = [
    { id: "note",   label: "✍️ Nota",        action: handleNote   },
    { id: "ai",     label: "✨ Con IA",       action: handleAI     },
    { id: "upload", label: "📎 Archivo",      action: handleUpload },
    { id: "link",   label: "🔗 Link",         action: handleLink   },
  ] as const

  const currentAction = TABS.find(t => t.id === tab)?.action || handleNote

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-fade-in"
           style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.1)" }}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-soft">
          <h3 className="text-main font-bold">Añadir al workspace</h3>
          <button onClick={onClose} className="text-muted2 hover:text-main transition-colors"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-soft">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id as any); setError("") }}
              className="flex-1 py-2.5 text-xs font-medium transition-all"
              style={{
                color:        tab === t.id ? "#a78bfa" : "#6b7280",
                borderBottom: tab === t.id ? `2px solid ${color}` : "2px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">

          {/* Título */}
          {(tab === "note" || tab === "link" || tab === "upload") && (
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título (opcional)"
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-all" style={{ background: "var(--bg-input)", border: "1px solid var(--border-medium)", color: "var(--text-primary)" }} />
          )}

          {/* Note */}
          {tab === "note" && (
            <RichTextEditor value={content} onChange={setContent}
              placeholder="Escribe tu nota, apuntes, ideas..." minRows={8} />
          )}

          {/* AI */}
          {tab === "ai" && (
            <>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del documento (opcional)"
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-all" style={{ background: "var(--bg-input)", border: "1px solid var(--border-medium)", color: "var(--text-primary)" }} />
              <div className="flex gap-2">
                {(["document","notes","summary"] as const).map(t => (
                  <button key={t} onClick={() => setAiType(t)}
                    className="flex-1 py-2 rounded-xl border text-xs font-medium transition-all"
                    style={{
                      background:  aiType === t ? "rgba(167,139,250,0.1)" : "var(--bg-card-soft)",
                      borderColor: aiType === t ? "rgba(167,139,250,0.3)" : "var(--border-soft)",
                      color:       aiType === t ? "#a78bfa" : "#6b7280",
                    }}>
                    {t === "document" ? "📄 Documento" : t === "notes" ? "📝 Apuntes" : "⚡ Resumen"}
                  </button>
                ))}
              </div>
              <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={4}
                placeholder="Describe qué quieres que la IA cree. Ej: 'Documento sobre la Segunda Ley de Newton con ejemplos prácticos y ejercicios'"
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none transition-all" style={{ background: "var(--bg-input)", border: "1px solid var(--border-medium)", color: "var(--text-primary)" }} />
            </>
          )}

          {/* Upload */}
          {tab === "upload" && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all"
                style={{
                  borderColor: file ? `${color}50` : "var(--border-medium)",
                  background:  file ? `${color}08` : "var(--bg-card-soft)",
                }}>
                {file ? (
                  <>
                    <p className="text-sub font-medium text-sm">{file.name}</p>
                    <p className="text-muted2 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </>
                ) : (
                  <>
                    <Upload size={28} className="text-muted2 mx-auto mb-2" />
                    <p className="text-sub text-sm">Arrastra o haz clic para seleccionar</p>
                    <p className="text-muted2 text-xs mt-1">PDF, imágenes, audio, Word, etc.</p>
                  </>
                )}
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.mp4,.m4a"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
              </div>
              <p className="text-muted2 text-[11px] mt-2 text-center">
                ⚠️ Requiere bucket "workspace-files" en Supabase Storage
              </p>
            </div>
          )}

          {/* Link */}
          {tab === "link" && (
            <>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-all" style={{ background: "var(--bg-input)", border: "1px solid var(--border-medium)", color: "var(--text-primary)" }} />
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
                placeholder="Descripción o notas sobre este link (opcional)"
                className="w-full bg-card-soft-theme border border-soft rounded-xl px-3 py-2.5 text-sm text-sub placeholder-gray-400 focus:outline-none focus:border-purple-500/40 resize-none transition-all" />
            </>
          )}

          {error && <p className="text-red-400 text-xs px-3 py-2 rounded-xl border border-red-500/20 bg-red-500/[0.08]">{error}</p>}

          <button onClick={currentAction} disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2" 
            style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)`, boxShadow: `0 4px 14px ${color}30` }}>
            {loading ? <><Loader2 size={15} className="animate-spin" /> Procesando...</> : <><Plus size={15} /> Agregar al workspace</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: ver/editar item ────────────────────────────────────────────────────
function ViewItemModal({
  item, color, onClose, onSave, onDelete,
}: {
  item: WorkspaceItem; color: string
  onClose: () => void
  onSave: (updated: WorkspaceItem) => void
  onDelete: (id: string) => void
}) {
  const supabase = createClient()
  const [title,   setTitle]   = useState(item.title)
  const [content, setContent] = useState(item.content_text || "")
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [copied,  setCopied]  = useState(false)

  async function handleSave() {
    setSaving(true)
    const { data } = await supabase.from("workspace_items")
      .update({ title: title.trim(), content_text: content, updated_at: new Date().toISOString() })
      .eq("id", item.id).select("*").single()
    if (data) { onSave(data); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }

  function handleCopy() {
    navigator.clipboard?.writeText(content)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a"); a.href = url
    a.download = `${title.replace(/\s+/g, "_")}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  const isEditable = ["note", "document", "chat", "file"].includes(item.item_type)
  const isImage    = item.item_type === "image" && item.content_url
  const isAudio    = item.item_type === "audio" && item.content_url
  const isLink     = item.item_type === "link"  && item.content_url

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.1)" }}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-soft flex-shrink-0">
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="flex-1 bg-transparent text-main font-bold text-sm focus:outline-none" />
          <div className="flex items-center gap-2">
            <button onClick={handleCopy}   className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all" title="Copiar">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            <button onClick={handleDownload} className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all" title="Descargar">
              <Download size={14} />
            </button>
            <button onClick={() => { onDelete(item.id); onClose() }}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all" title="Eliminar">
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-5">
          {isImage && (
            <img src={item.content_url} alt={item.title}
              className="w-full rounded-2xl object-contain max-h-80 mb-4" />
          )}
          {isAudio && (
            <audio controls className="w-full mb-4 rounded-xl" style={{ accentColor: color }}>
              <source src={item.content_url} />
            </audio>
          )}
          {isLink && (
            <a href={item.content_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl border text-sm transition-all"
              style={{ borderColor: `${color}30`, background: `${color}08`, color }}>
              <ExternalLink size={14} /> {item.content_url}
            </a>
          )}

          {isEditable ? (
            <RichTextEditor value={content} onChange={setContent} minRows={12} />
          ) : (
            content && (
              <div className="rounded-2xl p-4 border border-medium bg-card-soft-theme">
                <pre className="text-sub text-sm whitespace-pre-wrap leading-relaxed font-sans">{content}</pre>
              </div>
            )
          )}
        </div>

        {/* Footer guardar */}
        {isEditable && (
          <div className="px-5 py-3 border-t border-soft flex-shrink-0">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-main transition-all disabled:opacity-50"
              style={{ background: saved ? "#16a34a" : color, boxShadow: `0 2px 10px ${color}30` }}>
              {saving ? <><Loader2 size={13} className="animate-spin" />Guardando...</>
                : saved ? <><Check size={13} />Guardado</> : <><Save size={13} />Guardar cambios</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function WorkspaceProjectPage() {
  const { id }   = useParams() as { id: string }
  const router   = useRouter()
  const supabase = createClient()

  const [loading,     setLoading]     = useState(true)
  const [project,     setProject]     = useState<Project | null>(null)
  const [items,       setItems]       = useState<WorkspaceItem[]>([])
  const [showNew,     setShowNew]     = useState(false)
  const [viewItem,    setViewItem]    = useState<WorkspaceItem | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameValue,   setNameValue]   = useState("")
  const [search,      setSearch]      = useState("")
  const [filter,      setFilter]      = useState("all")

  useEffect(() => { loadProject() }, [id])

  async function loadProject() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data: proj } = await supabase
      .from("projects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle()
    if (!proj) { router.push("/workspace"); return }

    setProject(proj); setNameValue(proj.name)

    const { data: its } = await supabase
      .from("workspace_items").select("*").eq("project_id", id)
      .order("created_at", { ascending: false })
    setItems(its || [])
    setLoading(false)
  }

  async function deleteItem(itemId: string) {
    await supabase.from("workspace_items").delete().eq("id", itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
    setViewItem(null)
  }

  async function saveProjectName() {
    if (!nameValue.trim() || !project) return
    await supabase.from("projects").update({ name: nameValue.trim() }).eq("id", project.id)
    setProject({ ...project, name: nameValue.trim() })
    setEditingName(false)
  }

  // Filtrar items
  const filtered = items.filter(item => {
    const matchSearch = search === "" || item.title.toLowerCase().includes(search.toLowerCase()) || item.content_text?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "all" || item.item_type === filter
    return matchSearch && matchFilter
  })

  // Tipos únicos presentes
  const presentTypes = [...new Set(items.map(i => i.item_type))]

  if (loading) return (
    <div className="min-h-screen bg-app flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-soft border-t-indigo-400 animate-spin" />
    </div>
  )
  if (!project) return null

  const color = project.color || "#4338ca"

  return (
    <div className="min-h-screen bg-app">

      {/* Modales */}
      {showNew && (
        <NewItemModal projectId={project.id} color={color}
          onClose={() => setShowNew(false)}
          onAdd={item => setItems(prev => [item, ...prev])} />
      )}
      {viewItem && (
        <ViewItemModal item={viewItem} color={color}
          onClose={() => setViewItem(null)}
          onSave={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
          onDelete={deleteItem} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/workspace"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-card-soft-theme text-sub hover:text-main transition-all flex-shrink-0">
            <ArrowLeft size={15} />
          </Link>

          {/* Icono */}
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
               style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            {project.icon}
          </div>

          {/* Nombre editable */}
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input value={nameValue} onChange={e => setNameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveProjectName(); if (e.key === "Escape") setEditingName(false) }}
                autoFocus className="flex-1 bg-input-theme border border-medium rounded-xl px-3 py-1.5 text-main text-sm focus:outline-none" />
              <button onClick={saveProjectName} className="text-green-400 hover:text-green-700"><Check size={16} /></button>
              <button onClick={() => setEditingName(false)} className="text-muted2 hover:text-sub"><X size={16} /></button>
            </div>
          ) : (
            <button onClick={() => setEditingName(true)}
              className="flex items-center gap-2 hover:bg-card-soft-theme rounded-xl px-2 py-1 transition-all group flex-1 text-left min-w-0">
              <span className="text-main font-bold text-sm truncate">{project.name}</span>
              <Edit3 size={12} className="text-muted2 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
            </button>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-muted2 text-xs">{items.length} items</span>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, boxShadow: `0 2px 8px ${color}30` }}>
              <Plus size={14} /> Añadir
            </button>
          </div>
        </div>

        {/* Barra de búsqueda y filtros */}
        {items.length > 0 && (
          <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center gap-3">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en el workspace..."
              className="flex-1 bg-card-soft-theme border border-soft rounded-xl px-3 py-2 text-sm text-main placeholder-gray-400 focus:outline-none focus:border-purple-500/30 transition-all"
            />
            <div className="flex gap-1.5 overflow-x-auto">
              <button onClick={() => setFilter("all")}
                className="px-3 py-2 rounded-xl border text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                style={{ background: filter === "all" ? `${color}15` : "var(--bg-card-soft)", borderColor: filter === "all" ? `${color}35` : "var(--border-soft)", color: filter === "all" ? color : "#6b7280" }}>
                Todos ({items.length})
              </button>
              {presentTypes.map(type => {
                const meta = TYPE_META[type]
                if (!meta) return null
                const count = items.filter(i => i.item_type === type).length
                return (
                  <button key={type} onClick={() => setFilter(type)}
                    className="px-3 py-2 rounded-xl border text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                    style={{ background: filter === type ? `${meta.color}15` : "var(--bg-card-soft)", borderColor: filter === type ? `${meta.color}35` : "var(--border-soft)", color: filter === type ? meta.color : "#6b7280" }}>
                    {meta.label} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Empty state */}
        {items.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
                 style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
              {project.icon}
            </div>
            <h3 className="text-main font-bold text-lg">Workspace vacío</h3>
            <p className="text-muted2 text-sm text-center max-w-sm">
              Agrega notas, documentos, imágenes, archivos o genera contenido con IA directamente aquí.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {[
                { icon: Edit3,      label: "Nueva nota" },
                { icon: Wand2,      label: "Generar con IA" },
                { icon: Upload,     label: "Subir archivo" },
                { icon: Link2,      label: "Agregar link" },
              ].map(a => {
                const Icon = a.icon
                return (
                  <button key={a.label} onClick={() => setShowNew(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all"
                    style={{ background: `${color}08`, borderColor: `${color}25`, color }}>
                    <Icon size={14} /> {a.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Grid de items */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => {
              const meta  = TYPE_META[item.item_type] || TYPE_META.document
              const Icon  = meta.icon
              const isImg = item.item_type === "image" && item.content_url

              return (
                <div key={item.id}
                  onClick={() => setViewItem(item)}
                  className="group relative flex flex-col rounded-2xl border cursor-pointer transition-all hover:scale-[1.01]"
                  style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)", minHeight: "120px" }}
                  onMouseEnter={e => { ;(e.currentTarget as HTMLElement).style.background = `${meta.color}08`; (e.currentTarget as HTMLElement).style.borderColor = `${meta.color}25` }}
                  onMouseLeave={e => { ;(e.currentTarget as HTMLElement).style.background = "var(--bg-card-soft)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-card-soft)" }}>

                  {/* Imagen preview */}
                  {isImg ? (
                    <div className="h-32 overflow-hidden rounded-t-2xl">
                      <img src={item.content_url} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="px-4 pt-4 pb-2 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                           style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}25` }}>
                        <Icon size={15} style={{ color: meta.color }} />
                      </div>
                    </div>
                  )}

                  <div className={`flex-1 px-4 ${isImg ? "pt-2" : "pt-0"} pb-4`}>
                    <p className="text-main text-sm font-semibold leading-snug mb-1 line-clamp-2">{item.title}</p>
                    {item.content_text && !isImg && (
                      <p className="text-muted2 text-xs leading-relaxed line-clamp-3">{item.content_text}</p>
                    )}
                    {item.content_url && item.item_type === "link" && (
                      <p className="text-blue-400 text-xs truncate mt-1">{item.content_url}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between px-4 pb-3">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: `${meta.color}12`, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-muted2 text-[10px]">{timeAgo(item.updated_at || item.created_at)}</span>
                  </div>

                  {/* Botón eliminar en hover */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }}
                    title="Eliminar">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Sin resultados */}
        {items.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted2 text-sm">Sin resultados para "{search}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
