"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Download, ExternalLink, FileText, HardDrive, Loader2 } from "lucide-react"

type SharedItem = {
  id: string
  title: string
  subject: string
  educationalLevel: string
  schoolYear: number
  materialType: string
  materialTypeLabel: string
  questionCount: number
  sourceType: "file" | "youtube"
  originalFileName: string | null
  mimeType: string | null
  fileSize: number | null
  fileSizeLabel: string
  youtubeUrl: string | null
  youtubeVideoId: string | null
  previewKind: "pdf" | "image" | "video" | "audio" | "office" | "text" | "youtube" | "download"
}

type SharedPayload = {
  item: SharedItem
  previewUrl: string
  downloadUrl: string
}

function MaterialPreview({ data }: { data: SharedPayload }) {
  const { item, previewUrl } = data

  if (item.previewKind === "youtube" && item.youtubeVideoId) {
    return (
      <div className="flex min-h-[520px] items-center justify-center bg-slate-100 p-4 sm:p-8">
        <div className="aspect-video w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.youtubeVideoId}?rel=0`}
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

  if (!previewUrl) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600"><FileText size={34} /></div>
        <h2 className="mt-5 text-xl font-black text-slate-900">Vista previa no disponible</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">El archivo se puede descargar desde el botón superior.</p>
      </div>
    )
  }

  if (item.previewKind === "pdf" || item.previewKind === "text") {
    return <iframe src={previewUrl} title={item.title} className="h-[72vh] min-h-[620px] w-full bg-white" />
  }

  if (item.previewKind === "image") {
    return (
      <div className="flex min-h-[620px] items-center justify-center overflow-auto bg-gradient-to-br from-slate-50 via-blue-50/60 to-violet-50/60 p-5 sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={item.title} className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-slate-200" />
      </div>
    )
  }

  if (item.previewKind === "video") {
    return <div className="flex min-h-[620px] items-center justify-center bg-slate-100 p-5"><video src={previewUrl} controls className="max-h-[78vh] max-w-full rounded-2xl bg-white shadow-xl" /></div>
  }

  if (item.previewKind === "audio") {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-violet-50 p-8">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-blue-600 shadow-xl"><HardDrive size={42} /></div>
        <audio src={previewUrl} controls className="mt-7 w-full max-w-2xl" />
      </div>
    )
  }

  if (item.previewKind === "office") {
    const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`
    return <iframe src={officeUrl} title={item.title} className="h-[72vh] min-h-[620px] w-full bg-white" referrerPolicy="no-referrer" />
  }

  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-50 text-blue-600"><FileText size={40} /></div>
      <h2 className="mt-5 text-xl font-black text-slate-900">Archivo disponible para descargar</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Este formato se conserva sin modificaciones y puede abrirse con su aplicación correspondiente.</p>
    </div>
  )
}

export default function SharedMaterialViewer({ token }: { token: string }) {
  const [data, setData] = useState<SharedPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/repository/public/${encodeURIComponent(token)}`, { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || "No fue posible abrir el material compartido.")
        if (!cancelled) setData(payload as SharedPayload)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "No fue posible abrir el material compartido.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [token])

  const subtitle = useMemo(() => {
    if (!data) return ""
    const item = data.item
    return [item.subject, item.educationalLevel, String(item.schoolYear), item.materialTypeLabel].filter(Boolean).join(" · ")
  }, [data])

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-violet-50 text-slate-900">
      <header className="border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-blue-200"><HardDrive size={21} /></div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black">Nube EduAI</p>
              <p className="truncate text-xs text-slate-500">Material educativo compartido</p>
            </div>
          </div>
          {data?.item.sourceType === "file" && data.downloadUrl && (
            <a href={data.downloadUrl} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">
              <Download size={17} /> <span className="hidden sm:inline">Descargar archivo</span><span className="sm:hidden">Descargar</span>
            </a>
          )}
          {data?.item.sourceType === "youtube" && data.item.youtubeUrl && (
            <a href={data.item.youtubeUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">
              <ExternalLink size={17} /> Abrir video
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-3 py-5 sm:px-6 sm:py-8">
        {loading ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-100/50">
            <Loader2 size={34} className="animate-spin text-blue-600" />
            <p className="mt-4 text-sm font-bold text-slate-600">Abriendo material compartido…</p>
          </div>
        ) : error || !data ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl shadow-red-100/50">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-500"><AlertCircle size={36} /></div>
            <h1 className="mt-5 text-2xl font-black">Enlace no disponible</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{error || "El material no pudo ser encontrado."}</p>
          </div>
        ) : (
          <article className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl shadow-blue-100/60">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Documento compartido</p>
                <h1 className="mt-1 truncate text-xl font-black text-slate-900 sm:text-2xl">{data.item.title}</h1>
                <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
                {data.item.sourceType === "file" && <p className="mt-1 text-xs text-slate-400">{data.item.originalFileName} · {data.item.fileSizeLabel}</p>}
              </div>
              {data.item.sourceType === "file" && data.downloadUrl && (
                <a href={data.downloadUrl} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 transition hover:bg-blue-100">
                  <Download size={17} /> Descargar
                </a>
              )}
            </div>
            <MaterialPreview data={data} />
          </article>
        )}
      </main>

      <footer className="border-t border-blue-100 bg-white/85 px-4 py-5 text-center text-sm font-semibold text-slate-500 backdrop-blur">
        Generado por EduAI - Innova Space Education 2026
      </footer>
    </div>
  )
}
