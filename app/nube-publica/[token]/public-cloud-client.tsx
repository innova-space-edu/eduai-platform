"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Check,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  Loader2,
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
import {
  COURSE_OPTIONS,
  MATERIAL_TYPES,
  MAX_REPOSITORY_FILE_SIZE,
  SUBJECT_SUGGESTIONS,
  formatBytes,
  materialTypeLabel,
  normalizeSearch,
  type MaterialType,
  type PreviewKind,
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

const INITIAL_FORM: UploadForm = {
  title: "",
  subject: "",
  educationalLevel: COURSE_OPTIONS[0],
  year: String(new Date().getFullYear()),
  materialType: "guia",
  questionCount: "0",
}

function itemIcon(item: PublicListItem, size = 17) {
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

function Viewer({ detail }: { detail: PublicDetail }) {
  const { item, previewUrl } = detail

  if (item.sourceType === "youtube" && item.youtubeVideoId) {
    return (
      <div className="flex min-h-[520px] items-center justify-center bg-slate-100 p-4 sm:p-8">
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
      <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
        <File size={42} className="text-slate-400" />
        <h2 className="mt-4 text-lg font-black text-slate-900">Vista previa no disponible</h2>
        <p className="mt-2 text-sm text-slate-500">Puedes descargar el archivo con el botón superior.</p>
      </div>
    )
  }

  if (item.previewKind === "pdf" || item.previewKind === "text") {
    return <iframe src={previewUrl} title={item.title} className="min-h-[680px] w-full bg-white" />
  }
  if (item.previewKind === "image") {
    return (
      <div className="flex min-h-[520px] items-center justify-center overflow-auto bg-slate-100 p-5 sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={item.title} className="max-h-[760px] max-w-full rounded-2xl object-contain shadow-xl" />
      </div>
    )
  }
  if (item.previewKind === "video") {
    return <div className="flex min-h-[520px] items-center justify-center bg-slate-100 p-5"><video src={previewUrl} controls className="max-h-[740px] max-w-full rounded-2xl" /></div>
  }
  if (item.previewKind === "audio") {
    return <div className="flex min-h-[520px] flex-col items-center justify-center bg-gradient-to-br from-sky-50 to-violet-50 p-8"><div className="mb-6 rounded-full bg-white p-8 text-violet-600 shadow-lg"><Music2 size={42} /></div><audio src={previewUrl} controls className="w-full max-w-xl" /></div>
  }
  if (item.previewKind === "office") {
    const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`
    return <iframe src={officeUrl} title={item.title} className="min-h-[680px] w-full bg-white" referrerPolicy="no-referrer" />
  }

  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
      <File size={42} className="text-slate-400" />
      <h2 className="mt-4 text-lg font-black text-slate-900">Archivo disponible para descargar</h2>
      <p className="mt-2 text-sm text-slate-500">Este formato necesita una aplicación externa para abrirse.</p>
    </div>
  )
}

export default function PublicCloudClient({ token }: { token: string }) {
  const endpoint = useMemo(() => `/api/repository/public-access/${encodeURIComponent(token)}/items`, [token])
  const [items, setItems] = useState<PublicListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PublicDetail | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState<UploadForm>(INITIAL_FORM)
  const [accessCopied, setAccessCopied] = useState(false)
  const [itemCopied, setItemCopied] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(endpoint, { cache: "no-store" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "No fue posible cargar Nube EduAI.")
      const nextItems = (data.items || []) as PublicListItem[]
      setItems(nextItems)
      setSelectedId((current) => current && nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id || null)
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
    ].join(" ")).includes(query))
  }, [items, search])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, PublicListItem[]>()
    for (const item of filteredItems) {
      if (!groups.has(item.subject)) groups.set(item.subject, [])
      groups.get(item.subject)!.push(item)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "es"))
  }, [filteredItems])

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
    setUploadError("")
    setUploadOpen(true)
  }

  const submitUpload = async (event: FormEvent) => {
    event.preventDefault()
    setUploadError("")
    if (!file) return setUploadError("Selecciona un archivo.")
    if (file.size > MAX_REPOSITORY_FILE_SIZE) return setUploadError("El archivo supera el máximo de 100 MB.")

    setUploading(true)
    const payload = new FormData()
    payload.set("file", file)
    payload.set("title", form.title)
    payload.set("subject", form.subject)
    payload.set("educationalLevel", form.educationalLevel)
    payload.set("year", form.year)
    payload.set("materialType", form.materialType)
    payload.set("questionCount", form.questionCount)

    try {
      const response = await fetch(endpoint, { method: "POST", body: payload })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "No fue posible subir el material.")
      const created = data.item as PublicListItem
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setSelectedId(created.id)
      setUploadOpen(false)
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "No fue posible subir el material.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-violet-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1700px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-blue-200"><Cloud size={23} /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-black">Nube EduAI</h1><p className="truncate text-xs font-medium text-slate-500">Acceso público autorizado · sin registro</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void copyText(window.location.href, "access")} className="hidden items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700 transition hover:bg-indigo-100 sm:flex">{accessCopied ? <Check size={16} /> : <Copy size={16} />}{accessCopied ? "Enlace copiado" : "Compartir acceso"}</button>
            <button type="button" onClick={() => void loadItems()} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100" aria-label="Actualizar"><RefreshCw size={18} /></button>
            <button type="button" onClick={openUpload} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"><Upload size={17} /><span className="hidden sm:inline">Subir material</span></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1700px] gap-4 p-4 lg:grid-cols-[330px_minmax(0,1fr)] sm:p-6">
        <aside className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)] lg:overflow-y-auto">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Acceso público</p><p className="mt-2 text-sm leading-6 text-slate-600">Puedes consultar, descargar, subir y compartir material educativo desde este enlace.</p></div>
          <div className="relative mt-4"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar materiales..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></div>
          <p className="mt-3 px-1 text-xs font-bold text-slate-500">{filteredItems.length} materiales disponibles</p>
          <div className="mt-4 space-y-4">
            {loading ? <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div> : groupedItems.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No se encontraron materiales.</div> : groupedItems.map(([subject, subjectItems]) => (
              <div key={subject}><div className="flex items-center gap-2 px-1 text-xs font-black uppercase tracking-wide text-slate-500"><Folder size={15} className="text-amber-500" />{subject}</div><div className="mt-2 space-y-1.5">{subjectItems.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${selectedId === item.id ? "border-blue-300 bg-blue-50 text-blue-800" : "border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white"}`}><span className="shrink-0">{itemIcon(item)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{item.title}</span><span className="mt-0.5 block truncate text-[11px] text-slate-500">{item.educational_level} · {item.school_year} · {materialTypeLabel(item.material_type)}</span></span></button>)}</div></div>
            ))}
          </div>
        </aside>

        <main className="min-w-0">
          {error && <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" />{error}</div>}
          <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
            {detail ? (
              <>
                <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-blue-600">Material educativo</p><h2 className="mt-1 truncate text-xl font-black">{detail.item.title}</h2><p className="mt-1 text-sm text-slate-500">{detail.item.subject} · {detail.item.educationalLevel} · {detail.item.schoolYear} · {detail.item.materialTypeLabel}{detail.item.fileSizeLabel ? ` · ${detail.item.fileSizeLabel}` : ""}</p></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void copyText(detail.shareUrl, "item")} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-black text-indigo-700 hover:bg-indigo-100">{itemCopied ? <Check size={16} /> : <Share2 size={16} />}{itemCopied ? "Enlace copiado" : "Compartir material"}</button>
                    {detail.item.sourceType === "youtube" && detail.item.youtubeUrl ? <a href={detail.item.youtubeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700"><ExternalLink size={16} />Abrir video</a> : detail.downloadUrl ? <a href={detail.downloadUrl} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700"><Download size={16} />Descargar</a> : null}
                  </div>
                </div>
                {detailLoading ? <div className="flex min-h-[520px] items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-600" /></div> : <Viewer detail={detail} />}
              </>
            ) : detailLoading ? <div className="flex min-h-[620px] items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-600" /></div> : <div className="flex min-h-[620px] flex-col items-center justify-center p-8 text-center"><Cloud size={48} className="text-blue-400" /><h2 className="mt-4 text-xl font-black">Selecciona un material</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Escoge un archivo del panel para visualizarlo, descargarlo o compartirlo.</p></div>}
          </section>
          <footer className="py-6 text-center text-xs font-semibold text-slate-500">Generado por EduAI - Innova Space Education 2026</footer>
        </main>
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-400/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-blue-100 bg-white shadow-2xl shadow-blue-200/60">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-sky-50 to-violet-50 px-6 py-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Acceso público autorizado</p><h2 className="mt-1 text-xl font-black">Subir material educativo</h2><p className="mt-1 text-sm text-slate-500">El material quedará disponible en Nube EduAI.</p></div><button type="button" onClick={() => setUploadOpen(false)} className="rounded-xl bg-white p-2 text-slate-500 shadow-sm ring-1 ring-slate-200"><X size={18} /></button></div>
            <form onSubmit={submitUpload} className="space-y-5 p-6">
              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-5 py-6 text-center transition hover:border-blue-400"><Upload size={25} className="mb-2 text-blue-600" /><span className="text-sm font-black">Seleccionar archivo</span><span className="mt-1 text-xs text-slate-500">Máximo 100 MB. No se permiten ejecutables ni páginas web.</span>{file && <span className="mt-3 max-w-full truncate rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm">{file.name} · {formatBytes(file.size)}</span>}<input type="file" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Título</span><input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>
                <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Asignatura</span><input required list="public-cloud-subjects" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /><datalist id="public-cloud-subjects">{SUBJECT_SUGGESTIONS.map((subject) => <option key={subject} value={subject} />)}</datalist></label>
                <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Curso</span><select value={form.educationalLevel} onChange={(event) => setForm((current) => ({ ...current, educationalLevel: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{COURSE_OPTIONS.map((course) => <option key={course}>{course}</option>)}</select></label>
                <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Año</span><input required type="number" min="1900" max="2200" value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>
                <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Tipo</span><select value={form.materialType} onChange={(event) => setForm((current) => ({ ...current, materialType: event.target.value as MaterialType }))} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{MATERIAL_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Cantidad de preguntas</span><input type="number" min="0" value={form.questionCount} onChange={(event) => setForm((current) => ({ ...current, questionCount: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>
              </div>
              {uploadError && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{uploadError}</div>}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setUploadOpen(false)} disabled={uploading} className="rounded-xl px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-100">Cancelar</button><button type="submit" disabled={uploading} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 disabled:opacity-60">{uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}{uploading ? "Subiendo..." : "Subir material"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
