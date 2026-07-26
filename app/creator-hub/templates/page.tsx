"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { Download, FileImage, FileText, LoaderCircle, Palette, Presentation, RefreshCw, Trash2, Upload } from "lucide-react"
import { CREATOR_HUB_FORMATS } from "@/components/creator-hub/catalog"

type CreatorTemplate = {
  id: string
  name: string
  fileName?: string | null
  fileKind?: string | null
  formats?: string[]
  accentColor?: string
  secondaryColor?: string
  instructions?: string | null
  imageUrl?: string | null
  fileUrl?: string | null
  updatedAt: string
  isCreatorTemplate?: boolean
  hasVisualPreview?: boolean
}

const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.webp"

function TemplateIcon({ kind }: { kind?: string | null }) {
  if (kind === "image") return <FileImage size={22} />
  if (kind === "presentation") return <Presentation size={22} />
  return <FileText size={22} />
}

export default function CreatorTemplatesPage() {
  const [templates, setTemplates] = useState<CreatorTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [instructions, setInstructions] = useState("")
  const [formats, setFormats] = useState<string[]>(["infographic", "ppt", "poster"])
  const [accentColor, setAccentColor] = useState("#334155")
  const [secondaryColor, setSecondaryColor] = useState("#94a3b8")
  const fileRef = useRef<HTMLInputElement>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/creative-templates", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || "No fue posible cargar las plantillas.")
      setTemplates((payload?.templates || []).filter((template: CreatorTemplate) => template.isCreatorTemplate))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar las plantillas.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadTemplates() }, [loadTemplates])

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null
    setFile(selected)
    if (selected && !name.trim()) setName(selected.name.replace(/\.[^.]+$/, ""))
    setError("")
  }

  const toggleFormat = (id: string) => {
    setFormats((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const uploadTemplate = async () => {
    if (!file) return setError("Selecciona una plantilla antes de guardarla.")
    if (formats.length === 0) return setError("Selecciona al menos un formato.")
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("name", name.trim() || file.name.replace(/\.[^.]+$/, ""))
      form.set("instructions", instructions)
      form.set("formats", JSON.stringify(formats))
      form.set("accentColor", accentColor)
      form.set("secondaryColor", secondaryColor)
      const response = await fetch("/api/creative-templates", { method: "POST", body: form })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || "No fue posible guardar la plantilla.")
      setTemplates((current) => [payload.template, ...current])
      setFile(null)
      setName("")
      setInstructions("")
      if (fileRef.current) fileRef.current.value = ""
      setMessage(payload.template?.hasVisualPreview ? "Plantilla lista para usar como fondo del lienzo." : "Plantilla guardada como referencia de diseño.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible guardar la plantilla.")
    } finally {
      setSaving(false)
    }
  }

  const removeTemplate = async (template: CreatorTemplate) => {
    if (!window.confirm(`¿Eliminar la plantilla “${template.name}”?`)) return
    const response = await fetch(`/api/creative-templates?id=${encodeURIComponent(template.id)}`, { method: "DELETE" })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return setError(payload?.error || "No fue posible eliminar la plantilla.")
    setTemplates((current) => current.filter((item) => item.id !== template.id))
  }

  const actionClass = "inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-sub transition hover:text-main disabled:opacity-35"

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600"><Palette size={14} /> Plantillas</div>
          <h1 className="mt-2 text-xl font-bold text-main sm:text-2xl">Biblioteca visual</h1>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl items-start gap-6 px-5 py-7 sm:px-7 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-soft bg-card-theme p-5 lg:sticky lg:top-24">
          <h2 className="text-base font-bold text-main">Subir plantilla</h2>
          <p className="mt-1 text-xs text-muted2">PDF, PPT, PPTX, DOC, DOCX, PNG, JPG, JPEG o WEBP · máximo 25 MB</p>

          <button type="button" onClick={() => fileRef.current?.click()} className="mt-5 w-full rounded-2xl border-2 border-dashed border-soft p-6 text-center hover:border-slate-500/35">
            <Upload size={26} className="mx-auto text-slate-500" />
            <span className="mt-2 block text-xs font-bold text-main">{file ? file.name : "Seleccionar archivo"}</span>
            <span className="mt-1 block text-[10px] text-muted2">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ACCEPT}</span>
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT} onChange={chooseFile} className="hidden" />

          <label className="mt-4 block"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej: Plantilla Colegio Providencia" className="mt-1.5 w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none" /></label>
          <label className="mt-3 block"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Indicaciones</span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={4} placeholder="Encabezado, pie, tipografía, logo, márgenes o distribución." className="mt-1.5 w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs leading-5 text-main outline-none" /></label>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Color principal</span><div className="mt-1.5 flex items-center gap-2 rounded-xl border border-soft p-2"><input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" /><span className="font-mono text-[10px] text-muted2">{accentColor}</span></div></label>
            <label><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Color secundario</span><div className="mt-1.5 flex items-center gap-2 rounded-xl border border-soft p-2"><input type="color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" /><span className="font-mono text-[10px] text-muted2">{secondaryColor}</span></div></label>
          </div>

          <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted2">Usar en</p><div className="mt-2 flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">{CREATOR_HUB_FORMATS.map((format) => { const active = formats.includes(format.id); return <button key={format.id} type="button" onClick={() => toggleFormat(format.id)} className="rounded-full border px-2.5 py-1.5 text-[10px] font-bold" style={{ borderColor: active ? "rgba(37,99,235,.35)" : "var(--border-soft)", color: active ? "#2563eb" : "var(--text-muted)" }}>{format.icon} {format.label}</button> })}</div></div>

          {error && <div className="mt-4 rounded-xl border border-red-500/25 px-3 py-2 text-xs text-red-500">{error}</div>}
          {message && <div className="mt-4 rounded-xl border border-emerald-500/25 px-3 py-2 text-xs text-emerald-600">{message}</div>}
          <button type="button" onClick={uploadTemplate} disabled={saving || !file} className={`mt-5 w-full justify-center border border-soft ${actionClass}`}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}{saving ? "Procesando plantilla..." : "Guardar plantilla"}</button>
        </section>

        <section className="rounded-3xl border border-soft bg-card-theme p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-main">Mis plantillas</h2><p className="mt-1 text-xs text-muted2">Seleccionables desde los editores compatibles.</p></div><button type="button" onClick={() => void loadTemplates()} className={actionClass} title="Actualizar"><RefreshCw size={14} /> Actualizar</button></div>

          {loading ? <div className="flex min-h-64 items-center justify-center"><LoaderCircle size={28} className="animate-spin text-slate-500" /></div> : templates.length === 0 ? <div className="mt-5 rounded-3xl border border-dashed border-soft p-10 text-center"><Palette size={28} className="mx-auto text-muted2" /><p className="mt-3 text-sm font-bold text-main">No hay plantillas</p></div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{templates.map((template) => <article key={template.id} className="overflow-hidden rounded-3xl border border-soft"><div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-100">{template.imageUrl ? <img src={template.imageUrl} alt={template.name} className="h-full w-full object-cover" /> : <div className="flex flex-col items-center gap-2 text-muted2"><TemplateIcon kind={template.fileKind} /><span className="max-w-[220px] truncate text-[10px] font-bold">{template.fileName}</span></div>}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="truncate text-sm font-bold text-main">{template.name}</h3><p className="mt-1 text-[10px] font-bold" style={{ color: template.imageUrl ? "#059669" : "#64748b" }}>{template.imageUrl ? "Fondo visual listo" : "Archivo de referencia"}</p></div><button type="button" onClick={() => void removeTemplate(template)} className="rounded-lg p-2 text-red-500" title="Eliminar"><Trash2 size={13} /></button></div><p className="mt-2 line-clamp-2 text-[11px] leading-5 text-muted2">{template.instructions || template.fileName}</p><div className="mt-3 flex flex-wrap gap-1">{(template.formats || []).slice(0, 6).map((id) => { const meta = CREATOR_HUB_FORMATS.find((item) => item.id === id); return <span key={id} className="rounded-full border border-soft px-2 py-1 text-[9px] font-semibold text-muted2">{meta?.icon} {meta?.shortLabel || meta?.label || id}</span> })}</div>{template.fileUrl && <a href={template.fileUrl} target="_blank" rel="noreferrer" className={`mt-3 ${actionClass}`}><Download size={12} /> Abrir original</a>}</div></article>)}</div>}
        </section>
      </main>
    </div>
  )
}
