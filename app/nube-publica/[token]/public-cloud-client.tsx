"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Home,
  Loader2,
  Maximize2,
  Menu,
  Music2,
  Presentation,
  RefreshCw,
  Search,
  Share2,
  Upload,
  Video,
  X,
  Youtube,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  COURSE_OPTIONS,
  MATERIAL_TYPES,
  MAX_REPOSITORY_FILE_SIZE,
  REPOSITORY_BUCKET,
  formatBytes,
  materialTypeLabel,
  normalizeSearch,
  parseYouTubeVideoId,
  subjectGroupsForCourse,
  type MaterialType,
  type PreviewKind,
  type RepositorySourceType,
} from "@/lib/repository/catalog"

type PublicListItem = {
  id: string
  title: string
  subject: string
  educational_level: string
  school_year: number
  material_type: MaterialType
  question_count: number
  source_type: "file" | "youtube"
  original_file_name: string | null
  mime_type: string | null
  file_size: number | null
  youtube_url: string | null
  youtube_video_id: string | null
  visibility: "public"
  created_at: string
  updated_at: string
}

type PublicDetail = {
  item: {
    id: string
    title: string
    subject: string
    educationalLevel: string
    schoolYear: number
    materialType: MaterialType
    materialTypeLabel: string
    questionCount: number
    sourceType: "file" | "youtube"
    originalFileName: string | null
    mimeType: string | null
    fileSize: number | null
    fileSizeLabel: string
    youtubeUrl: string | null
    youtubeVideoId: string | null
    previewKind: PreviewKind
    createdAt: string
  }
  previewUrl: string
  downloadUrl: string
  shareUrl: string
}

type UploadForm = {
  title: string
  subject: string
  educationalLevel: string
  year: string
  materialType: MaterialType
  questionCount: string
}

type RepositoryTree = Map<string, Map<string, Map<number, Map<MaterialType, PublicListItem[]>>>>

const INITIAL_FORM: UploadForm = {
  title: "",
  subject: "",
  educationalLevel: COURSE_OPTIONS[0],
  year: String(new Date().getFullYear()),
  materialType: "guia",
  questionCount: "0",
}

function buildTree(items: PublicListItem[]): RepositoryTree {
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
        for (const files of yearNode.values()) files.sort((a, b) => a.title.localeCompare(b.title, "es"))
      }
    }
  }

  return new Map([...tree.entries()].sort(([a], [b]) => a.localeCompare(b, "es")))
}

function collectFolderPaths(tree: RepositoryTree) {
  const paths = new Set<string>()
  for (const [subject, levels] of tree) {
    const subjectPath = `subject:${subject}`
    paths.add(subjectPath)
    for (const [level, years] of levels) {
      const levelPath = `${subjectPath}/level:${level}`
      paths.add(levelPath)
      for (const [year, types] of years) {
        const yearPath = `${levelPath}/year:${year}`
        paths.add(yearPath)
        for (const materialType of types.keys()) paths.add(`${yearPath}/type:${materialType}`)
      }
    }
  }
  return paths
}

