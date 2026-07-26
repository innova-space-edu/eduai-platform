"use client"

import { useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileText,
  Link2,
  LoaderCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import UniversalLayerEditor, { prepareVisibleCreatorData } from "@/components/creator-hub/UniversalLayerEditor"
import SourceStudioPreview from "@/components/creator-hub/SourceStudioPreview"
import EducationalDocumentDownloadBar from "@/components/creator-hub/EducationalDocumentDownloadBar"
import CreatorHubUtilityBar from "@/components/creator-hub/CreatorHubUtilityBar"
import { saveCreatorHubProject, updateCreatorHubProject } from "@/components/creator-hub/project-store"

type SourceType = "topic" | "text" | "url" | "pdf" | "docx"

type SourceInput = {
  id: string
  type: SourceType
  name: string
  content: string
  fileName: string
}

const TYPES: Array<{ id: SourceType; label: string; icon: string }> = [
  { id: "topic", label: "Tema", icon: "💡" },
  { id: "text", label: "Texto", icon: "📝" },
  { id: "url", label: "URL", icon: "🔗" },
  { id: "pdf", label: "PDF", icon: "📄" },
  { id: "docx", label: "Word", icon: "📎" },
]

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function newSource(type: SourceType = "text", index = 0): SourceInput {
  return { id: uid(), type, name: `Fuente ${index + 1}`, content: "", fileName: "" }
}

function titleFromData(data: any) {
  return data?.title || "Síntesis fundamentada"
}

export default function SourceStudioPage() {
  const [title, setTitle] = useState("Síntesis fundamentada")
  const [researchQuestion, setResearchQuestion] = useState("")
  const [bibliographyStyle, setBibliographyStyle] = useState("apa")
  const [strictSources, setStrictSources] = useState(true)
  const [sources, setSources] = useState<SourceInput[]>([newSource("text", 0), newSource("url", 1)])
  const [step, setStep] = useState<"input" | "processing" | "result">("input")
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")
  const [projectId, setProjectId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [accentColor] = useState("#4f46e5")
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const completedSources = useMemo(() => sources.filter((source) => source.content.trim()), [sources])

  const updateSource = (id: string, patch: Partial<SourceInput>) => {
    setSources((current) => current.map((source) => source.id === id ? { ...source, ...patch } : source))
  }

  const changeType = (id: string, type: SourceType) => {
    updateSource(id, { type, content: "", fileName: "" })
    const input = fileRefs.current[id]
    if (input) input.value = ""
  }

  const handleFile = (id: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateSource(id, { content: String(reader.result || "").split(",")[1] || "", fileName: file.name, name: sources.find((source) => source.id === id)?.name || file.name.replace(/\.[^.]+$/, "") })
    reader.readAsDataURL(file)
  }

  const reset = () => {
    setTitle("Síntesis fundamentada")
    setResearchQuestion("")
    setBibliographyStyle("apa")
    setStrictSources(true)
    setSources([newSource("text", 0), newSource("url", 1)])
    setStep("input")
    setResult(null)
    setError("")
    setProjectId(null)
    setSaved(false)
  }

  const persist = (next: any) => {
    setResult(next)
    if (!projectId) return
    const updated = updateCreatorHubProject(projectId, {
      title: titleFromData(next),
      data: next,
      accentColor,
      designTemplateId: "admin-pro-dashboard",
    })
    setSaved(Boolean(updated))
  }

  const generate = async () => {
    if (completedSources.length < 2) {
      setError("Completa al menos dos fuentes antes de generar.")
      return
    }
    setStep("processing")
    setError("")
    setSaved(false)
    try {
      const response = await fetch("/api/creator/source-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          researchQuestion,
          bibliographyStyle,
          strictSources,
          sources: completedSources.map(({ id: _id, ...source }) => source),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.data) throw new Error(payload?.error || "No fue posible analizar las fuentes.")
      setResult(payload.data)
      setStep("result")
      const project = saveCreatorHubProject({
        format: "report",
        title: titleFromData(payload.data),
        data: payload.data,
        accentColor,
        designTemplateId: "admin-pro-dashboard",
      })
      setProjectId(project?.id || null)
      setSaved(Boolean(project))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ocurrió un error inesperado.")
      setStep("input")
    }
  }

  const visibleData = prepareVisibleCreatorData(result)
  const currentTitle = titleFromData(result)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1750px] items-center justify-between gap-4 px-5 py-3.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3"><Link href="/creator-hub" className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft text-muted2 hover:text-main"><ArrowLeft size={15} /></Link><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600"><Link2 size={19} /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-main sm:text-base">Source Studio</p><p className="hidden text-[11px] text-muted2 sm:block">Combina fuentes, compara evidencia y genera citas verificables.</p></div></div>
          <div className="flex items-center gap-2">{saved && <span className="hidden items-center gap-1.5 text-[10px] font-bold text-emerald-600 sm:flex"><CheckCircle2 size={12} /> Guardado</span>}{step !== "input" && <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border border-soft px-3 py-2 text-xs font-bold text-muted2"><RotateCcw size={13} /> Nuevo análisis</button>}</div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1750px] items-start gap-5 px-5 py-6 sm:px-7 xl:grid-cols-[500px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-[82px] xl:max-h-[calc(100vh-96px)] xl:overflow-y-auto xl:pr-1">
          {step !== "result" ? <>
            <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-indigo-600" /><h2 className="text-sm font-bold text-main">Configura la investigación</h2></div>
              <div className="mt-4 space-y-3"><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none" /></label><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Pregunta de investigación</span><textarea value={researchQuestion} onChange={(event) => setResearchQuestion(event.target.value)} rows={3} placeholder="¿Qué deseas comparar, explicar o fundamentar?" className="mt-1.5 w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs leading-5 text-main outline-none" /></label><div className="grid grid-cols-2 gap-2"><label><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Bibliografía</span><select value={bibliographyStyle} onChange={(event) => setBibliographyStyle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main"><option value="apa">APA</option><option value="mla">MLA</option><option value="simple">Simple</option></select></label><label className="flex items-end"><span className="flex w-full items-center justify-between rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs font-bold text-sub">Solo estas fuentes<input type="checkbox" checked={strictSources} onChange={(event) => setStrictSources(event.target.checked)} className="h-4 w-4" /></span></label></div></div>
            </section>

            <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-main">Fuentes</h2><p className="mt-1 text-[10px] text-muted2">Entre 2 y 8 fuentes. Cada una recibirá un identificador [S1], [S2]...</p></div><button type="button" onClick={() => setSources((current) => current.length >= 8 ? current : [...current, newSource("text", current.length)])} disabled={sources.length >= 8} className="inline-flex items-center gap-1 rounded-xl border border-indigo-500/25 bg-indigo-500/5 px-3 py-2 text-[10px] font-bold text-indigo-600 disabled:opacity-30"><Plus size={12} /> Fuente</button></div>
              <div className="mt-4 space-y-3">{sources.map((source, index) => <article key={source.id} className="rounded-2xl border border-soft bg-card-soft-theme p-3"><div className="flex items-center gap-2"><span className="flex h-7 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-[10px] font-black text-indigo-600">S{index + 1}</span><input value={source.name} onChange={(event) => updateSource(source.id, { name: event.target.value })} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-main outline-none" /><button type="button" onClick={() => setSources((current) => current.filter((item) => item.id !== source.id))} disabled={sources.length <= 2} className="text-muted2 hover:text-red-500 disabled:opacity-25"><Trash2 size={13} /></button></div><div className="mt-3 flex flex-wrap gap-1.5">{TYPES.map((type) => <button key={type.id} type="button" onClick={() => changeType(source.id, type.id)} className="rounded-full border px-2.5 py-1 text-[9px] font-bold" style={{ background: source.type === type.id ? "rgba(79,70,229,0.10)" : "var(--bg-card)", borderColor: source.type === type.id ? "rgba(79,70,229,0.30)" : "var(--border-soft)", color: source.type === type.id ? "#4f46e5" : "var(--text-muted)" }}>{type.icon} {type.label}</button>)}</div>{["topic", "text", "url"].includes(source.type) ? <textarea value={source.content} onChange={(event) => updateSource(source.id, { content: event.target.value })} rows={source.type === "text" ? 7 : 4} placeholder={source.type === "url" ? "https://ejemplo.com/fuente" : "Contenido de la fuente..."} className="mt-3 w-full resize-y rounded-xl border border-soft bg-card-theme px-3 py-2.5 text-xs leading-5 text-main outline-none" /> : <button type="button" onClick={() => fileRefs.current[source.id]?.click()} className="mt-3 w-full rounded-xl border-2 border-dashed border-soft bg-card-theme p-4 text-center"><Upload size={19} className="mx-auto text-muted2" /><span className="mt-1 block text-[10px] font-bold text-sub">{source.fileName || `Subir ${source.type.toUpperCase()}`}</span><input ref={(node) => { fileRefs.current[source.id] = node }} type="file" accept={source.type === "pdf" ? ".pdf" : ".doc,.docx"} onChange={(event) => handleFile(source.id, event)} className="hidden" /></button>}</article>)}</div>
              {error && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-500">{error}</div>}
            </section>

            <button type="button" onClick={generate} disabled={completedSources.length < 2} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-3.5 text-sm font-bold text-white disabled:opacity-35"><Sparkles size={16} /> Analizar {completedSources.length} fuentes</button>
          </> : <section className="rounded-3xl border border-soft bg-card-theme p-4"><p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Edición por capas</p><h2 className="mt-1 text-sm font-bold text-main">Corrige la síntesis y sus citas</h2><p className="mb-4 mt-1 text-xs leading-5 text-muted2">Puedes ocultar, bloquear, duplicar o reordenar hallazgos, secciones y recomendaciones.</p><UniversalLayerEditor data={result} onChange={persist} /></section>}
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-main">Informe fundamentado</p><p className="mt-0.5 text-[11px] text-muted2">Cada hallazgo muestra las fuentes que lo respaldan.</p></div><span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold text-indigo-600">Fuentes y citas</span></div>
            {step === "input" && <div className="flex min-h-[700px] flex-col items-center justify-center px-6 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-indigo-500/10 text-indigo-600"><Link2 size={34} /></div><h2 className="mt-5 text-lg font-bold text-main">Combina varias fuentes sin perder su origen</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted2">EduAI comparará acuerdos, diferencias, vacíos y evidencia. Las afirmaciones quedarán marcadas con [S1], [S2] y sus referencias.</p></div>}
            {step === "processing" && <div className="flex min-h-[700px] flex-col items-center justify-center px-6 text-center"><LoaderCircle size={42} className="animate-spin text-indigo-600" /><h2 className="mt-5 text-lg font-bold text-main">Leyendo y comparando fuentes...</h2><p className="mt-2 text-sm text-muted2">Verificando qué afirmaciones corresponden a cada documento.</p></div>}
            {step === "result" && result && <div id="creator-result-container" className="overflow-auto rounded-2xl border border-soft bg-card-soft-theme p-3 sm:p-5"><SourceStudioPreview data={visibleData} accentColor={accentColor} /></div>}
          </div>
          {step === "result" && result && <><EducationalDocumentDownloadBar title={currentTitle} /><CreatorHubUtilityBar format="report" data={visibleData} accentColor={accentColor} designTemplateId="admin-pro-dashboard" title={currentTitle} /></>}
        </section>
      </main>
    </div>
  )
}
