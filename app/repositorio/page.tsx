"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  LibraryBig,
  Link2,
  Loader2,
  Maximize2,
  Menu,
  Music2,
  Presentation,
  RefreshCw,
  Search,
  Upload,
  Video,
  X,
  Youtube,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  LEVEL_SUGGESTIONS,
  MATERIAL_TYPES,
  MAX_REPOSITORY_FILE_SIZE,
  REPOSITORY_BUCKET,
  SUBJECT_SUGGESTIONS,
  formatBytes,
  getPreviewKind,
  materialTypeLabel,
  normalizeSearch,
  normalizeStorageName,
  parseYouTubeVideoId,
  type MaterialType,
  type RepositoryFormValues,
  type RepositoryItem,
  type RepositorySourceType,
} from "@/lib/repository/catalog"

const CURRENT_YEAR = new Date().getFullYear()

const INITIAL_FORM: RepositoryFormValues = {
  title: "",
  subject: "",
  educationalLevel: "",
  year: String(CURRENT_YEAR),
  materialType: "guia",
  questionCount: "0",
}

type RepositoryTree = Map<string, Map<string, Map<number, Map<MaterialType, RepositoryItem[]>>>>

type UploadDialogProps = {
  open: boolean
  onClose: () => void
  onCreated: (item: RepositoryItem) => void
  userId: string
}

function buildTree(items: RepositoryItem[]): RepositoryTree {
  const tree: RepositoryTree = new Map()

  for (const item of items) {
    if (!tree.has(item.subject)) tree.set(item.subject, new Map())
    const subjectNode = tree.get(item.subject)!
    if (!subjectNode.has(item.educational_level)) subjectNode.set(item.educational_level, new Map())
    const levelNode = subjectNode.get(item.educational_level)!
    if (!levelNode.has(item.school_year)) levelNode.set(item.school_year, new Map())
    const yearNode = levelNode.get(item.school_year)!
    if (!yearNode.has(item.material_type)) yearNode.set(item.material_type, [])
    yearNode.get(item.material_type)!.push(item)
  }

  for (const subjectNode of tree.values()) {
    for (const levelNode of subjectNode.values()) {
      for (const yearNode of levelNode.values()) {
        for (const files of yearNode.values()) {
          files.sort((a, b) => a.title.localeCompare(b.title, "es"))
        }
      }
    }
  }

  return new Map([...tree.entries()].sort(([a], [b]) => a.localeCompare(b, "es")))
}

function fileIcon(item: RepositoryItem, size = 15) {
  if (item.source_type === "youtube") return <Youtube size={size} className="text-red-500" />
  const previewKind = getPreviewKind(item)
  if (previewKind === "image") return <FileImage size={size} className="text-fuchsia-500" />
  if (previewKind === "office") {
    const name = item.original_file_name?.toLowerCase() || ""
    if (name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".ods")) return <FileSpreadsheet size={size} className="text-emerald-600" />
    if (name.endsWith(".ppt") || name.endsWith(".pptx") || name.endsWith(".odp")) return <Presentation size={size} className="text-orange-500" />
  }
  if (previewKind === "video") return <Video size={size} className="text-cyan-600" />
  if (previewKind === "pdf" || previewKind === "text" || previewKind === "office") return <FileText size={size} className="text-blue-600" />
  return <File size={size} className="text-slate-500" />
}

function TreeFolder({
  path,
  label,
  depth,
  collapsed,
  onToggle,
  count,
  children,
}: {
  path: string
  label: string
  depth: number
  collapsed: Set<string>
  onToggle: (path: string) => void
  count: number
  children: React.ReactNode
}) {
  const isOpen = !collapsed.has(path)
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(path)}
        className="flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-xs transition-colors hover:bg-slate-100/80"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {isOpen ? <ChevronDown size={13} className="shrink-0 text-slate-400" /> : <ChevronRight size={13} className="shrink-0 text-slate-400" />}
        {isOpen ? <FolderOpen size={15} className="shrink-0 text-amber-500" /> : <Folder size={15} className="shrink-0 text-amber-500" />}
        <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{label}</span>
        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{count}</span>
      </button>
      {isOpen && children}
    </div>
  )
}