function itemIcon(item: PublicListItem, size = 15) {
  if (item.source_type === "youtube") return <Youtube size={size} className="text-red-500" />
  const name = item.original_file_name?.toLowerCase() || ""
  const mime = item.mime_type || ""
  if (mime.startsWith("image/")) return <FileImage size={size} className="text-fuchsia-500" />
  if (/\.(xlsx?|ods|csv)$/.test(name)) return <FileSpreadsheet size={size} className="text-emerald-600" />
  if (/\.(pptx?|odp)$/.test(name)) return <Presentation size={size} className="text-orange-500" />
  if (mime.startsWith("video/")) return <Video size={size} className="text-cyan-600" />
  if (mime.startsWith("audio/")) return <Music2 size={size} className="text-violet-600" />
  if (mime === "application/pdf" || mime.startsWith("text/") || /\.(docx?|odt|pdf|txt)$/.test(name)) return <FileText size={size} className="text-blue-600" />
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

function Viewer({ detail }: { detail: PublicDetail }) {
  const { item, previewUrl } = detail

  if (item.sourceType === "youtube" && item.youtubeVideoId) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-slate-100 p-4 sm:p-8">
        <div className="aspect-video w-full max-w-6xl overflow-hidden rounded-2xl bg-black shadow-xl">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.youtubeVideoId}?rel=0`}
            title={item.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center">
        <File size={42} className="text-slate-400" />
        <h2 className="mt-4 text-lg font-black text-slate-900">Vista previa no disponible</h2>
        <p className="mt-2 text-sm text-slate-500">Puedes descargar el archivo con el botón superior.</p>
      </div>
    )
  }

  if (item.previewKind === "pdf" || item.previewKind === "text") return <iframe src={previewUrl} title={item.title} className="h-full min-h-[680px] w-full bg-white" />
  if (item.previewKind === "image") return <div className="flex h-full min-h-[520px] items-center justify-center overflow-auto bg-slate-100 p-5 sm:p-8"><img src={previewUrl} alt={item.title} className="max-h-[760px] max-w-full rounded-2xl object-contain shadow-xl" /></div>
  if (item.previewKind === "video") return <div className="flex h-full min-h-[520px] items-center justify-center bg-black p-5"><video src={previewUrl} controls className="max-h-[740px] max-w-full rounded-2xl" /></div>
  if (item.previewKind === "audio") return <div className="flex h-full min-h-[520px] flex-col items-center justify-center bg-gradient-to-br from-sky-50 to-violet-50 p-8"><div className="mb-6 rounded-full bg-white p-8 text-violet-600 shadow-lg"><Music2 size={42} /></div><audio src={previewUrl} controls className="w-full max-w-xl" /></div>
  if (item.previewKind === "office") {
    const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`
    return <iframe src={officeUrl} title={item.title} className="h-full min-h-[680px] w-full bg-white" referrerPolicy="no-referrer" />
  }

  return (
    <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center">
      <File size={42} className="text-slate-400" />
      <h2 className="mt-4 text-lg font-black text-slate-900">Archivo disponible para descargar</h2>
      <p className="mt-2 text-sm text-slate-500">Este formato necesita una aplicación externa para abrirse.</p>
    </div>
  )
}

export default function PublicCloudClient({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), [])
  const endpoint = useMemo(() => `/api/repository/public-access/${encodeURIComponent(token)}/items`, [token])
  const [items, setItems] = useState<PublicListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PublicDetail | null>(null)
  const [search, setSearch] = useState("")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [uploadMode, setUploadMode] = useState<RepositorySourceType>("file")
  const [file, setFile] = useState<File | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [form, setForm] = useState<UploadForm>(INITIAL_FORM)
  const [accessCopied, setAccessCopied] = useState(false)
  const [itemCopied, setItemCopied] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState("")

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(endpoint, { cache: "no-store" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "No fue posible cargar Nube EduAI.")
      const nextItems = (data.items || []) as PublicListItem[]
      setItems(nextItems)
      setSelectedId((current) => current && nextItems.some((item) => item.id === current) ? current : null)
      const nextTree = buildTree(nextItems)
      setCollapsed((current) => current.size ? current : collectFolderPaths(nextTree))
    } catch (caught) {
      setItems([])
      setSelectedId(null)
      setError(caught instanceof Error ? caught.message : "No fue posible cargar Nube EduAI.")
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => { void loadItems() }, [loadItems])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    let cancelled = false
    const loadDetail = async () => {
      setDetailLoading(true)
      try {
        const response = await fetch(`${endpoint}/${encodeURIComponent(selectedId)}`, { cache: "no-store" })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || "No fue posible abrir el material.")
        if (!cancelled) setDetail(data as PublicDetail)
      } catch (caught) {
        if (!cancelled) {
          setDetail(null)
          setError(caught instanceof Error ? caught.message : "No fue posible abrir el material.")
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    void loadDetail()
    return () => { cancelled = true }
  }, [endpoint, selectedId])

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
  const counts = useMemo(() => ({ files: items.filter((item) => item.source_type === "file").length, videos: items.filter((item) => item.source_type === "youtube").length }), [items])
  const subjectGroups = useMemo(() => subjectGroupsForCourse(form.educationalLevel), [form.educationalLevel])

  const toggleFolder = (path: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const copyText = async (value: string, type: "access" | "item") => {
    try {
      await navigator.clipboard.writeText(value)
      if (type === "access") {
        setAccessCopied(true)
        window.setTimeout(() => setAccessCopied(false), 1800)
      } else {
        setItemCopied(true)
        window.setTimeout(() => setItemCopied(false), 1800)
      }
    } catch {
      setError("No fue posible copiar el enlace. Puedes copiarlo desde la barra del navegador.")
    }
  }

  const openUpload = () => {
    setForm(INITIAL_FORM)
    setFile(null)
    setYoutubeUrl("")
    setUploadMode("file")
    setUploadError("")
    setUploadSuccess("")
    setUploadOpen(true)
  }

  const selectItem = (id: string) => {
    setSelectedId(id)
    setMobileSidebarOpen(false)
  }

  const openFullscreen = () => {
    const viewer = document.getElementById("public-repository-viewer")
    if (viewer?.requestFullscreen) void viewer.requestFullscreen()
  }

  const submitUpload = async (event: FormEvent) => {
    event.preventDefault()
    setUploadError("")
    setUploadSuccess("")

    if (!form.title.trim() || !form.subject.trim() || !form.educationalLevel.trim()) return setUploadError("Completa título, curso y asignatura.")
    if (uploadMode === "file" && !file) return setUploadError("Selecciona un archivo.")
    if (file && file.size > MAX_REPOSITORY_FILE_SIZE) return setUploadError("El archivo supera el máximo de 100 MB.")
    if (uploadMode === "youtube" && !parseYouTubeVideoId(youtubeUrl)) return setUploadError("Ingresa un enlace válido de YouTube.")

    setUploading(true)
    let storagePath = ""
    try {
      if (uploadMode === "youtube") {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "youtube",
            youtubeUrl,
            title: form.title,
            subject: form.subject,
            educationalLevel: form.educationalLevel,
            year: form.year,
            materialType: form.materialType,
            questionCount: form.questionCount,
          }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || "No fue posible registrar el video.")
        const created = data.item as PublicListItem
        setItems((current) => [created, ...current.filter((item) => item.id !== created.id)])
        setSelectedId(created.id)
      } else if (file) {
        const prepareResponse = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "file",
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            year: form.year,
          }),
        })
        const prepared = await prepareResponse.json().catch(() => null)
        if (!prepareResponse.ok) throw new Error(prepared?.error || "No fue posible preparar la carga.")

        storagePath = prepared.storagePath
        const { error: uploadError } = await supabase.storage
          .from(REPOSITORY_BUCKET)
          .uploadToSignedUrl(storagePath, prepared.uploadToken, file, {
            contentType: file.type || "application/octet-stream",
            cacheControl: "3600",
          })
        if (uploadError) throw uploadError

        const finalizeResponse = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            title: form.title,
            subject: form.subject,
            educationalLevel: form.educationalLevel,
            year: form.year,
            materialType: form.materialType,
            questionCount: form.questionCount,
          }),
        })
        const finalized = await finalizeResponse.json().catch(() => null)
        if (!finalizeResponse.ok) throw new Error(finalized?.error || "No fue posible registrar el material.")
        const created = finalized.item as PublicListItem
        setItems((current) => [created, ...current.filter((item) => item.id !== created.id)])
        setSelectedId(created.id)
      }

      setUploadSuccess("Material publicado. Ya está visible en la Nube EduAI pública y también dentro de EduAI para todos los usuarios.")
      window.setTimeout(() => setUploadOpen(false), 850)
    } catch (caught) {
      if (storagePath) {
        void fetch(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        }).catch(() => undefined)
      }
      setUploadError(caught instanceof Error ? caught.message : "No fue posible subir el material.")
    } finally {
      setUploading(false)
    }
  }

  // PUBLIC_CLOUD_DIRECT_UPLOAD_V1

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setMobileSidebarOpen(true)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 sm:hidden" aria-label="Abrir carpetas"><Menu size={19} /></button>
            <button type="button" onClick={() => history.back()} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100" aria-label="Volver"><ArrowLeft size={19} /></button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"><HardDrive size={20} /></div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">Nube EduAI</h1>
              <p className="hidden text-xs text-slate-500 sm:block">Guías, pruebas, presentaciones, imágenes y videos</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={() => void copyText(window.location.href, "access")} className="hidden items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-black text-sky-700 transition hover:bg-sky-100 sm:flex">{accessCopied ? <Check size={16} /> : <Share2 size={16} />}{accessCopied ? "Enlace copiado" : "Compartir acceso"}</button>
            <button type="button" onClick={() => void loadItems()} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100" aria-label="Actualizar"><RefreshCw size={17} /></button>
            <button type="button" onClick={openUpload} className="group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"><Upload size={17} className="transition-transform group-hover:-translate-y-0.5" /><span className="hidden sm:inline">Subir</span></button>
          </div>
        </div>
      </header>

      {mobileSidebarOpen && <button type="button" className="fixed inset-0 top-16 z-20 bg-slate-950/35 sm:hidden" onClick={() => setMobileSidebarOpen(false)} aria-label="Cerrar carpetas" />}

      <div className="flex h-[calc(100vh-4rem)] min-h-[620px] overflow-hidden">
        <aside className={`fixed bottom-0 left-0 top-16 z-30 flex w-80 max-w-[88vw] shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform sm:static sm:z-auto sm:max-w-none sm:translate-x-0 sm:shadow-none ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="border-b border-slate-200 p-3">
            <div className="relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar archivos..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-500"><span>{items.length} materiales</span><span>{counts.files} archivos · {counts.videos} videos</span></div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <button type="button" onClick={() => { setSelectedId(null); setDetail(null); setMobileSidebarOpen(false) }} className={`mb-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${!selectedId ? "border-blue-200 bg-blue-50 text-blue-700" : "border-transparent text-slate-600 hover:bg-slate-100"}`}><Home size={16} /> Inicio de Nube EduAI <ChevronRight size={15} className="ml-auto" /></button>

            {loading ? <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div> : tree.size === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">No se encontraron materiales.</div> : [...tree.entries()].map(([subject, levels]) => {
              const subjectPath = `subject:${subject}`
              const subjectCount = [...levels.values()].reduce((sum, years) => sum + [...years.values()].reduce((yearSum, types) => yearSum + [...types.values()].reduce((typeSum, files) => typeSum + files.length, 0), 0), 0)
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
                              {[...types.entries()].sort(([a], [b]) => materialTypeLabel(a).localeCompare(materialTypeLabel(b), "es")).map(([materialType, files]) => {
                                const typePath = `${yearPath}/type:${materialType}`
                                return (
                                  <TreeFolder key={typePath} path={typePath} label={materialTypeLabel(materialType)} depth={3} collapsed={collapsed} onToggle={toggleFolder} count={files.length}>
                                    <div>{files.map((item) => <button key={item.id} type="button" onClick={() => selectItem(item.id)} className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-xs transition ${selectedId === item.id ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-100"}`} style={{ paddingLeft: `${8 + 4 * 14 + 20}px` }}><span className="shrink-0">{itemIcon(item)}</span><span className="min-w-0 flex-1 truncate">{item.title}</span></button>)}</div>
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
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {error && <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" />{error}</div>}

          {!selectedId ? (
            <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-5 shadow-sm">
              <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-100/50 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="p-8 sm:p-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-xl shadow-blue-200"><HardDrive size={30} /></div>
                  <p className="mt-7 text-xs font-black uppercase tracking-[0.28em] text-blue-600">Tu nube educativa pública</p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Bienvenido a Nube EduAI</h2>
                  <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Consulta y comparte guías, pruebas, planificaciones, presentaciones, imágenes, videos y documentos de estudio. La organización es la misma que dentro de EduAI: asignatura, curso, año, tipo de material y archivo.</p>
                  <button type="button" onClick={openUpload} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"><Upload size={18} /> Subir material público</button>
                  <p className="mt-6 text-sm leading-6 text-slate-500">Todo material subido desde este acceso público se incorpora al mismo catálogo de Nube EduAI y queda disponible para todos los usuarios de EduAI.</p>
                </div>
                <div className="border-t border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50 p-8 sm:p-10 lg:border-l lg:border-t-0">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">Colección pública actual</p>
                  <div className="mt-6 space-y-4">
                    <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm"><strong className="text-3xl font-black text-slate-950">{items.length}</strong><p className="mt-1 text-sm text-slate-500">materiales compartidos</p></div>
                    <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm"><strong className="text-3xl font-black text-slate-950">{counts.files}</strong><p className="mt-1 text-sm text-slate-500">archivos y documentos</p></div>
                    <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm"><strong className="text-3xl font-black text-slate-950">{counts.videos}</strong><p className="mt-1 text-sm text-slate-500">videos enlazados</p></div>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section id="public-repository-viewer" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {detail ? (
                <>
                  <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-blue-600">Material público</p><h2 className="mt-1 truncate text-xl font-black">{detail.item.title}</h2><p className="mt-1 text-sm text-slate-500">{detail.item.subject} · {detail.item.educationalLevel} · {detail.item.schoolYear} · {detail.item.materialTypeLabel}{detail.item.fileSizeLabel ? ` · ${detail.item.fileSizeLabel}` : ""}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void copyText(detail.shareUrl, "item")} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700 hover:bg-indigo-100">{itemCopied ? <Check size={16} /> : <Share2 size={16} />}{itemCopied ? "Copiado" : "Compartir"}</button>
                      <button type="button" onClick={openFullscreen} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Maximize2 size={16} /> Pantalla completa</button>
                      {detail.item.sourceType === "youtube" && detail.item.youtubeUrl ? <a href={detail.item.youtubeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700"><ExternalLink size={16} /> Abrir video</a> : detail.downloadUrl ? <a href={detail.downloadUrl} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700"><Download size={16} /> Descargar</a> : null}
                    </div>
                  </div>
                  {detailLoading ? <div className="flex min-h-[520px] items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-600" /></div> : <Viewer detail={detail} />}
                </>
              ) : detailLoading ? <div className="flex min-h-[620px] items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-600" /></div> : <div className="flex min-h-[620px] flex-col items-center justify-center p-8 text-center"><HardDrive size={48} className="text-blue-400" /><h2 className="mt-4 text-xl font-black">Selecciona un material</h2></div>}
            </section>
          )}
          <footer className="py-5 text-center text-xs font-semibold text-slate-500">Generado por EduAI - Innova Space Education 2026</footer>
        </main>
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="public-upload-title">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
              <div><h2 id="public-upload-title" className="text-lg font-bold text-slate-900">Agregar a Nube EduAI pública</h2><p className="text-xs text-slate-500">Se comparte automáticamente en la nube pública y en Nube EduAI para todos los usuarios.</p></div>
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <form onSubmit={submitUpload} className="space-y-5 p-6">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><strong>Material compartido con todos.</strong> Todo lo que subas aquí queda registrado en el mismo catálogo público de Nube EduAI y aparecerá también dentro de la plataforma para los usuarios autenticados.</div>

              <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                <button type="button" onClick={() => setUploadMode("file")} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${uploadMode === "file" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><Upload size={16} /> Archivo</button>
                <button type="button" onClick={() => setUploadMode("youtube")} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${uploadMode === "youtube" ? "bg-white text-red-600 shadow-sm" : "text-slate-500"}`}><Youtube size={16} /> YouTube</button>
              </div>

              {uploadMode === "file" ? (
                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/40"><Upload size={24} className="mb-2 text-blue-600" /><span className="text-sm font-semibold text-slate-800">Seleccionar archivo</span><span className="mt-1 text-xs text-slate-500">PDF, Word, Excel, PowerPoint, imágenes y otros formatos · máximo 100 MB</span>{file && <span className="mt-3 max-w-full truncate rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">{file.name} · {formatBytes(file.size)}</span>}<input type="file" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
              ) : (
                <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Enlace de YouTube</span><input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100" /></label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Título</span><input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>

                <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Curso</span><select value={form.educationalLevel} onChange={(event) => setForm((current) => ({ ...current, educationalLevel: event.target.value, subject: "" }))} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{COURSE_OPTIONS.map((course) => <option key={course} value={course}>{course}</option>)}</select></label>

                <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Asignatura</span><select required value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"><option value="">Selecciona una asignatura</option>{subjectGroups.map((group) => <optgroup key={group.label} label={group.label}>{group.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</optgroup>)}</select></label>

                <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Año</span><input type="number" min="1900" max="2200" required value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>

                <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de material</span><select value={form.materialType} onChange={(event) => setForm((current) => ({ ...current, materialType: event.target.value as MaterialType }))} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{MATERIAL_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>

                <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cantidad de preguntas <span className="normal-case font-normal">(opcional)</span></span><input type="number" min="0" value={form.questionCount} onChange={(event) => setForm((current) => ({ ...current, questionCount: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>
              </div>

              {uploadError && <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" />{uploadError}</div>}
              {uploadSuccess && <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><Check size={18} className="mt-0.5 shrink-0" />{uploadSuccess}</div>}

              <div className="flex justify-end gap-3"><button type="button" onClick={() => setUploadOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button type="submit" disabled={uploading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50">{uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}{uploading ? "Publicando…" : "Publicar para todos"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