function UploadDialog({ open, onClose, onCreated, userId }: UploadDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [mode, setMode] = useState<RepositorySourceType>("file")
  const [form, setForm] = useState<RepositoryFormValues>(INITIAL_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setMode("file")
    setForm(INITIAL_FORM)
    setFile(null)
    setYoutubeUrl("")
    setError("")
  }, [open])

  if (!open) return null

  const updateForm = <K extends keyof RepositoryFormValues>(key: K, value: RepositoryFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError("")

    const title = form.title.trim()
    const subject = form.subject.trim()
    const educationalLevel = form.educationalLevel.trim()
    const year = Number.parseInt(form.year, 10)
    const questionCount = Number.parseInt(form.questionCount || "0", 10)

    if (!title || !subject || !educationalLevel) {
      setError("Completa título, asignatura y nivel educativo.")
      return
    }
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      setError("Ingresa un año válido.")
      return
    }
    if (!Number.isInteger(questionCount) || questionCount < 0) {
      setError("La cantidad de preguntas debe ser 0 o un número mayor.")
      return
    }
    if (mode === "file" && !file) {
      setError("Selecciona un archivo para subir.")
      return
    }
    if (file && file.size > MAX_REPOSITORY_FILE_SIZE) {
      setError("El archivo supera el máximo permitido de 100 MB.")
      return
    }

    const youtubeId = mode === "youtube" ? parseYouTubeVideoId(youtubeUrl) : null
    if (mode === "youtube" && !youtubeId) {
      setError("Ingresa un enlace válido de YouTube.")
      return
    }

    setSubmitting(true)
    let uploadedPath: string | null = null

    try {
      if (mode === "file" && file) {
        const safeName = normalizeStorageName(file.name)
        uploadedPath = `${userId}/${year}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from(REPOSITORY_BUCKET)
          .upload(uploadedPath, file, {
            cacheControl: "3600",
            contentType: file.type || "application/octet-stream",
            upsert: false,
          })
        if (uploadError) throw uploadError
      }

      const backup = {
        schema_version: 1,
        visibility: "public",
        title,
        subject,
        educational_level: educationalLevel,
        school_year: year,
        material_type: form.materialType,
        question_count: questionCount,
        source_type: mode,
        file: mode === "file" && file ? {
          bucket: REPOSITORY_BUCKET,
          storage_path: uploadedPath,
          original_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size: file.size,
        } : null,
        youtube: mode === "youtube" ? {
          url: youtubeUrl.trim(),
          video_id: youtubeId,
        } : null,
      }

      const payload = {
        title,
        subject,
        educational_level: educationalLevel,
        school_year: year,
        material_type: form.materialType,
        question_count: questionCount,
        source_type: mode,
        storage_path: uploadedPath,
        original_file_name: mode === "file" ? file?.name || null : null,
        mime_type: mode === "file" ? file?.type || "application/octet-stream" : null,
        file_size: mode === "file" ? file?.size || null : null,
        youtube_url: mode === "youtube" ? youtubeUrl.trim() : null,
        youtube_video_id: youtubeId,
        visibility: "public" as const,
        metadata: backup,
        created_by: userId,
      }

      const { data, error: insertError } = await supabase
        .from("repository_items")
        .insert(payload)
        .select("*")
        .single()

      if (insertError) throw insertError
      onCreated(data as RepositoryItem)
      onClose()
    } catch (caught) {
      if (uploadedPath) {
        await supabase.storage.from(REPOSITORY_BUCKET).remove([uploadedPath])
      }
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el material.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="repository-upload-title">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 id="repository-upload-title" className="text-lg font-bold text-slate-900">Agregar al repositorio</h2>
            <p className="text-xs text-slate-500">Los materiales serán públicos para usuarios de EduAI.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6">
          <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <button type="button" onClick={() => setMode("file")} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === "file" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
              <Upload size={16} /> Archivo
            </button>
            <button type="button" onClick={() => setMode("youtube")} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === "youtube" ? "bg-white text-red-600 shadow-sm" : "text-slate-500"}`}>
              <Youtube size={16} /> YouTube
            </button>
          </div>

          {mode === "file" ? (
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/40">
              <Upload size={24} className="mb-2 text-blue-600" />
              <span className="text-sm font-semibold text-slate-800">Seleccionar archivo</span>
              <span className="mt-1 text-xs text-slate-500">PDF, Word, Excel, PowerPoint, imágenes y otros formatos · máximo 100 MB</span>
              {file && <span className="mt-3 max-w-full truncate rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">{file.name} · {formatBytes(file.size)}</span>}
              <input type="file" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Enlace de YouTube</span>
              <div className="relative">
                <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100" />
              </div>
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Título</span>
              <input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Asignatura</span>
              <input required list="repository-subjects" value={form.subject} onChange={(event) => updateForm("subject", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              <datalist id="repository-subjects">{SUBJECT_SUGGESTIONS.map((subject) => <option key={subject} value={subject} />)}</datalist>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nivel educativo</span>
              <input required list="repository-levels" value={form.educationalLevel} onChange={(event) => updateForm("educationalLevel", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              <datalist id="repository-levels">{LEVEL_SUGGESTIONS.map((level) => <option key={level} value={level} />)}</datalist>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Año</span>
              <input required type="number" min="1900" max="2200" value={form.year} onChange={(event) => updateForm("year", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</span>
              <select value={form.materialType} onChange={(event) => updateForm("materialType", event.target.value as MaterialType)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                {MATERIAL_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cantidad de preguntas</span>
              <input required type="number" min="0" value={form.questionCount} onChange={(event) => updateForm("questionCount", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={submitting} className="flex min-w-36 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : mode === "file" ? <Upload size={16} /> : <Youtube size={16} />}
              {submitting ? "Guardando..." : mode === "file" ? "Subir archivo" : "Agregar video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RepositoryPreview({ item, signedUrl, loadingUrl, urlError }: { item: RepositoryItem | null; signedUrl: string; loadingUrl: boolean; urlError: string }) {
  if (!item) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
          <HardDrive size={36} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Selecciona un material</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Abre una carpeta del panel izquierdo y selecciona un archivo o video para visualizarlo aquí.</p>
      </div>
    )
  }

  if (item.source_type === "youtube" && item.youtube_video_id) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center bg-slate-950 p-4 sm:p-8">
        <div className="aspect-video w-full max-w-6xl overflow-hidden rounded-2xl bg-black shadow-2xl">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.youtube_video_id}?rel=0`}
            title={item.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    )
  }

  if (loadingUrl) {
    return <div className="flex h-full min-h-[480px] items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  }

  if (!signedUrl || urlError) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={36} className="mb-3 text-amber-500" />
        <h2 className="text-lg font-bold text-slate-900">No se pudo abrir la vista previa</h2>
        <p className="mt-2 max-w-lg text-sm text-slate-500">{urlError || "El archivo no está disponible en este momento."}</p>
      </div>
    )
  }

  const kind = getPreviewKind(item)

  if (kind === "pdf" || kind === "text") {
    return <iframe src={signedUrl} title={item.title} className="h-full min-h-[640px] w-full bg-white" />
  }

  if (kind === "image") {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center overflow-auto bg-slate-100 p-5 sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signedUrl} alt={item.title} className="max-h-full max-w-full rounded-xl object-contain shadow-xl" />
      </div>
    )
  }

  if (kind === "video") {
    return <div className="flex h-full min-h-[480px] items-center justify-center bg-black p-4"><video src={signedUrl} controls className="max-h-full max-w-full" /></div>
  }

  if (kind === "audio") {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-white text-blue-600 shadow-xl"><Music2 size={42} /></div>
        <audio src={signedUrl} controls className="w-full max-w-xl" />
      </div>
    )
  }

  if (kind === "office") {
    const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`
    return <iframe src={officeUrl} title={item.title} className="h-full min-h-[640px] w-full bg-white" referrerPolicy="no-referrer" />
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col items-center justify-center p-8 text-center">
      <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">{fileIcon(item, 42)}</div>
      <h2 className="text-lg font-bold text-slate-900">Vista previa no disponible</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Este formato se conservó sin modificaciones. Puedes abrirlo con su aplicación correspondiente.</p>
      <a href={signedUrl} download={item.original_file_name || item.title} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700">
        <Download size={16} /> Descargar archivo
      </a>
    </div>
  )
}

export default function RepositoryPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState("")
  const [items, setItems] = useState<RepositoryItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [signedUrl, setSignedUrl] = useState("")
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [urlError, setUrlError] = useState("")

  const loadItems = useCallback(async () => {
    setLoadError("")
    const { data, error } = await supabase
      .from("repository_items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000)

    if (error) {
      setLoadError(error.message)
      setItems([])
      return
    }

    const nextItems = (data || []) as RepositoryItem[]
    setItems(nextItems)
    setSelectedId((current) => current && nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id || null)
  }, [supabase])

  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }
      setUserId(user.id)
      await loadItems()
      setLoading(false)
    }
    void initialize()
  }, [loadItems, router, supabase])

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(search)
    if (!query) return items
    return items.filter((item) => normalizeSearch([
      item.title,
      item.subject,
      item.educational_level,
      String(item.school_year),
      materialTypeLabel(item.material_type),
      item.original_file_name || "",
    ].join(" ")).includes(query))
  }, [items, search])

  const tree = useMemo(() => buildTree(filteredItems), [filteredItems])
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId])

  useEffect(() => {
    let cancelled = false
    const createUrl = async () => {
      setSignedUrl("")
      setUrlError("")
      if (!selectedItem || selectedItem.source_type !== "file" || !selectedItem.storage_path) return
      setLoadingUrl(true)
      const { data, error } = await supabase.storage
        .from(REPOSITORY_BUCKET)
        .createSignedUrl(selectedItem.storage_path, 60 * 60)
      if (cancelled) return
      if (error) setUrlError(error.message)
      else setSignedUrl(data.signedUrl)
      setLoadingUrl(false)
    }
    void createUrl()
    return () => { cancelled = true }
  }, [selectedItem, supabase])

  const toggleFolder = (path: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const onCreated = (item: RepositoryItem) => {
    setItems((current) => [item, ...current])
    setSelectedId(item.id)
  }

  const openFullscreen = () => {
    const viewer = document.getElementById("repository-viewer")
    if (viewer?.requestFullscreen) void viewer.requestFullscreen()
  }

  const counts = useMemo(() => ({ files: items.filter((item) => item.source_type === "file").length, videos: items.filter((item) => item.source_type === "youtube").length }), [items])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setMobileSidebarOpen(true)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:hidden" aria-label="Abrir carpetas"><Menu size={19} /></button>
            <Link href="/dashboard" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Volver al panel"><ArrowLeft size={19} /></Link>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"><HardDrive size={20} /></div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">Repositorio EduAI</h1>
              <p className="hidden text-xs text-slate-500 sm:block">Guías, pruebas, presentaciones, imágenes y videos</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/biblioteca" className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 sm:flex"><LibraryBig size={16} /> Biblioteca</Link>
            <button type="button" onClick={() => void loadItems()} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Actualizar"><RefreshCw size={17} /></button>
            <button type="button" onClick={() => setUploadOpen(true)} className="group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
              <Upload size={17} className="transition-transform group-hover:-translate-y-0.5" />
              <span className="hidden sm:inline">Subir</span>
            </button>
          </div>
        </div>
      </header>

      {mobileSidebarOpen && <button type="button" className="fixed inset-0 top-16 z-20 bg-slate-950/35 sm:hidden" onClick={() => setMobileSidebarOpen(false)} aria-label="Cerrar carpetas" />}

      <div className="flex h-[calc(100vh-4rem)] min-h-[620px] overflow-hidden">
        <aside className={`fixed bottom-0 left-0 top-16 z-30 flex w-80 max-w-[88vw] shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform sm:static sm:z-auto sm:max-w-none sm:translate-x-0 sm:shadow-none ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="border-b border-slate-200 p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar archivos..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />
              {search && <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200"><X size={13} /></button>}
            </div>
            <div className="mt-3 flex items-center justify-between px-1 text-[11px] font-medium text-slate-500">
              <span>{filteredItems.length} materiales</span>
              <span>{counts.files} archivos · {counts.videos} videos</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 size={22} className="animate-spin text-blue-600" /></div>
            ) : loadError ? (
              <div className="m-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
                <strong className="block">No se pudo cargar el repositorio.</strong>
                {loadError}
              </div>
            ) : tree.size === 0 ? (
              <div className="px-4 py-10 text-center text-xs leading-5 text-slate-500">{search ? "No se encontraron materiales." : "Aún no hay materiales. Usa el botón Subir para agregar el primero."}</div>
            ) : (
              [...tree.entries()].map(([subject, levels]) => {
                const subjectPath = `subject:${subject}`
                const subjectCount = [...levels.values()].reduce((total, years) => total + [...years.values()].reduce((sum, types) => sum + [...types.values()].reduce((typeSum, files) => typeSum + files.length, 0), 0), 0)
                return (
                  <TreeFolder key={subjectPath} path={subjectPath} label={subject} depth={0} collapsed={collapsed} onToggle={toggleFolder} count={subjectCount}>
                    {[...levels.entries()].sort(([a], [b]) => a.localeCompare(b, "es")).map(([level, years]) => {
                      const levelPath = `${subjectPath}/level:${level}`
                      const levelCount = [...years.values()].reduce((sum, types) => sum + [...types.values()].reduce((typeSum, files) => typeSum + files.length, 0), 0)
                      return (
                        <TreeFolder key={levelPath} path={levelPath} label={level} depth={1} collapsed={collapsed} onToggle={toggleFolder} count={levelCount}>
                          {[...years.entries()].sort(([a], [b]) => b - a).map(([year, types]) => {
                            const yearPath = `${levelPath}/year:${year}`
                            const yearCount = [...types.values()].reduce((sum, files) => sum + files.length, 0)
                            return (
                              <TreeFolder key={yearPath} path={yearPath} label={String(year)} depth={2} collapsed={collapsed} onToggle={toggleFolder} count={yearCount}>
                                {[...types.entries()].sort(([a], [b]) => materialTypeLabel(a).localeCompare(materialTypeLabel(b), "es")).map(([type, typeItems]) => {
                                  const typePath = `${yearPath}/type:${type}`
                                  return (
                                    <TreeFolder key={typePath} path={typePath} label={materialTypeLabel(type)} depth={3} collapsed={collapsed} onToggle={toggleFolder} count={typeItems.length}>
                                      {typeItems.map((item) => (
                                        <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setMobileSidebarOpen(false) }} title={item.title} className={`flex w-full items-center gap-2 rounded-lg py-2 pr-2 text-left text-xs transition ${selectedId === item.id ? "bg-blue-50 font-semibold text-blue-700 ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-100"}`} style={{ paddingLeft: "72px" }}>
                                          <span className="shrink-0">{fileIcon(item)}</span>
                                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                        </button>
                                      ))}
                                    </TreeFolder>
                                  )
                                })}
                              </TreeFolder>
                            )
                          })}
                        </TreeFolder>
                      )
                    })}
                  </TreeFolder>
                )
              })
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-slate-100 p-3 sm:p-4">
          <section id="repository-viewer" className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {selectedItem && (
              <div className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">{fileIcon(selectedItem, 20)}</div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">{selectedItem.title}</h2>
                    <p className="truncate text-xs text-slate-500">{selectedItem.subject} · {selectedItem.educational_level} · {selectedItem.school_year} · {materialTypeLabel(selectedItem.material_type)} · {selectedItem.question_count} preguntas</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {selectedItem.source_type === "youtube" && selectedItem.youtube_url && (
                    <a href={selectedItem.youtube_url} target="_blank" rel="noreferrer" className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-red-600" aria-label="Abrir en YouTube"><ExternalLink size={17} /></a>
                  )}
                  {selectedItem.source_type === "file" && signedUrl && (
                    <a href={signedUrl} download={selectedItem.original_file_name || selectedItem.title} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600" aria-label="Descargar"><Download size={17} /></a>
                  )}
                  <button type="button" onClick={openFullscreen} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Pantalla completa"><Maximize2 size={17} /></button>
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-auto">
              <RepositoryPreview item={selectedItem} signedUrl={signedUrl} loadingUrl={loadingUrl} urlError={urlError} />
            </div>
          </section>
        </main>
      </div>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={onCreated} userId={userId} />
    </div>
  )
}
